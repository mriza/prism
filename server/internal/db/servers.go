package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"prism-server/internal/models"
	"time"

	"github.com/google/uuid"
)

// Server operations

func CreateServer(s models.Server) (models.Server, error) {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	if s.CreatedAt == "" {
		s.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if s.UpdatedAt == "" {
		s.UpdatedAt = s.CreatedAt
	}
	if s.Status == "" {
		s.Status = "pending"
	}

	runtimesJSON := "[]"
	if len(s.Runtimes) > 0 {
		if b, err := json.Marshal(s.Runtimes); err == nil {
			runtimesJSON = string(b)
		}
	}

	query := `INSERT INTO servers (id, name, description, hostname, ip_address, os, os_info, status, agent_version, last_heartbeat, runtimes, created_at, updated_at) 
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query, s.ID, s.Name, s.Description, s.Hostname, s.IPAddress, s.OS, s.OSInfo, s.Status, s.AgentVersion, s.LastHeartbeat, runtimesJSON, s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return s, err
	}

	invalidateCache(context.Background(), "servers:all")
	return s, nil
}

func GetServers() ([]models.Server, error) {
	ctx := context.Background()

	// Try cache first
	if CacheClient != nil {
		var cached []models.Server
		if err := CacheClient.Get(ctx, "servers:all", &cached); err == nil {
			log.Printf("[CACHE HIT] servers:all")
			return cached, nil
		}
		log.Printf("[CACHE MISS] servers:all")
	}

	query := `SELECT id, name, description, hostname, ip_address, os, os_info, status, agent_version, last_heartbeat, runtimes, created_at, updated_at 
	FROM servers ORDER BY created_at DESC`

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []models.Server
	for rows.Next() {
		var s models.Server
		var runtimesJSON sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Hostname, &s.IPAddress, &s.OS, &s.OSInfo, &s.Status, &s.AgentVersion, &s.LastHeartbeat, &runtimesJSON, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		if runtimesJSON.Valid && runtimesJSON.String != "" {
			json.Unmarshal([]byte(runtimesJSON.String), &s.Runtimes)
		}
		servers = append(servers, s)
	}

	// Cache result
	if CacheClient != nil && len(servers) > 0 {
		CacheClient.Set(ctx, "servers:all", servers, CacheTTL)
	}

	return servers, nil
}

func GetServerByID(id string) (*models.Server, error) {
	query := `SELECT id, name, description, hostname, ip_address, os, os_info, status, agent_version, last_heartbeat, runtimes, created_at, updated_at 
	FROM servers WHERE id = ?`

	row := DB.QueryRow(query, id)
	var s models.Server

	var runtimesJSON sql.NullString
	err := row.Scan(&s.ID, &s.Name, &s.Description, &s.Hostname, &s.IPAddress, &s.OS, &s.OSInfo, &s.Status, &s.AgentVersion, &s.LastHeartbeat, &runtimesJSON, &s.CreatedAt, &s.UpdatedAt)
	if err == nil && runtimesJSON.Valid && runtimesJSON.String != "" {
		json.Unmarshal([]byte(runtimesJSON.String), &s.Runtimes)
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &s, nil
}

func GetServerByHostname(hostname string) (*models.Server, error) {
	query := `SELECT id, name, description, hostname, ip_address, os, os_info, status, agent_version, last_heartbeat, runtimes, created_at, updated_at 
	FROM servers WHERE hostname = ?`

	row := DB.QueryRow(query, hostname)
	var s models.Server

	var runtimesJSON sql.NullString
	err := row.Scan(&s.ID, &s.Name, &s.Description, &s.Hostname, &s.IPAddress, &s.OS, &s.OSInfo, &s.Status, &s.AgentVersion, &s.LastHeartbeat, &runtimesJSON, &s.CreatedAt, &s.UpdatedAt)
	if err == nil && runtimesJSON.Valid && runtimesJSON.String != "" {
		json.Unmarshal([]byte(runtimesJSON.String), &s.Runtimes)
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &s, nil
}

func UpdateServerStatus(id string, status string, name string, description string) error {
	query := `UPDATE servers SET status = ?, name = ?, description = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, status, name, description, time.Now().UTC().Format(time.RFC3339), id)
	if err == nil {
		invalidateCache(context.Background(), "servers:all")
	}
	return err
}

