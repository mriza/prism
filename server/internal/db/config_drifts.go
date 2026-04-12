package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AgentConfiguration represents the expected configuration for an agent
type AgentConfiguration struct {
	ID           string    `json:"id"`
	AgentID      string    `json:"agentId"`
	AgentName    string    `json:"agentName"`
	Services     string    `json:"services"` // JSON array of expected services
	LastVerified string    `json:"lastVerified"`
	CreatedAt    string    `json:"createdAt"`
	UpdatedAt    string    `json:"updatedAt"`
	CreatedBy    string    `json:"createdBy"`
}

// ConfigurationDrift represents a detected configuration drift
type ConfigurationDrift struct {
	ID           string                 `json:"id"`
	AgentID      string                 `json:"agentId"`
	AgentName    string                 `json:"agentName"`
	DriftType    string                 `json:"driftType"`    // missing_service, extra_service, config_mismatch
	ServiceName  string                 `json:"serviceName"`
	Expected     map[string]interface{} `json:"expected"`
	Actual       map[string]interface{} `json:"actual"`
	Severity     string                 `json:"severity"`     // low, medium, high, critical
	Resolved     bool                   `json:"resolved"`
	ResolvedAt   string                 `json:"resolvedAt,omitempty"`
	ResolvedBy   string                 `json:"resolvedBy,omitempty"`
	DetectedAt   string                 `json:"detectedAt"`
}

// InitConfigDriftTables creates the configuration drift detection tables
func InitConfigDriftTables() error {
	query := `
	CREATE TABLE IF NOT EXISTS agent_configurations (
		id TEXT PRIMARY KEY,
		agent_id TEXT NOT NULL,
		agent_name TEXT,
		services TEXT NOT NULL DEFAULT '[]',
		last_verified TEXT,
		created_by TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_agent_configs_agent ON agent_configurations(agent_id);

	CREATE TABLE IF NOT EXISTS configuration_drifts (
		id TEXT PRIMARY KEY,
		agent_id TEXT NOT NULL,
		agent_name TEXT,
		drift_type TEXT NOT NULL,
		service_name TEXT,
		expected TEXT,
		actual TEXT,
		severity TEXT NOT NULL DEFAULT 'medium',
		resolved BOOLEAN NOT NULL DEFAULT 0,
		resolved_at TEXT,
		resolved_by TEXT,
		detected_at TEXT NOT NULL,
		FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_drifts_agent ON configuration_drifts(agent_id);
	CREATE INDEX IF NOT EXISTS idx_drifts_resolved ON configuration_drifts(resolved);
	CREATE INDEX IF NOT EXISTS idx_drifts_severity ON configuration_drifts(severity);
	`
	_, err := DB.Exec(query)
	return err
}

// CreateAgentConfiguration creates or updates an agent's expected configuration
func CreateAgentConfiguration(config AgentConfiguration) error {
	servicesJSON, err := json.Marshal(config.Services)
	if err != nil {
		return fmt.Errorf("failed to marshal services: %w", err)
	}

	query := `INSERT INTO agent_configurations (id, agent_id, agent_name, services, last_verified, created_by, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	          ON CONFLICT(id) DO UPDATE SET
	          services=excluded.services,
	          agent_name=excluded.agent_name,
	          last_verified=excluded.last_verified,
	          updated_at=excluded.updated_at`
	_, err = DB.Exec(query, config.ID, config.AgentID, config.AgentName, string(servicesJSON), config.LastVerified, config.CreatedBy, config.CreatedAt, config.UpdatedAt)
	return err
}

