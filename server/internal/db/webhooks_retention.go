package db

import (
	"database/sql"
	"log"
	"prism-server/internal/models"
	"time"

	"github.com/google/uuid"
)

// Webhook Subscription operations

func CreateWebhookSubscription(sub models.WebhookSubscription) (models.WebhookSubscription, error) {
	if sub.ID == "" {
		sub.ID = uuid.NewString()
	}
	if sub.CreatedAt.IsZero() {
		sub.CreatedAt = time.Now().UTC()
	}

	query := `INSERT INTO webhook_subscriptions (id, name, url, events, active, secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, sub.ID, sub.Name, sub.URL, sub.Events, sub.Active, sub.Secret, sub.CreatedAt, sub.UpdatedAt)
	if err != nil {
		return sub, err
	}

	log.Printf("Created webhook subscription: %s -> %s", sub.Name, sub.URL)
	return sub, nil
}

func GetWebhookSubscriptions() ([]models.WebhookSubscription, error) {
	query := `SELECT id, name, url, events, active, secret, created_at, updated_at FROM webhook_subscriptions ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subscriptions []models.WebhookSubscription
	for rows.Next() {
		var sub models.WebhookSubscription
		var createdAt, updatedAt string
		err := rows.Scan(&sub.ID, &sub.Name, &sub.URL, &sub.Events, &sub.Active, &sub.Secret, &createdAt, &updatedAt)
		if err != nil {
			return nil, err
		}
		sub.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		sub.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		subscriptions = append(subscriptions, sub)
	}

	return subscriptions, nil
}