func UpdateServerHeartbeat(id string, osInfo string, agentVersion string, runtimes []models.RuntimeInfo) error {
	runtimesJSON := "[]"
	if len(runtimes) > 0 {
		if b, err := json.Marshal(runtimes); err == nil {
			runtimesJSON = string(b)
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE servers SET last_heartbeat = ?, os_info = ?, agent_version = ?, runtimes = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, now, osInfo, agentVersion, runtimesJSON, now, id)
	return err
}

func DeleteServer(id string) error {
	query := `DELETE FROM servers WHERE id = ?`
	_, err := DB.Exec(query, id)
	if err == nil {
		invalidateCache(context.Background(), "servers:all")
	}
	return err
}

// Service operations

func CreateService(svc models.Service) (models.Service, error) {
	if svc.ID == "" {
		svc.ID = uuid.NewString()
	}
	if svc.DiscoveredAt == "" {
		svc.DiscoveredAt = time.Now().UTC().Format(time.RFC3339)
	}
	svc.UpdatedAt = svc.DiscoveredAt

	query := `INSERT INTO services (id, server_id, name, type, version, port, status, config_path, pid, discovered_at, updated_at, category) 
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query, svc.ID, svc.ServerID, svc.Name, svc.Type, svc.Version, svc.Port, svc.Status, svc.ConfigPath, svc.PID, svc.DiscoveredAt, svc.UpdatedAt, svc.Category)
	if err != nil {
		return svc, err
	}

	invalidateCache(context.Background(), "services:server:"+svc.ServerID)
	return svc, nil
}

func GetServicesByServerID(serverID string) ([]models.Service, error) {
	ctx := context.Background()
	cacheKey := "services:server:" + serverID

	// Try cache first
	if CacheClient != nil {
		var cached []models.Service
		if err := CacheClient.Get(ctx, cacheKey, &cached); err == nil {
			log.Printf("[CACHE HIT] %s", cacheKey)
			return cached, nil
		}
		log.Printf("[CACHE MISS] %s", cacheKey)
	}

	query := `SELECT id, server_id, name, type, version, port, status, config_path, pid, discovered_at, updated_at, category 
	FROM services WHERE server_id = ? ORDER BY type, name`

	rows, err := DB.Query(query, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		if err := rows.Scan(&s.ID, &s.ServerID, &s.Name, &s.Type, &s.Version, &s.Port, &s.Status, &s.ConfigPath, &s.PID, &s.DiscoveredAt, &s.UpdatedAt, &s.Category); err != nil {
			return nil, err
		}
		services = append(services, s)
	}

	// Cache result
	if CacheClient != nil && len(services) > 0 {
		CacheClient.Set(ctx, cacheKey, services, CacheTTL)
	}

	return services, nil
}

func GetServiceByServerAndName(serverID string, name string) (*models.Service, error) {
	query := `SELECT id, server_id, name, type, version, port, status, config_path, pid, discovered_at, updated_at, category 
	FROM services WHERE server_id = ? AND name = ? LIMIT 1`

	row := DB.QueryRow(query, serverID, name)
	var s models.Service

	err := row.Scan(&s.ID, &s.ServerID, &s.Name, &s.Type, &s.Version, &s.Port, &s.Status, &s.ConfigPath, &s.PID, &s.DiscoveredAt, &s.UpdatedAt, &s.Category)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &s, nil
}

func UpdateServiceStatus(id string, status string) error {
	query := `UPDATE services SET status = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, status, time.Now().UTC().Format(time.RFC3339), id)
	return err
}

func DeleteService(id string) error {
	query := `DELETE FROM services WHERE id = ?`
	_, err := DB.Exec(query, id)
	return err
}

// Command operations

