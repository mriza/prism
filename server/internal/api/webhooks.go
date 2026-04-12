package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/webhook"
	"strings"
	"time"

	"github.com/google/uuid"
)

func currentTime() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func mustMarshal(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf(`{"error":"marshal failed: %s"}`, err.Error())
	}
	return string(b)
}

// HandleWebhooks handles CRUD operations for webhooks
func HandleWebhooks(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	authToken := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	path := r.URL.Path

	// Handle /api/webhooks/{id}/deliveries
	if strings.HasSuffix(path, "/deliveries") {
		parts := strings.Split(strings.TrimPrefix(path, "/api/webhooks/"), "/")
		if len(parts) == 2 && parts[1] == "deliveries" {
			HandleWebhookDeliveries(w, r, parts[0])
			return
		}
		// /api/webhooks/{id}/deliveries/{deliveryId}
		if len(parts) == 3 && parts[1] == "deliveries" {
			HandleWebhookDeliveryDetail(w, r, parts[0], parts[2])
			return
		}
	}

	// Handle /api/webhooks/{id}
	if strings.HasSuffix(path, "/stats") {
		parts := strings.Split(strings.TrimPrefix(path, "/api/webhooks/"), "/")
		if len(parts) == 2 && parts[1] == "stats" {
			HandleWebhookStats(w, r, parts[0])
			return
		}
	}

	webhookID := strings.TrimPrefix(path, "/api/webhooks/")

	switch r.Method {
	case "GET":
		if webhookID == "" || webhookID == "/" {
			handleListWebhooks(w, r)
		} else {
			handleGetWebhook(w, r, strings.TrimSuffix(webhookID, "/"))
		}
	case "POST":
		if webhookID == "" || webhookID == "/" {
			handleCreateWebhook(w, r, authToken)
		}
	case "PUT":
		if webhookID != "" && webhookID != "/" {
			handleUpdateWebhook(w, r, strings.TrimSuffix(webhookID, "/"))
		}
	case "DELETE":
		if webhookID != "" && webhookID != "/" {
			handleDeleteWebhook(w, r, strings.TrimSuffix(webhookID, "/"))
		}
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleListWebhooks(w http.ResponseWriter, r *http.Request) {
	webhooks, err := db.GetActiveWebhooks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Remove secrets from response
	for i := range webhooks {
		webhooks[i].Secret = ""
	}

	json.NewEncoder(w).Encode(webhooks)
}

func handleGetWebhook(w http.ResponseWriter, r *http.Request, id string) {
	wh, err := db.GetWebhook(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if wh == nil {
		http.Error(w, "Webhook not found", http.StatusNotFound)
		return
	}

	wh.Secret = "" // Don't expose secret
	json.NewEncoder(w).Encode(wh)
}

func handleCreateWebhook(w http.ResponseWriter, r *http.Request, createdBy string) {
	var req struct {
		Name        string   `json:"name"`
		URL         string   `json:"url"`
		Secret      string   `json:"secret"`
		Events      []string `json:"events"`
		ContentType string   `json:"contentType"`
		Active      bool     `json:"active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.URL == "" {
		http.Error(w, "Name and URL are required", http.StatusBadRequest)
		return
	}

	if len(req.Events) == 0 {
		req.Events = []string{"*"}
	}

	eventsJSON, _ := json.Marshal(req.Events)
	if req.ContentType == "" {
		req.ContentType = "application/json"
	}

	now := currentTime()
	wh := db.Webhook{
		ID:          uuid.New().String(),
		Name:        req.Name,
		URL:         req.URL,
		Secret:      req.Secret,
		Events:      string(eventsJSON),
		ContentType: req.ContentType,
		Active:      req.Active,
		CreatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := db.CreateWebhook(wh); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	wh.Secret = ""
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wh)
}

func handleUpdateWebhook(w http.ResponseWriter, r *http.Request, id string) {
	wh, err := db.GetWebhook(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if wh == nil {
		http.Error(w, "Webhook not found", http.StatusNotFound)
		return
	}

	var req struct {
		Name        string   `json:"name"`
		URL         string   `json:"url"`
		Secret      string   `json:"secret"`
		Events      []string `json:"events"`
		ContentType string   `json:"contentType"`
		Active      bool     `json:"active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name != "" {
		wh.Name = req.Name
	}
	if req.URL != "" {
		wh.URL = req.URL
	}
	if req.Secret != "" {
		wh.Secret = req.Secret
	}
	if len(req.Events) > 0 {
		eventsJSON, _ := json.Marshal(req.Events)
		wh.Events = string(eventsJSON)
	}
	if req.ContentType != "" {
		wh.ContentType = req.ContentType
	}
	wh.Active = req.Active
	wh.UpdatedAt = currentTime()

	if err := db.UpdateWebhook(*wh); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	wh.Secret = ""
	json.NewEncoder(w).Encode(wh)
}

func handleDeleteWebhook(w http.ResponseWriter, r *http.Request, id string) {
	if err := db.DeleteWebhook(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleWebhookDeliveries lists deliveries for a webhook
func HandleWebhookDeliveries(w http.ResponseWriter, r *http.Request, webhookID string) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if _, err := fmt.Sscanf(l, "%d", &limit); err != nil {
			limit = 50
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if _, err := fmt.Sscanf(o, "%d", &offset); err != nil {
			offset = 0
		}
	}

	deliveries, err := db.GetWebhookDeliveries(webhookID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(deliveries)
}

// HandleWebhookDeliveryDetail gets detail of a single delivery
func HandleWebhookDeliveryDetail(w http.ResponseWriter, r *http.Request, webhookID, deliveryID string) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	deliveries, err := db.GetWebhookDeliveries(webhookID, 1, 0)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for _, d := range deliveries {
		if d.ID == deliveryID {
			json.NewEncoder(w).Encode(d)
			return
		}
	}

	http.Error(w, "Delivery not found", http.StatusNotFound)
}

// HandleWebhookStats returns statistics for a webhook
func HandleWebhookStats(w http.ResponseWriter, r *http.Request, webhookID string) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := db.GetWebhookStats(webhookID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}

// HandleWebhookTest sends a test event to a webhook
func HandleWebhookTest(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		URL    string `json:"url"`
		Secret string `json:"secret"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.URL == "" {
		http.Error(w, "URL is required", http.StatusBadRequest)
		return
	}

	// Create test event
	event := webhook.WebhookEvent{
		ID:        uuid.New().String(),
		Type:      "test.ping",
		Timestamp: currentTime(),
		Source:    "prism-api",
		Data: map[string]interface{}{
			"message": "This is a test event from PRISM",
			"time":    currentTime(),
		},
	}

	payload := mustMarshal(event)

	// Send test request
	httpClient := &http.Client{Timeout: 10 * time.Second}
	httpReq, err := http.NewRequest("POST", req.URL, strings.NewReader(payload))
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Webhook-Event", "test.ping")
	if req.Secret != "" {
		mac := hmac.New(sha256.New, []byte(req.Secret))
		mac.Write([]byte(payload))
		httpReq.Header.Set("X-Webhook-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}
	httpReq.Header.Set("User-Agent", "PRISM-Webhook/1.0 (Test)")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    resp.StatusCode >= 200 && resp.StatusCode < 300,
		"statusCode": resp.StatusCode,
	})
}
