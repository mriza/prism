package db

import (
	"database/sql"
	"time"
)

// Webhook represents a webhook endpoint configuration
type Webhook struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	Secret      string `json:"-"`           // Don't expose in JSON
	Events      string `json:"events"`      // JSON array of event types
	ContentType string `json:"contentType"` // application/json
	Active      bool   `json:"active"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
	CreatedBy   string `json:"createdBy"`
}

// WebhookDelivery represents a single webhook delivery attempt
type WebhookDelivery struct {
	ID          string `json:"id"`
	WebhookID   string `json:"webhookId"`
	Event       string `json:"event"`
	Payload     string `json:"payload,omitempty"` // JSON payload sent
	Status      string `json:"status"`            // pending, success, failed
	StatusCode  int    `json:"statusCode,omitempty"`
	Response    string `json:"response,omitempty"`
	Attempts    int    `json:"attempts"`
	LastError   string `json:"lastError,omitempty"`
	NextRetry   string `json:"nextRetry,omitempty"`
	DeliveredAt string `json:"deliveredAt,omitempty"`
	CreatedAt   string `json:"createdAt"`
}

// InitWebhooksTable creates the webhooks table if not exists
func InitWebhooksTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS webhooks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		secret TEXT,
		events TEXT NOT NULL DEFAULT '[]',
		content_type TEXT NOT NULL DEFAULT 'application/json',
		active BOOLEAN NOT NULL DEFAULT 1,
		created_by TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
	`
	_, err := DB.Exec(query)
	return err
}

// InitWebhookDeliveriesTable creates the webhook deliveries table
func InitWebhookDeliveriesTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS webhook_deliveries (
		id TEXT PRIMARY KEY,
		webhook_id TEXT NOT NULL,
		event TEXT NOT NULL,
		payload TEXT,
		status TEXT NOT NULL DEFAULT 'pending',
		status_code INTEGER,
		response TEXT,
		attempts INTEGER NOT NULL DEFAULT 0,
		last_error TEXT,
		next_retry TEXT,
		delivered_at TEXT,
		created_at TEXT NOT NULL,
		FOREIGN KEY(webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status);
	CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id);
	CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON webhook_deliveries(next_retry);
	`
	_, err := DB.Exec(query)
	return err
}

// CreateWebhook creates a new webhook endpoint
func CreateWebhook(w Webhook) error {
	query := `INSERT INTO webhooks (id, name, url, secret, events, content_type, active, created_by, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, w.ID, w.Name, w.URL, w.Secret, w.Events, w.ContentType, w.Active, w.CreatedBy, w.CreatedAt, w.UpdatedAt)
	return err
}

