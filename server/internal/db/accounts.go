package db

import (
	"database/sql"
	"encoding/json"
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

	tagsJSON, _ := json.Marshal(a.Tags)

	query := `INSERT INTO service_accounts (
		id, project_id, agent_id, type, name, host, port, database_name, username, password, role, target_entity, vhost, endpoint, access_key, secret_key, bucket, root_path, app_name, script, cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain, tags, created_at
	) VALUES (
		?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
	)`

	// Use NullString for project ID to allow independent accounts
	var projectID sql.NullString
	if a.ProjectID != "" {
		projectID = sql.NullString{String: a.ProjectID, Valid: true}
	} else {
		projectID = sql.NullString{Valid: false}
	}

	_, err := DB.Exec(query,
		a.ID, projectID, a.AgentID, a.Type, a.Name,
		a.Host, a.Port, a.Database, a.Username, a.Password,
		a.Role, a.TargetEntity,
		a.VHost, a.Endpoint, a.AccessKey, a.SecretKey, a.Bucket,
		a.RootPath, a.AppName, a.Script, a.Cwd,
		a.PM2Port, a.PM2ProxyType, a.PM2ProxyDomain,
		string(tagsJSON), a.CreatedAt,
	)
	if err != nil {
		return a, err
	}
	return a, nil
}

func GetServiceAccounts(projectIDFilter string) ([]models.ServiceAccount, error) {
	query := `SELECT 
		id, project_id, agent_id, type, name, host, port, database_name, username, password, role, target_entity, vhost, endpoint, access_key, secret_key, bucket, root_path, app_name, script, cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain, tags, created_at
	FROM service_accounts
	`

	var args []interface{}
	if projectIDFilter != "" {
		query += " WHERE project_id = ?"
		args = append(args, projectIDFilter)
	}
	query += " ORDER BY created_at DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.ServiceAccount
	for rows.Next() {
		var a models.ServiceAccount
		var pID sql.NullString
		var tagsJSON string

		err := rows.Scan(
			&a.ID, &pID, &a.AgentID, &a.Type, &a.Name,
			&a.Host, &a.Port, &a.Database, &a.Username, &a.Password,
			&a.Role, &a.TargetEntity,
			&a.VHost, &a.Endpoint, &a.AccessKey, &a.SecretKey, &a.Bucket,
			&a.RootPath, &a.AppName, &a.Script, &a.Cwd,
			&a.PM2Port, &a.PM2ProxyType, &a.PM2ProxyDomain,
			&tagsJSON, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if pID.Valid {
			a.ProjectID = pID.String
		}

		if tagsJSON != "" {
			json.Unmarshal([]byte(tagsJSON), &a.Tags)
		} else {
			a.Tags = []string{}
		}

		accounts = append(accounts, a)
	}
	return accounts, nil
}

func UpdateServiceAccount(a models.ServiceAccount) error {
	tagsJSON, _ := json.Marshal(a.Tags)

	var projectID sql.NullString
	if a.ProjectID != "" {
		projectID = sql.NullString{String: a.ProjectID, Valid: true}
	} else {
		projectID = sql.NullString{Valid: false}
	}

	query := `UPDATE service_accounts SET 
		project_id = ?, agent_id = ?, type = ?, name = ?, host = ?, port = ?, database_name = ?, username = ?, password = ?, role = ?, target_entity = ?, vhost = ?, endpoint = ?, access_key = ?, secret_key = ?, bucket = ?, root_path = ?, app_name = ?, script = ?, cwd = ?, pm2_port = ?, pm2_proxy_type = ?, pm2_proxy_domain = ?, tags = ?
	WHERE id = ?`

	_, err := DB.Exec(query,
		projectID, a.AgentID, a.Type, a.Name,
		a.Host, a.Port, a.Database, a.Username, a.Password,
		a.Role, a.TargetEntity,
		a.VHost, a.Endpoint, a.AccessKey, a.SecretKey, a.Bucket,
		a.RootPath, a.AppName, a.Script, a.Cwd,
		a.PM2Port, a.PM2ProxyType, a.PM2ProxyDomain,
		string(tagsJSON), a.ID,
	)
	return err
}

func DeleteServiceAccount(id string) error {
	query := `DELETE FROM service_accounts WHERE id = ?`
	_, err := DB.Exec(query, id)
	return err
}