func UpdateWebhookSubscription(sub models.WebhookSubscription) error {
	query := `UPDATE webhook_subscriptions SET name = ?, url = ?, events = ?, active = ?, secret = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, sub.Name, sub.URL, sub.Events, sub.Active, sub.Secret, time.Now().UTC(), sub.ID)
	return err
}

func DeleteWebhookSubscription(id string) error {
	query := `DELETE FROM webhook_subscriptions WHERE id = ?`
	_, err := DB.Exec(query, id)
	return err
}

// Webhook Delivery operations

func CreateWebhookDelivery(delivery models.WebhookDelivery) (models.WebhookDelivery, error) {
	if delivery.ID == "" {
		delivery.ID = uuid.NewString()
	}
	if delivery.CreatedAt.IsZero() {
		delivery.CreatedAt = time.Now().UTC()
	}

	query := `INSERT INTO webhook_deliveries (id, subscription_id, event_type, payload, status, response_code, response_body, attempts, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	var responseCode, responseBody sql.NullString
	if delivery.ResponseCode != 0 {
		responseCode = sql.NullString{String: string(rune(delivery.ResponseCode)), Valid: true}
	}
	if delivery.ResponseBody != "" {
		responseBody = sql.NullString{String: delivery.ResponseBody, Valid: true}
	}

	var deliveredAt sql.NullString
	if delivery.DeliveredAt != nil {
		deliveredAt = sql.NullString{String: delivery.DeliveredAt.Format(time.RFC3339), Valid: true}
	}

	_, err := DB.Exec(query, delivery.ID, delivery.SubscriptionID, delivery.EventType, delivery.Payload, delivery.Status, responseCode, responseBody, delivery.Attempts, delivery.CreatedAt, deliveredAt)
	if err != nil {
		return delivery, err
	}

	return delivery, nil
}

func UpdateWebhookDeliveryStatus(id string, status string, responseCode int, responseBody string, attempts int) error {
	query := `UPDATE webhook_deliveries SET status = ?, response_code = ?, response_body = ?, attempts = ? WHERE id = ?`
	_, err := DB.Exec(query, status, string(rune(responseCode)), responseBody, attempts, id)
	return err
}

func GetPendingWebhookDeliveries(limit int) ([]models.WebhookDelivery, error) {
	query := `SELECT id, subscription_id, event_type, payload, status, response_code, response_body, attempts, created_at, delivered_at FROM webhook_deliveries WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`
	rows, err := DB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deliveries []models.WebhookDelivery
	for rows.Next() {
		var d models.WebhookDelivery
		var responseCode, responseBody, deliveredAtNull sql.NullString
		err := rows.Scan(&d.ID, &d.SubscriptionID, &d.EventType, &d.Payload, &d.Status, &responseCode, &responseBody, &d.Attempts, &d.CreatedAt, &deliveredAtNull)
		if err != nil {
			return nil, err
		}
		if responseCode.Valid {
			// Parse response code
		}
		if deliveredAtNull.Valid {
			t, _ := time.Parse(time.RFC3339, deliveredAtNull.String)
			d.DeliveredAt = &t
		}
		deliveries = append(deliveries, d)
	}

	return deliveries, nil
}

// Retention Policy operations

func CreateRetentionPolicy(policy models.RetentionPolicy) (models.RetentionPolicy, error) {
	if policy.ID == "" {
		policy.ID = uuid.NewString()
	}
	if policy.CreatedAt.IsZero() {
		policy.CreatedAt = time.Now().UTC()
	}

	query := `INSERT INTO retention_policies (id, name, resource_type, retention_days, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, policy.ID, policy.Name, policy.ResourceType, policy.RetentionDays, policy.Enabled, policy.CreatedAt, policy.UpdatedAt)
	if err != nil {
		return policy, err
	}

	log.Printf("Created retention policy: %s (%d days)", policy.Name, policy.RetentionDays)
	return policy, nil
}

func GetRetentionPolicies() ([]models.RetentionPolicy, error) {
	query := `SELECT id, name, resource_type, retention_days, enabled, created_at, updated_at FROM retention_policies WHERE enabled = 1 ORDER BY resource_type`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []models.RetentionPolicy
	for rows.Next() {
		var p models.RetentionPolicy
		var createdAt, updatedAt string
		err := rows.Scan(&p.ID, &p.Name, &p.ResourceType, &p.RetentionDays, &p.Enabled, &createdAt, &updatedAt)
		if err != nil {
			return nil, err
		}
		p.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		p.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		policies = append(policies, p)
	}

	return policies, nil
}

func CleanupExpiredData() (int, error) {
	policies, err := GetRetentionPolicies()
	if err != nil {
		return 0, err
	}

	totalDeleted := 0

	for _, policy := range policies {
		var deleted int64
		var err error

		switch policy.ResourceType {
		case "telemetry":
			query := `DELETE FROM telemetry WHERE collected_at < datetime('now', '-' || ? || ' days')`
			result, err := DB.Exec(query, policy.RetentionDays)
			if err == nil {
				deleted, _ = result.RowsAffected()
			}
		case "audit_log":
			query := `DELETE FROM audit_log WHERE timestamp < datetime('now', '-' || ? || ' days')`
			result, err := DB.Exec(query, policy.RetentionDays)
			if err == nil {
				deleted, _ = result.RowsAffected()
			}
		case "commands":
			query := `DELETE FROM commands WHERE issued_at < datetime('now', '-' || ? || ' days') AND status IN ('executed', 'failed')`
			result, err := DB.Exec(query, policy.RetentionDays)
			if err == nil {
				deleted, _ = result.RowsAffected()
			}
		}

		if err == nil {
			log.Printf("Cleaned up %d expired %s records (retention: %d days)", deleted, policy.ResourceType, policy.RetentionDays)
			totalDeleted += int(deleted)
		}
	}

	return totalDeleted, nil
}

// Initialize default retention policies
func InitializeDefaultRetentionPolicies() error {
	defaultPolicies := []struct {
		name          string
		resourceType  string
		retentionDays int
	}{
		{"Telemetry 30 days", "telemetry", 30},
		{"Audit Log 90 days", "audit_log", 90},
		{"Commands 7 days", "commands", 7},
	}

	for _, p := range defaultPolicies {
		existing, _ := GetRetentionPolicies()
		found := false
		for _, ep := range existing {
			if ep.ResourceType == p.resourceType {
				found = true
				break
			}
		}
		if !found {
			_, err := CreateRetentionPolicy(models.RetentionPolicy{
				Name:          p.name,
				ResourceType:  p.resourceType,
				RetentionDays: p.retentionDays,
				Enabled:       true,
			})
			if err != nil {
				log.Printf("Warning: failed to create retention policy %s: %v", p.name, err)
			}
		}
	}

	log.Println("Default retention policies initialized")
	return nil
}

// Configuration Drift Detection operations

func CreateConfigurationSnapshot(snapshot models.ConfigurationSnapshot) (models.ConfigurationSnapshot, error) {
	if snapshot.ID == "" {
		snapshot.ID = uuid.NewString()
	}
	if snapshot.CreatedAt.IsZero() {
		snapshot.CreatedAt = time.Now().UTC()
	}

	query := `INSERT INTO configuration_snapshots (id, server_id, service_id, config_hash, config_data, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, snapshot.ID, snapshot.ServerID, snapshot.ServiceID, snapshot.ConfigHash, snapshot.ConfigData, snapshot.CreatedAt, snapshot.CreatedBy)
	if err != nil {
		return snapshot, err
	}

	log.Printf("Created configuration snapshot for server %s", snapshot.ServerID)
	return snapshot, nil
}

func GetLatestSnapshot(serverID string, serviceID *string) (*models.ConfigurationSnapshot, error) {
	var query string
	var args []interface{}

	if serviceID != nil {
		query = `SELECT id, server_id, service_id, config_hash, config_data, created_at, created_by FROM configuration_snapshots WHERE server_id = ? AND service_id = ? ORDER BY created_at DESC LIMIT 1`
		args = []interface{}{serverID, *serviceID}
	} else {
		query = `SELECT id, server_id, service_id, config_hash, config_data, created_at, created_by FROM configuration_snapshots WHERE server_id = ? AND service_id IS NULL ORDER BY created_at DESC LIMIT 1`
		args = []interface{}{serverID}
	}

	row := DB.QueryRow(query, args...)
	var snapshot models.ConfigurationSnapshot
	var createdAt string
	var serviceIDNull, createdBy sql.NullString

	err := row.Scan(&snapshot.ID, &snapshot.ServerID, &serviceIDNull, &snapshot.ConfigHash, &snapshot.ConfigData, &createdAt, &createdBy)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if serviceIDNull.Valid {
		snapshot.ServiceID = serviceIDNull.String
	}
	if createdBy.Valid {
		snapshot.CreatedBy = createdBy.String
	}
	snapshot.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)

	return &snapshot, nil
}