func CreateCommand(cmd models.Command) (models.Command, error) {
	if cmd.ID == "" {
		cmd.ID = uuid.NewString()
	}
	if cmd.IssuedAt.IsZero() {
		cmd.IssuedAt = time.Now()
	}

	payloadJSON := "{}"
	if cmd.Payload != nil {
		if b, err := json.Marshal(cmd.Payload); err == nil {
			payloadJSON = string(b)
		}
	}

	resultJSON := "{}"
	if cmd.Result != nil {
		if b, err := json.Marshal(cmd.Result); err == nil {
			resultJSON = string(b)
		}
	}

	query := `INSERT INTO commands (id, server_id, service_id, type, payload, status, issued_by, issued_at, executed_at, result, error) 
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	var executedAt sql.NullString
	if cmd.ExecutedAt != nil {
		executedAt = sql.NullString{String: cmd.ExecutedAt.Format(time.RFC3339), Valid: true}
	}

	_, err := DB.Exec(query, cmd.ID, cmd.ServerID, cmd.ServiceID, cmd.Type, payloadJSON, cmd.Status, cmd.IssuedBy, cmd.IssuedAt.Format(time.RFC3339), executedAt, resultJSON, cmd.Error)
	if err != nil {
		return cmd, err
	}

	return cmd, nil
}

func GetCommandByID(id string) (*models.Command, error) {
	query := `SELECT id, server_id, service_id, type, payload, status, issued_by, issued_at, executed_at, result, error 
	FROM commands WHERE id = ?`

	row := DB.QueryRow(query, id)
	var cmd models.Command

	var payloadJSON, resultJSON, executedAtNull sql.NullString
	err := row.Scan(&cmd.ID, &cmd.ServerID, &cmd.ServiceID, &cmd.Type, &payloadJSON, &cmd.Status, &cmd.IssuedBy, &cmd.IssuedAt, &executedAtNull, &resultJSON, &cmd.Error)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if payloadJSON.Valid {
		json.Unmarshal([]byte(payloadJSON.String), &cmd.Payload)
	}
	if resultJSON.Valid {
		json.Unmarshal([]byte(resultJSON.String), &cmd.Result)
	}
	if executedAtNull.Valid {
		t, _ := time.Parse(time.RFC3339, executedAtNull.String)
		cmd.ExecutedAt = &t
	}

	return &cmd, nil
}

func GetCommandsByServerID(serverID string, limit int) ([]models.Command, error) {
	query := `SELECT id, server_id, service_id, type, payload, status, issued_by, issued_at, executed_at, result, error 
	FROM commands WHERE server_id = ? ORDER BY issued_at DESC LIMIT ?`

	rows, err := DB.Query(query, serverID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var commands []models.Command
	for rows.Next() {
		var cmd models.Command
		var payloadJSON, resultJSON, executedAtNull sql.NullString

		err := rows.Scan(&cmd.ID, &cmd.ServerID, &cmd.ServiceID, &cmd.Type, &payloadJSON, &cmd.Status, &cmd.IssuedBy, &cmd.IssuedAt, &executedAtNull, &resultJSON, &cmd.Error)
		if err != nil {
			return nil, err
		}

		if payloadJSON.Valid {
			json.Unmarshal([]byte(payloadJSON.String), &cmd.Payload)
		}
		if resultJSON.Valid {
			json.Unmarshal([]byte(resultJSON.String), &cmd.Result)
		}
		if executedAtNull.Valid {
			t, _ := time.Parse(time.RFC3339, executedAtNull.String)
			cmd.ExecutedAt = &t
		}

		commands = append(commands, cmd)
	}

	return commands, nil
}

func UpdateCommandStatus(id string, status string, result map[string]interface{}, errMsg string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	resultJSON := "{}"
	if result != nil {
		if b, err := json.Marshal(result); err == nil {
			resultJSON = string(b)
		}
	}

	query := `UPDATE commands SET status = ?, executed_at = ?, result = ?, error = ? WHERE id = ?`
	_, err := DB.Exec(query, status, now, resultJSON, errMsg, id)
	return err
}

// Audit Log operations

func CreateAuditLog(audit models.AuditLog) (models.AuditLog, error) {
	if audit.Timestamp.IsZero() {
		audit.Timestamp = time.Now()
	}

	detailsJSON := "{}"
	if audit.Details != nil {
		if b, err := json.Marshal(audit.Details); err == nil {
			detailsJSON = string(b)
		}
	}

	query := `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, timestamp) 
	VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query, audit.UserID, audit.Action, audit.ResourceType, audit.ResourceID, detailsJSON, audit.IPAddress, audit.Timestamp.Format(time.RFC3339))
	if err != nil {
		return audit, err
	}

	return audit, nil
}

