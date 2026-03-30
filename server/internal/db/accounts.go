package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"prism-server/internal/models"
	"time"

	"github.com/google/uuid"
)

func CreateServiceAccount(a models.ServiceAccount) (models.ServiceAccount, error) {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	if a.CreatedAt == "" {
		a.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	// Set defaults
	if a.Type == "" {
		a.Type = "user"
	}
	if a.Category == "" {
		a.Category = "independent"
	}
	if a.Status == "" {
		a.Status = "active"
	}

	tagsJSON, _ := json.Marshal(a.Tags)

	configData := map[string]interface{}{
		"databases": a.Databases,
		"bindings":  a.Bindings,
	}
	configJSON, _ := json.Marshal(configData)

	query := `INSERT INTO service_accounts (
		id, project_id, server_id, service_id, type, category, project_name, name, username, permissions, status,
		host, port, database_name, password, role, target_entity, vhost, endpoint, access_key, secret_key, bucket,
		root_path, quota, quota_enabled, app_name, script, cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain,
		tags, config, created_at
	) VALUES (
		?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
	)`

	// Use NullString for optional fields
	var projectID sql.NullString
	if a.ProjectID != "" {
		projectID = sql.NullString{String: a.ProjectID, Valid: true}
	} else {
		projectID = sql.NullString{Valid: false}
	}

	var permissions sql.NullString
	if a.Permissions != "" {
		permissions = sql.NullString{String: a.Permissions, Valid: true}
	} else {
		permissions = sql.NullString{Valid: false}
	}

	_, err := DB.Exec(query,
		a.ID, projectID, a.ServerID, a.ServiceID, a.Type, a.Category, a.ProjectName,
		a.Name, a.Username, permissions, a.Status,
		a.Host, a.Port, a.Database, a.Password, a.Role, a.TargetEntity,
		a.VHost, a.Endpoint, a.AccessKey, a.SecretKey, a.Bucket,
		a.RootPath, a.Quota, a.QuotaEnabled,
		a.AppName, a.Script, a.Cwd,
		a.PM2Port, a.PM2ProxyType, a.PM2ProxyDomain,
		string(tagsJSON), string(configJSON), a.CreatedAt,
	)
	if err != nil {
		return a, err
	}

	invalidateCache(context.Background(), "accounts:all")
	invalidateCache(context.Background(), "accounts:project:"+a.ProjectID)
	return a, nil
}

func GetServiceAccounts(filters ServiceAccountFilters) ([]models.ServiceAccount, error) {
	ctx := context.Background()

	// Build query with dynamic filters
	query := `SELECT
		id, project_id, server_id, service_id, type, category, project_name, name, username, permissions, status, last_activity,
		host, port, database_name, password, role, target_entity, vhost, endpoint, access_key, secret_key, bucket,
		root_path, quota, quota_enabled, app_name, script, cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain,
		tags, config, created_at
	FROM service_accounts WHERE 1=1`

	var args []interface{}
	argCount := 0

	if filters.ProjectID != "" {
		argCount++
		query += " AND project_id = ?"
		args = append(args, filters.ProjectID)
	}

	if filters.ServerID != "" {
		argCount++
		query += " AND server_id = ?"
		args = append(args, filters.ServerID)
	}

	if filters.ServiceID != "" {
		argCount++
		query += " AND service_id = ?"
		args = append(args, filters.ServiceID)
	}

	if filters.Category != "" {
		argCount++
		query += " AND category = ?"
		args = append(args, filters.Category)
	}

	if filters.Type != "" {
		argCount++
		query += " AND type = ?"
		args = append(args, filters.Type)
	}

	if filters.Status != "" {
		argCount++
		query += " AND status = ?"
		args = append(args, filters.Status)
	}

	if filters.Search != "" {
		argCount++
		query += " AND (username LIKE ? OR name LIKE ? OR project_name LIKE ?)"
		searchPattern := "%" + filters.Search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern)
	}

	query += " ORDER BY created_at DESC"

	// Try cache for simple queries
	cacheKey := ""
	if CacheClient != nil {
		if filters.ProjectID != "" && filters.ServerID == "" && filters.Search == "" {
			cacheKey = "accounts:project:" + filters.ProjectID
		} else if filters.ServerID != "" && filters.ProjectID == "" && filters.Search == "" {
			cacheKey = "accounts:server:" + filters.ServerID
		} else {
			cacheKey = "accounts:all"
		}

		if argCount <= 1 { // Only cache simple queries
			var cached []models.ServiceAccount
			if err := CacheClient.Get(ctx, cacheKey, &cached); err == nil {
				log.Printf("[CACHE HIT] %s", cacheKey)
				return cached, nil
			}
			log.Printf("[CACHE MISS] %s", cacheKey)
		}
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.ServiceAccount
	for rows.Next() {
		var a models.ServiceAccount
		var pID, perms, lastAct sql.NullString
		var tagsJSON, configJSON string

		err := rows.Scan(
			&a.ID, &pID, &a.ServerID, &a.ServiceID, &a.Type, &a.Category, &a.ProjectName, &a.Name, &a.Username, &perms, &a.Status, &lastAct,
			&a.Host, &a.Port, &a.Database, &a.Password, &a.Role, &a.TargetEntity,
			&a.VHost, &a.Endpoint, &a.AccessKey, &a.SecretKey, &a.Bucket,
			&a.RootPath, &a.Quota, &a.QuotaEnabled,
			&a.AppName, &a.Script, &a.Cwd,
			&a.PM2Port, &a.PM2ProxyType, &a.PM2ProxyDomain,
			&tagsJSON, &configJSON, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if pID.Valid {
			a.ProjectID = pID.String
		}
		if perms.Valid {
			a.Permissions = perms.String
		}
		if lastAct.Valid {
			a.LastActivity = lastAct.String
		}

		if tagsJSON != "" {
			json.Unmarshal([]byte(tagsJSON), &a.Tags)
		} else {
			a.Tags = []string{}
		}

		if configJSON != "" {
			var config struct {
				Databases []string            `json:"databases"`
				Bindings  []models.RMQBinding `json:"bindings"`
			}
			if err := json.Unmarshal([]byte(configJSON), &config); err == nil {
				a.Databases = config.Databases
				a.Bindings = config.Bindings
			}
		}

		accounts = append(accounts, a)
	}

	// Cache result
	if CacheClient != nil && len(accounts) > 0 && cacheKey != "" {
		CacheClient.Set(ctx, cacheKey, accounts, CacheTTL)
	}

	return accounts, nil
}

func GetServiceAccountByID(id string) (*models.ServiceAccount, error) {
	query := `SELECT
		id, project_id, server_id, service_id, type, category, project_name, name, username, permissions, status, last_activity,
		host, port, database_name, password, role, target_entity, vhost, endpoint, access_key, secret_key, bucket,
		root_path, quota, quota_enabled, app_name, script, cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain,
		tags, config, created_at
	FROM service_accounts WHERE id = ?`

	row := DB.QueryRow(query, id)
	var a models.ServiceAccount
	var pID, perms, lastAct sql.NullString
	var tagsJSON, configJSON string

	err := row.Scan(
		&a.ID, &pID, &a.ServerID, &a.ServiceID, &a.Type, &a.Category, &a.ProjectName, &a.Name, &a.Username, &perms, &a.Status, &lastAct,
		&a.Host, &a.Port, &a.Database, &a.Password, &a.Role, &a.TargetEntity,
		&a.VHost, &a.Endpoint, &a.AccessKey, &a.SecretKey, &a.Bucket,
		&a.RootPath, &a.Quota, &a.QuotaEnabled,
		&a.AppName, &a.Script, &a.Cwd,
		&a.PM2Port, &a.PM2ProxyType, &a.PM2ProxyDomain,
		&tagsJSON, &configJSON, &a.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if pID.Valid {
		a.ProjectID = pID.String
	}
	if perms.Valid {
		a.Permissions = perms.String
	}
	if lastAct.Valid {
		a.LastActivity = lastAct.String
	}

	if tagsJSON != "" {
		json.Unmarshal([]byte(tagsJSON), &a.Tags)
	} else {
		a.Tags = []string{}
	}

	if configJSON != "" {
		var config struct {
			Databases []string            `json:"databases"`
			Bindings  []models.RMQBinding `json:"bindings"`
		}
		if err := json.Unmarshal([]byte(configJSON), &config); err == nil {
			a.Databases = config.Databases
			a.Bindings = config.Bindings
		}
	}

	return &a, nil
}

func UpdateServiceAccount(a models.ServiceAccount) error {
	tagsJSON, _ := json.Marshal(a.Tags)

	configData := map[string]interface{}{
		"databases": a.Databases,
		"bindings":  a.Bindings,
	}
	configJSON, _ := json.Marshal(configData)

	var projectID sql.NullString
	if a.ProjectID != "" {
		projectID = sql.NullString{String: a.ProjectID, Valid: true}
	} else {
		projectID = sql.NullString{Valid: false}
	}

	var permissions sql.NullString
	if a.Permissions != "" {
		permissions = sql.NullString{String: a.Permissions, Valid: true}
	} else {
		permissions = sql.NullString{Valid: false}
	}

	query := `UPDATE service_accounts SET
		project_id = ?, server_id = ?, service_id = ?, type = ?, category = ?, project_name = ?,
		name = ?, username = ?, permissions = ?, status = ?, last_activity = ?,
		host = ?, port = ?, database_name = ?, password = ?, role = ?, target_entity = ?, vhost = ?,
		endpoint = ?, access_key = ?, secret_key = ?, bucket = ?, root_path = ?,
		quota = ?, quota_enabled = ?, app_name = ?, script = ?, cwd = ?,
		pm2_port = ?, pm2_proxy_type = ?, pm2_proxy_domain = ?,
		tags = ?, config = ?
	WHERE id = ?`

	_, err := DB.Exec(query,
		projectID, a.ServerID, a.ServiceID, a.Type, a.Category, a.ProjectName,
		a.Name, a.Username, permissions, a.Status, a.LastActivity,
		a.Host, a.Port, a.Database, a.Password, a.Role, a.TargetEntity,
		a.VHost, a.Endpoint, a.AccessKey, a.SecretKey, a.Bucket,
		a.RootPath, a.Quota, a.QuotaEnabled,
		a.AppName, a.Script, a.Cwd,
		a.PM2Port, a.PM2ProxyType, a.PM2ProxyDomain,
		string(tagsJSON), string(configJSON), a.ID,
	)

	if err == nil {
		invalidateCache(context.Background(), "accounts:all")
		invalidateCache(context.Background(), "accounts:id:"+a.ID)
	}

	return err
}

func UpdateServiceAccountStatus(id string, status string) error {
	query := `UPDATE service_accounts SET status = ?, last_activity = ? WHERE id = ?`
	_, err := DB.Exec(query, status, time.Now().UTC().Format(time.RFC3339), id)
	if err == nil {
		invalidateCache(context.Background(), "accounts:id:"+id)
	}
	return err
}

func DeleteServiceAccount(id string) error {
	query := `DELETE FROM service_accounts WHERE id = ?`
	_, err := DB.Exec(query, id)
	if err == nil {
		invalidateCache(context.Background(), "accounts:all")
		invalidateCache(context.Background(), "accounts:id:"+id)
	}
	return err
}

// Bulk operations for project management

func BulkUpdateAccountsProject(accountIDs []string, projectID string) error {
	if len(accountIDs) == 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Commit()

	for _, id := range accountIDs {
		var projectIDNull sql.NullString
		if projectID != "" {
			projectIDNull = sql.NullString{String: projectID, Valid: true}
		} else {
			projectIDNull = sql.NullString{Valid: false}
		}

		query := `UPDATE service_accounts SET project_id = ?, category = ? WHERE id = ?`
		category := "independent"
		if projectID != "" {
			category = "project"
		}

		_, err := tx.Exec(query, projectIDNull, category, id)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	invalidateCache(context.Background(), "accounts:all")
	return nil
}

func BulkDisableAccounts(accountIDs []string) error {
	if len(accountIDs) == 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Commit()

	for _, id := range accountIDs {
		query := `UPDATE service_accounts SET status = ? WHERE id = ?`
		_, err := tx.Exec(query, "disabled", id)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	invalidateCache(context.Background(), "accounts:all")
	return nil
}

// ServiceAccountFilters for querying accounts
type ServiceAccountFilters struct {
	ProjectID string
	ServerID  string
	ServiceID string
	Category  string // project, independent
	Type      string // user, service_account
	Status    string // active, disabled
	Search    string // search in username, name, project_name
}

// GetAccountsCrossReference returns accounts with full server and service information
func GetAccountsCrossReference(filters ServiceAccountFilters) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			sa.id, sa.username, sa.name, sa.type, sa.category, sa.project_name, sa.status,
			s.name as server_name, s.hostname, s.ip_address,
			svc.name as service_name, svc.type as service_type,
			sa.created_at
		FROM service_accounts sa
		LEFT JOIN servers s ON sa.server_id = s.id
		LEFT JOIN services svc ON sa.service_id = svc.id
		WHERE 1=1`

	var args []interface{}

	if filters.ProjectID != "" {
		query += " AND sa.project_id = ?"
		args = append(args, filters.ProjectID)
	}

	if filters.ServerID != "" {
		query += " AND sa.server_id = ?"
		args = append(args, filters.ServerID)
	}

	if filters.Category != "" {
		query += " AND sa.category = ?"
		args = append(args, filters.Category)
	}

	if filters.Search != "" {
		query += " AND (sa.username LIKE ? OR sa.name LIKE ? OR sa.project_name LIKE ?)"
		searchPattern := "%" + filters.Search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern)
	}

	query += " ORDER BY sa.created_at DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, username, name, accountType, category string
		var projectName, status, serverName, hostname, ipAddress, serviceName, serviceType, createdAt sql.NullString

		err := rows.Scan(&id, &username, &name, &accountType, &category, &projectName, &status,
			&serverName, &hostname, &ipAddress, &serviceName, &serviceType, &createdAt)
		if err != nil {
			return nil, err
		}

		result := map[string]interface{}{
			"id":        id,
			"username":  username,
			"name":      name,
			"type":      accountType,
			"category":  category,
			"status":    status.String,
			"createdAt": createdAt.String,
		}

		if projectName.Valid {
			result["projectName"] = projectName.String
		}
		if serverName.Valid {
			result["serverName"] = serverName.String
		}
		if hostname.Valid {
			result["hostname"] = hostname.String
		}
		if ipAddress.Valid {
			result["ipAddress"] = ipAddress.String
		}
		if serviceName.Valid {
			result["serviceName"] = serviceName.String
		}
		if serviceType.Valid {
			result["serviceType"] = serviceType.String
		}

		results = append(results, result)
	}

	return results, nil
}

// GetOrphanedAccounts returns accounts whose project is completed/archived
func GetOrphanedAccounts() ([]models.ServiceAccount, error) {
	query := `
		SELECT sa.id, sa.project_id, sa.server_id, sa.service_id, sa.type, sa.category, sa.project_name,
			sa.name, sa.username, sa.status, sa.created_at
		FROM service_accounts sa
		INNER JOIN projects p ON sa.project_id = p.id
		WHERE p.status IN ('completed', 'archived') AND sa.status != 'disabled'
	`

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.ServiceAccount
	for rows.Next() {
		var a models.ServiceAccount
		var pID sql.NullString

		err := rows.Scan(&a.ID, &pID, &a.ServerID, &a.ServiceID, &a.Type, &a.Category, &a.ProjectName,
			&a.Name, &a.Username, &a.Status, &a.CreatedAt)
		if err != nil {
			return nil, err
		}

		if pID.Valid {
			a.ProjectID = pID.String
		}

		accounts = append(accounts, a)
	}

	return accounts, nil
}