// GetWebhook retrieves a webhook by ID
func GetWebhook(id string) (*Webhook, error) {
	var w Webhook
	query := `SELECT id, name, url, secret, events, content_type, active, created_by, created_at, updated_at FROM webhooks WHERE id = ?`
	err := DB.QueryRow(query, id).Scan(&w.ID, &w.Name, &w.URL, &w.Secret, &w.Events, &w.ContentType, &w.Active, &w.CreatedBy, &w.CreatedAt, &w.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &w, err
}

// GetActiveWebhooks retrieves all active webhook endpoints
func GetActiveWebhooks() ([]Webhook, error) {
	query := `SELECT id, name, url, secret, events, content_type, active, created_by, created_at, updated_at FROM webhooks WHERE active = 1`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var webhooks []Webhook
	for rows.Next() {
		var w Webhook
		err := rows.Scan(&w.ID, &w.Name, &w.URL, &w.Secret, &w.Events, &w.ContentType, &w.Active, &w.CreatedBy, &w.CreatedAt, &w.UpdatedAt)
		if err != nil {
			return nil, err
		}
		webhooks = append(webhooks, w)
	}
	return webhooks, nil
}

// UpdateWebhook updates a webhook
func UpdateWebhook(w Webhook) error {
	query := `UPDATE webhooks SET name=?, url=?, secret=?, events=?, content_type=?, active=?, updated_at=? WHERE id=?`
	_, err := DB.Exec(query, w.Name, w.URL, w.Secret, w.Events, w.ContentType, w.Active, w.UpdatedAt, w.ID)
	return err
}

// DeleteWebhook deletes a webhook by ID
func DeleteWebhook(id string) error {
	_, err := DB.Exec(`DELETE FROM webhooks WHERE id = ?`, id)
	return err
}

// CreateWebhookDelivery records a new delivery attempt
func CreateWebhookDelivery(d WebhookDelivery) error {
	query := `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, attempts, created_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, d.ID, d.WebhookID, d.Event, d.Payload, d.Status, d.Attempts, d.CreatedAt)
	return err
}

// UpdateWebhookDeliveryStatus updates the status of a delivery
func UpdateWebhookDeliveryStatus(id string, status string, statusCode int, response string, attempts int, lastError string, nextRetry string) error {
	query := `UPDATE webhook_deliveries SET status=?, status_code=?, response=?, attempts=?, last_error=?, next_retry=? WHERE id=?`
	_, err := DB.Exec(query, status, statusCode, response, attempts, lastError, nextRetry, id)
	return err
}

// MarkDeliverySuccess marks a delivery as successfully delivered
func MarkDeliverySuccess(id string, statusCode int, response string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE webhook_deliveries SET status='success', status_code=?, response=?, delivered_at=?, next_retry=NULL WHERE id=?`
	_, err := DB.Exec(query, statusCode, response, now, id)
	return err
}

// MarkDeliveryFailed marks a delivery as failed
func MarkDeliveryFailed(id string, err string, attempts int, nextRetry string) error {
	query := `UPDATE webhook_deliveries SET status='failed', last_error=?, attempts=?, next_retry=? WHERE id=?`
	_, err2 := DB.Exec(query, err, attempts, nextRetry, id)
	return err2
}

// GetPendingDeliveries retrieves deliveries that need to be sent
func GetPendingDeliveries() ([]WebhookDelivery, error) {
	query := `SELECT id, webhook_id, event, payload, status, attempts, created_at FROM webhook_deliveries 
	          WHERE status = 'pending' OR (status = 'failed' AND next_retry <= ?)
	          ORDER BY created_at ASC LIMIT 100`
	now := time.Now().UTC().Format(time.RFC3339)
	rows, err := DB.Query(query, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deliveries []WebhookDelivery
	for rows.Next() {
		var d WebhookDelivery
		err := rows.Scan(&d.ID, &d.WebhookID, &d.Event, &d.Payload, &d.Status, &d.Attempts, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		deliveries = append(deliveries, d)
	}
	return deliveries, nil
}

// GetWebhookDeliveries retrieves deliveries for a webhook
func GetWebhookDeliveries(webhookID string, limit, offset int) ([]WebhookDelivery, error) {
	query := `SELECT id, webhook_id, event, payload, status, status_code, response, attempts, last_error, next_retry, delivered_at, created_at 
	          FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
	rows, err := DB.Query(query, webhookID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deliveries []WebhookDelivery
	for rows.Next() {
		var d WebhookDelivery
		err := rows.Scan(&d.ID, &d.WebhookID, &d.Event, &d.Payload, &d.Status, &d.StatusCode, &d.Response, &d.Attempts, &d.LastError, &d.NextRetry, &d.DeliveredAt, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		deliveries = append(deliveries, d)
	}
	return deliveries, nil
}

// GetWebhookStats returns statistics for a webhook
func GetWebhookStats(webhookID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	var total, success, failed, pending int
	err := DB.QueryRow(`SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = ?`, webhookID).Scan(&total)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = ? AND status = 'success'`, webhookID).Scan(&success)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = ? AND status = 'failed'`, webhookID).Scan(&failed)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM webhook_deliveries WHERE webhook_id = ? AND status = 'pending'`, webhookID).Scan(&pending)
	if err != nil {
		return nil, err
	}

	stats["total"] = total
	stats["success"] = success
	stats["failed"] = failed
	stats["pending"] = pending
	if total > 0 {
		stats["success_rate"] = float64(success) / float64(total) * 100
	} else {
		stats["success_rate"] = 0.0
	}

	return stats, nil
}

// CleanupOldDeliveries deletes old deliveries based on retention period
func CleanupOldDeliveries(retentionDays int) (int64, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays).Format(time.RFC3339)
	res, err := DB.Exec(`DELETE FROM webhook_deliveries WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
