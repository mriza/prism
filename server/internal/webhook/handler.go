package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"prism-server/internal/db"
	"time"

	"github.com/google/uuid"
)

// WebhookEvent represents an event to be sent via webhook
type WebhookEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Timestamp string                 `json:"timestamp"`
	Source    string                 `json:"source"`
	Data      map[string]interface{} `json:"data"`
}

// DeliveryWorker processes pending webhook deliveries
type DeliveryWorker struct {
	client     *http.Client
	maxRetries int
	retryDelay time.Duration
}

// NewDeliveryWorker creates a new webhook delivery worker
func NewDeliveryWorker(maxRetries int, retryDelay time.Duration) *DeliveryWorker {
	return &DeliveryWorker{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		maxRetries: maxRetries,
		retryDelay: retryDelay,
	}
}

// Start begins processing webhook deliveries
func (w *DeliveryWorker) Start(ctx context.Context) {
	log.Println("Webhook delivery worker started")
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Webhook delivery worker stopped")
			return
		case <-ticker.C:
			w.processPendingDeliveries()
		}
	}
}

// processPendingDeliveries fetches and processes pending deliveries
func (w *DeliveryWorker) processPendingDeliveries() {
	deliveries, err := db.GetPendingDeliveries()
	if err != nil {
		log.Printf("Failed to get pending deliveries: %v", err)
		return
	}

	for _, d := range deliveries {
		w.deliver(d)
	}
}

// deliver sends a single webhook delivery
func (w *DeliveryWorker) deliver(d db.WebhookDelivery) {
	// Get webhook config
	webhook, err := db.GetWebhook(d.WebhookID)
	if err != nil || webhook == nil {
		log.Printf("Webhook %s not found for delivery %s", d.WebhookID, d.ID)
		return
	}

	if !webhook.Active {
		log.Printf("Webhook %s is inactive, skipping delivery", d.WebhookID)
		return
	}

	// Check if event type matches webhook events
	var events []string
	if err := json.Unmarshal([]byte(webhook.Events), &events); err == nil {
		matched := false
		for _, e := range events {
			if e == "*" || e == d.Event {
				matched = true
				break
			}
		}
		if !matched {
			return // Event not subscribed
		}
	}

	// Mark as processing
	db.UpdateWebhookDeliveryStatus(d.ID, "processing", 0, "", d.Attempts, "", "")

	// Create HTTP request
	req, err := http.NewRequest("POST", webhook.URL, bytes.NewReader([]byte(d.Payload)))
	if err != nil {
		w.markFailed(d.ID, d.Attempts+1, fmt.Sprintf("Failed to create request: %v", err))
		return
	}

	req.Header.Set("Content-Type", webhook.ContentType)
	req.Header.Set("X-Webhook-ID", webhook.ID)
	req.Header.Set("X-Webhook-Event", d.Event)
	req.Header.Set("X-Webhook-Signature", w.signPayload([]byte(d.Payload), webhook.Secret))
	req.Header.Set("X-Webhook-Delivery-ID", d.ID)
	req.Header.Set("User-Agent", "PRISM-Webhook/1.0")

	// Send request
	resp, err := w.client.Do(req)
	if err != nil {
		w.markFailed(d.ID, d.Attempts+1, fmt.Sprintf("Request failed: %v", err))
		return
	}
	defer resp.Body.Close()

	// Read response body (limit to 1KB)
	buf := make([]byte, 1024)
	n, _ := resp.Body.Read(buf)
	responseBody := string(buf[:n])

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Success
		db.MarkDeliverySuccess(d.ID, resp.StatusCode, responseBody)
		log.Printf("Webhook delivery success: %s -> %s (status: %d)", d.Event, webhook.URL, resp.StatusCode)
	} else {
		// Failed - will retry
		w.markFailed(d.ID, d.Attempts+1, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, responseBody))
	}
}

// signPayload creates HMAC signature for payload
func (w *DeliveryWorker) signPayload(payload []byte, secret string) string {
	if secret == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// markFailed marks a delivery as failed and schedules retry
func (w *DeliveryWorker) markFailed(deliveryID string, attempts int, errMsg string) {
	if attempts >= w.maxRetries {
		// Max retries exceeded
		db.MarkDeliveryFailed(deliveryID, errMsg, attempts, "")
		log.Printf("Webhook delivery failed permanently: %s (attempts: %d)", deliveryID, attempts)
	} else {
		// Schedule retry with exponential backoff
		retryAt := time.Now().UTC().Add(w.retryDelay * time.Duration(attempts))
		db.MarkDeliveryFailed(deliveryID, errMsg, attempts, retryAt.Format(time.RFC3339))
		log.Printf("Webhook delivery failed, will retry: %s (attempt %d/%d)", deliveryID, attempts, w.maxRetries)
	}
}

// QueueEvent queues a new event for webhook delivery
func QueueEvent(event WebhookEvent) error {
	// Get active webhooks that subscribe to this event
	webhooks, err := db.GetActiveWebhooks()
	if err != nil {
		return fmt.Errorf("failed to get active webhooks: %w", err)
	}

	queued := 0
	for _, wh := range webhooks {
		// Check if webhook subscribes to this event
		var events []string
		if err := json.Unmarshal([]byte(wh.Events), &events); err != nil {
			continue
		}

		subscribed := false
		for _, e := range events {
			if e == "*" || e == event.Type {
				subscribed = true
				break
			}
		}

		if !subscribed {
			continue
		}

		// Create delivery record
		delivery := db.WebhookDelivery{
			ID:        uuid.New().String(),
			WebhookID: wh.ID,
			Event:     event.Type,
			Payload:   marshalEvent(event),
			Status:    "pending",
			Attempts:  0,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		}

		if err := db.CreateWebhookDelivery(delivery); err != nil {
			log.Printf("Failed to create webhook delivery: %v", err)
		} else {
			queued++
		}
	}

	if queued > 0 {
		log.Printf("Queued webhook event '%s' for %d deliveries", event.Type, queued)
	}

	return nil
}

// marshalEvent marshals event to JSON
func marshalEvent(event WebhookEvent) string {
	b, err := json.Marshal(event)
	if err != nil {
		return `{}`
	}
	return string(b)
}
