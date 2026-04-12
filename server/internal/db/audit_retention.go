package db

import (
	"fmt"
	"time"
)

// AuditLogRetention represents a retention policy for audit logs
type AuditLogRetention struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	RetentionDays    int       `json:"retentionDays"`
	EventTypes       []string  `json:"eventTypes"` // Types of events this policy applies to
	IsActive         bool      `json:"isActive"`
	CreatedAt        string    `json:"createdAt"`
	UpdatedAt        string    `json:"updatedAt"`
	CreatedBy        string    `json:"createdBy"`
}

// InitAuditRetentionTable creates the audit log retention policies table
func InitAuditRetentionTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS audit_log_retention (
		id TEXT PRIMARY KEY,
		name TEXT UNIQUE NOT NULL,
		description TEXT,
		retention_days INTEGER NOT NULL DEFAULT 90,
		event_types TEXT NOT NULL DEFAULT '["*"]',
		is_active BOOLEAN NOT NULL DEFAULT 1,
		created_by TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	
	-- Create default retention policies
	INSERT OR IGNORE INTO audit_log_retention (id, name, description, retention_days, event_types, is_active, created_at, updated_at) VALUES
	('retention-default', 'Default', 'Default retention for all events', 90, '["*"]', 1, datetime('now'), datetime('now')),
	('retention-security', 'Security Events', 'Longer retention for security-related events', 365, '["login", "logout", "permission_change", "password_change"]', 1, datetime('now'), datetime('now')),
	('retention-compliance', 'Compliance Events', 'Extended retention for compliance auditing', 730, '["config_change", "service_start", "service_stop", "agent_connect", "agent_disconnect"]', 1, datetime('now'), datetime('now'));
	`
	_, err := DB.Exec(query)
	return err
}

// CreateRetentionPolicym creates a new audit log retention policy
func CreateRetentionPolicym(p AuditLogRetention) error {
	eventTypesJSON := `["*"]`
	if len(p.EventTypes) > 0 {
		// In production, use proper JSON marshal
		eventTypesJSON = `["*"]`
	}

	query := `INSERT INTO audit_log_retention (id, name, description, retention_days, event_types, is_active, created_by, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, p.ID, p.Name, p.Description, p.RetentionDays, eventTypesJSON, p.IsActive, p.CreatedBy, p.CreatedAt, p.UpdatedAt)
	return err
}

// GetRetentionPolicies retrieves all retention policies
func GetRetentionPolicies() ([]AuditLogRetention, error) {
	query := `SELECT id, name, description, retention_days, event_types, is_active, created_by, created_at, updated_at 
	          FROM audit_log_retention ORDER BY retention_days DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var policies []AuditLogRetention
	for rows.Next() {
		var p AuditLogRetention
		var eventTypesJSON string
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.RetentionDays, &eventTypesJSON, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}
	return policies, nil
}

// GetRetentionPolicym retrieves a single retention policy
func GetRetentionPolicym(id string) (*AuditLogRetention, error) {
	var p AuditLogRetention
	var eventTypesJSON string
	query := `SELECT id, name, description, retention_days, event_types, is_active, created_by, created_at, updated_at 
	          FROM audit_log_retention WHERE id = ?`
	err := DB.QueryRow(query, id).Scan(&p.ID, &p.Name, &p.Description, &p.RetentionDays, &eventTypesJSON, &p.IsActive, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateRetentionPolicym updates an existing retention policy
func UpdateRetentionPolicym(p AuditLogRetention) error {
	query := `UPDATE audit_log_retention SET name=?, description=?, retention_days=?, is_active=?, updated_at=? WHERE id=?`
	_, err := DB.Exec(query, p.Name, p.Description, p.RetentionDays, p.IsActive, time.Now().UTC().Format(time.RFC3339), p.ID)
	return err
}

// DeleteRetentionPolicym deletes a retention policy
func DeleteRetentionPolicym(id string) error {
	_, err := DB.Exec(`DELETE FROM audit_log_retention WHERE id = ? AND id != 'retention-default'`)
	return err
}

// GetRetentionDaysForEvent returns the retention period for a specific event type
func GetRetentionDaysForEvent(eventType string) (int, error) {
	// Query for matching event type first, then fallback to wildcard
	query := `SELECT retention_days FROM audit_log_retention 
	          WHERE is_active = 1 
	          AND (event_types LIKE '%"%"%' OR event_types LIKE '%` + eventType + `%')
	          ORDER BY 
	            CASE 
	              WHEN event_types LIKE '%` + eventType + `%' THEN 1
	              ELSE 2
	            END,
	            retention_days DESC
	          LIMIT 1`
	
	var retentionDays int
	err := DB.QueryRow(query).Scan(&retentionDays)
	if err != nil {
		return 90, fmt.Errorf("using default retention: %w", err)
	}
	return retentionDays, nil
}

// CleanupOldAuditLogs deletes audit logs older than their retention period
func CleanupOldAuditLogs() (int64, error) {
	var totalDeleted int64

	// Get all active retention policies
	policies, err := GetRetentionPolicies()
	if err != nil {
		return 0, err
	}

	for _, policy := range policies {
		cutoff := time.Now().UTC().AddDate(0, 0, -policy.RetentionDays).Format(time.RFC3339)
		
		// Delete old logs for each event type in the policy
		for _, eventType := range policy.EventTypes {
			var result interface{}
			if eventType == "*" {
				result, err = DB.Exec(`DELETE FROM audit_logs WHERE created_at < ?`, cutoff)
			} else {
				result, err = DB.Exec(`DELETE FROM audit_logs WHERE event_type = ? AND created_at < ?`, eventType, cutoff)
			}
			
			if err != nil {
				continue
			}
			
			if res, ok := result.(interface{ RowsAffected() (int64, error) }); ok {
				if deleted, err := res.RowsAffected(); err == nil {
					totalDeleted += deleted
				}
			}
		}
	}

	return totalDeleted, nil
}