func CreateDriftEvent(event models.DriftEvent) (models.DriftEvent, error) {
	if event.ID == "" {
		event.ID = uuid.NewString()
	}
	if event.DetectedAt.IsZero() {
		event.DetectedAt = time.Now().UTC()
	}

	query := `INSERT INTO drift_events (id, server_id, service_id, snapshot_id, drift_type, severity, description, old_config, new_config, detected_at, resolved_at, resolved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	var serviceID, snapshotID, resolvedAt, resolvedBy sql.NullString
	if event.ServiceID != "" {
		serviceID = sql.NullString{String: event.ServiceID, Valid: true}
	}
	if event.SnapshotID != "" {
		snapshotID = sql.NullString{String: event.SnapshotID, Valid: true}
	}
	if event.ResolvedAt != nil {
		resolvedAt = sql.NullString{String: event.ResolvedAt.Format(time.RFC3339), Valid: true}
	}
	if event.ResolvedBy != "" {
		resolvedBy = sql.NullString{String: event.ResolvedBy, Valid: true}
	}

	_, err := DB.Exec(query, event.ID, event.ServerID, serviceID, snapshotID, event.DriftType, event.Severity, event.Description, event.OldConfig, event.NewConfig, event.DetectedAt, resolvedAt, resolvedBy)
	if err != nil {
		return event, err
	}

	log.Printf("Created drift event for server %s: %s", event.ServerID, event.DriftType)
	return event, nil
}

func GetActiveDriftEvents(serverID *string) ([]models.DriftEvent, error) {
	var query string
	var args []interface{}

	if serverID != nil {
		query = `SELECT id, server_id, service_id, snapshot_id, drift_type, severity, description, old_config, new_config, detected_at, resolved_at, resolved_by FROM drift_events WHERE server_id = ? AND resolved_at IS NULL ORDER BY detected_at DESC`
		args = []interface{}{*serverID}
	} else {
		query = `SELECT id, server_id, service_id, snapshot_id, drift_type, severity, description, old_config, new_config, detected_at, resolved_at, resolved_by FROM drift_events WHERE resolved_at IS NULL ORDER BY detected_at DESC`
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.DriftEvent
	for rows.Next() {
		var e models.DriftEvent
		var serviceIDNull, snapshotIDNull, resolvedAtNull, resolvedByNull sql.NullString
		var detectedAt string

		err := rows.Scan(&e.ID, &e.ServerID, &serviceIDNull, &snapshotIDNull, &e.DriftType, &e.Severity, &e.Description, &e.OldConfig, &e.NewConfig, &detectedAt, &resolvedAtNull, &resolvedByNull)
		if err != nil {
			return nil, err
		}

		if serviceIDNull.Valid {
			e.ServiceID = serviceIDNull.String
		}
		if snapshotIDNull.Valid {
			e.SnapshotID = snapshotIDNull.String
		}
		if resolvedByNull.Valid {
			e.ResolvedBy = resolvedByNull.String
		}
		e.DetectedAt, _ = time.Parse(time.RFC3339, detectedAt)

		events = append(events, e)
	}

	return events, nil
}

func ResolveDriftEvent(eventID string, resolvedBy string) error {
	now := time.Now().UTC()
	query := `UPDATE drift_events SET resolved_at = ?, resolved_by = ? WHERE id = ?`
	_, err := DB.Exec(query, now, resolvedBy, eventID)
	return err
}

func DetectConfigDrift(serverID string, serviceID *string, newConfigData string, newConfigHash string, detectedBy string) (*models.DriftEvent, error) {
	// Get latest snapshot
	snapshot, err := GetLatestSnapshot(serverID, serviceID)
	if err != nil {
		return nil, err
	}

	// If no snapshot exists, create one (no drift)
	if snapshot == nil {
		snapshot := models.ConfigurationSnapshot{
			ServerID:   serverID,
			ConfigHash: newConfigHash,
			ConfigData: newConfigData,
			CreatedBy:  detectedBy,
		}
		if serviceID != nil {
			snapshot.ServiceID = *serviceID
		}
		_, err := CreateConfigurationSnapshot(snapshot)
		return nil, err
	}

	// Check if config has changed
	if snapshot.ConfigHash != newConfigHash {
		// Drift detected!
		event := models.DriftEvent{
			ServerID:    serverID,
			DriftType:   "changed",
			Severity:    "warning",
			Description: "Configuration has drifted from baseline",
			OldConfig:   snapshot.ConfigData,
			NewConfig:   newConfigData,
			DetectedAt:  time.Now().UTC(),
		}

		if serviceID != nil {
			event.ServiceID = *serviceID
		}
		if snapshot.ID != "" {
			event.SnapshotID = snapshot.ID
		}

		// Create drift event
		driftEvent, err := CreateDriftEvent(event)
		if err != nil {
			return nil, err
		}

		// Create new snapshot
		newSnapshot := models.ConfigurationSnapshot{
			ServerID:   serverID,
			ConfigHash: newConfigHash,
			ConfigData: newConfigData,
			CreatedBy:  detectedBy,
		}
		if serviceID != nil {
			newSnapshot.ServiceID = *serviceID
		}
		CreateConfigurationSnapshot(newSnapshot)

		return &driftEvent, nil
	}

	return nil, nil // No drift
}