func GetAuditLogs(limit int, offset int) ([]models.AuditLog, error) {
	query := `SELECT id, user_id, action, resource_type, resource_id, details, ip_address, timestamp 
	FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?`

	rows, err := DB.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var audits []models.AuditLog
	for rows.Next() {
		var audit models.AuditLog
		var detailsJSON sql.NullString
		var userID, resourceID, ipAddress sql.NullString

		err := rows.Scan(&audit.ID, &userID, &audit.Action, &audit.ResourceType, &resourceID, &detailsJSON, &ipAddress, &audit.Timestamp)
		if err != nil {
			return nil, err
		}

		if userID.Valid {
			audit.UserID = userID.String
		}
		if resourceID.Valid {
			audit.ResourceID = resourceID.String
		}
		if ipAddress.Valid {
			audit.IPAddress = ipAddress.String
		}
		if detailsJSON.Valid {
			json.Unmarshal([]byte(detailsJSON.String), &audit.Details)
		}

		audits = append(audits, audit)
	}

	return audits, nil
}

func GetAuditLogsByResource(resourceType string, resourceID string, limit int) ([]models.AuditLog, error) {
	query := `SELECT id, user_id, action, resource_type, resource_id, details, ip_address, timestamp 
	FROM audit_log WHERE resource_type = ? AND resource_id = ? ORDER BY timestamp DESC LIMIT ?`

	rows, err := DB.Query(query, resourceType, resourceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var audits []models.AuditLog
	for rows.Next() {
		var audit models.AuditLog
		var detailsJSON, userID, ipAddress sql.NullString

		err := rows.Scan(&audit.ID, &userID, &audit.Action, &audit.ResourceType, &audit.ResourceID, &detailsJSON, &ipAddress, &audit.Timestamp)
		if err != nil {
			return nil, err
		}

		if userID.Valid {
			audit.UserID = userID.String
		}
		if ipAddress.Valid {
			audit.IPAddress = ipAddress.String
		}
		if detailsJSON.Valid {
			json.Unmarshal([]byte(detailsJSON.String), &audit.Details)
		}

		audits = append(audits, audit)
	}

	return audits, nil
}

// Helper function to log audit trail
func LogAuditAction(userID, action, resourceType, resourceID, ipAddress string, details map[string]interface{}) error {
	audit := models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		IPAddress:    ipAddress,
		Details:      details,
	}
	_, err := CreateAuditLog(audit)
	return err
}

// Project operations with resource summary

func GetProjectWithSummary(projectID string) (*models.Project, *models.ResourceSummary, error) {
	// Get project
	project, err := GetProjectByID(projectID)
	if err != nil {
		return nil, nil, err
	}
	if project == nil {
		return nil, nil, fmt.Errorf("project not found")
	}

	// Get resource counts
	var summary models.ResourceSummary

	// Count accounts
	err = DB.QueryRow(`SELECT COUNT(*) FROM service_accounts WHERE project_id = ?`, projectID).Scan(&summary.Accounts)
	if err != nil {
		return nil, nil, err
	}

	// Count processes (from service_accounts with type='process')
	err = DB.QueryRow(`SELECT COUNT(*) FROM service_accounts WHERE project_id = ? AND type IN ('process', 'pm2', 'supervisor', 'systemd')`, projectID).Scan(&summary.Processes)
	if err != nil {
		return nil, nil, err
	}

	// Count containers (from service_accounts with type='container')
	err = DB.QueryRow(`SELECT COUNT(*) FROM service_accounts WHERE project_id = ? AND type IN ('container', 'docker', 'podman')`, projectID).Scan(&summary.Containers)
	if err != nil {
		return nil, nil, err
	}

	// Count distinct servers
	err = DB.QueryRow(`SELECT COUNT(DISTINCT server_id) FROM service_accounts WHERE project_id = ?`, projectID).Scan(&summary.Servers)
	if err != nil {
		return nil, nil, err
	}

	return project, &summary, nil
}

func UpdateProjectStatus(id string, status string) error {
	query := `UPDATE projects SET status = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, status, time.Now().UTC().Format(time.RFC3339), id)
	return err
}