// GetAgentConfiguration retrieves the expected configuration for an agent
func GetAgentConfiguration(agentID string) (*AgentConfiguration, error) {
	var config AgentConfiguration
	var servicesJSON string
	query := `SELECT id, agent_id, agent_name, services, last_verified, created_by, created_at, updated_at 
	          FROM agent_configurations WHERE agent_id = ?`
	err := DB.QueryRow(query, agentID).Scan(&config.ID, &config.AgentID, &config.AgentName, &servicesJSON, &config.LastVerified, &config.CreatedBy, &config.CreatedAt, &config.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal([]byte(servicesJSON), &config.Services); err != nil {
		return nil, err
	}
	return &config, nil
}

// RecordConfigurationDrift records a detected configuration drift
func RecordConfigurationDrift(drift ConfigurationDrift) error {
	expectedJSON, _ := json.Marshal(drift.Expected)
	actualJSON, _ := json.Marshal(drift.Actual)

	query := `INSERT INTO configuration_drifts (id, agent_id, agent_name, drift_type, service_name, expected, actual, severity, detected_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, drift.ID, drift.AgentID, drift.AgentName, drift.DriftType, drift.ServiceName, string(expectedJSON), string(actualJSON), drift.Severity, drift.DetectedAt)
	return err
}

// ResolveConfigurationDrift marks a drift as resolved
func ResolveConfigurationDrift(driftID, resolvedBy string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE configuration_drifts SET resolved=1, resolved_at=?, resolved_by=? WHERE id=?`
	_, err := DB.Exec(query, now, resolvedBy, driftID)
	return err
}

// GetActiveDrifts retrieves all unresolved configuration drifts
func GetActiveDrifts(agentID string, severity string) ([]ConfigurationDrift, error) {
	query := `SELECT id, agent_id, agent_name, drift_type, service_name, expected, actual, severity, resolved, resolved_at, resolved_by, detected_at 
	          FROM configuration_drifts WHERE resolved = 0`
	args := []interface{}{}

	if agentID != "" {
		query += " AND agent_id = ?"
		args = append(args, agentID)
	}
	if severity != "" {
		query += " AND severity = ?"
		args = append(args, severity)
	}

	query += " ORDER BY detected_at DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drifts []ConfigurationDrift
	for rows.Next() {
		var d ConfigurationDrift
		var expectedJSON, actualJSON string
		var resolvedAt sql.NullString
		var resolvedBy sql.NullString
		if err := rows.Scan(&d.ID, &d.AgentID, &d.AgentName, &d.DriftType, &d.ServiceName, &expectedJSON, &actualJSON, &d.Severity, &d.Resolved, &resolvedAt, &resolvedBy, &d.DetectedAt); err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(expectedJSON), &d.Expected)
		json.Unmarshal([]byte(actualJSON), &d.Actual)
		if resolvedAt.Valid {
			d.ResolvedAt = resolvedAt.String
		}
		if resolvedBy.Valid {
			d.ResolvedBy = resolvedBy.String
		}
		drifts = append(drifts, d)
	}
	return drifts, nil
}

// GetDriftStats returns statistics about configuration drifts
func GetDriftStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	var total, active, resolved, critical, high, medium, low int

	err := DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts`).Scan(&total)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts WHERE resolved = 0`).Scan(&active)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts WHERE resolved = 1`).Scan(&resolved)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts WHERE severity = 'critical'`).Scan(&critical)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts WHERE severity = 'high'`).Scan(&high)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts WHERE severity = 'medium'`).Scan(&medium)
	if err != nil {
		return nil, err
	}
	err = DB.QueryRow(`SELECT COUNT(*) FROM configuration_drifts WHERE severity = 'low'`).Scan(&low)
	if err != nil {
		return nil, err
	}

	stats["total"] = total
	stats["active"] = active
	stats["resolved"] = resolved
	stats["critical"] = critical
	stats["high"] = high
	stats["medium"] = medium
	stats["low"] = low
	if total > 0 {
		stats["resolution_rate"] = float64(resolved) / float64(total) * 100
	} else {
		stats["resolution_rate"] = 0.0
	}

	return stats, nil
}

// CleanupOldDrifts deletes old resolved drifts based on retention period
func CleanupOldDrifts(retentionDays int) (int64, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays).Format(time.RFC3339)
	res, err := DB.Exec(`DELETE FROM configuration_drifts WHERE resolved = 1 AND detected_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
