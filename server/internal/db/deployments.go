package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"prism-server/internal/models"
	"time"

	"github.com/google/uuid"
)

// DeploymentFilters for querying deployments
type DeploymentFilters struct {
	ProjectID string
	ServerID  string
	Status    string
	Search    string
}

func CreateDeployment(d models.Deployment) (models.Deployment, error) {
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if d.CreatedAt == "" {
		d.CreatedAt = now
	}
	if d.UpdatedAt == "" {
		d.UpdatedAt = now
	}
	if d.Status == "" {
		d.Status = "stopped"
	}

	envVarsJSON, _ := json.Marshal(d.EnvVars)

	query := `INSERT INTO deployments (
		id, project_id, server_id, name, description, source_url, source_token,
		runtime, runtime_version, process_manager, start_command, env_vars,
		domain_name, internal_port, proxy_type, status,
		last_deployed_revision, last_deployed_at, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query,
		d.ID, d.ProjectID, d.ServerID, d.Name, d.Description,
		d.SourceURL, d.SourceToken,
		d.Runtime, d.RuntimeVersion, d.ProcessManager, d.StartCommand,
		string(envVarsJSON),
		d.DomainName, d.InternalPort, d.ProxyType, d.Status,
		d.LastDeployedRevision, d.LastDeployedAt, d.CreatedAt, d.UpdatedAt,
	)
	if err != nil {
		return d, err
	}

	invalidateCache(context.Background(), "deployments:all")
	invalidateCache(context.Background(), "deployments:project:"+d.ProjectID)
	return d, nil
}

func GetDeployments(filters DeploymentFilters) ([]models.Deployment, error) {
	query := `SELECT
		id, project_id, server_id, name, description, source_url, source_token,
		runtime, runtime_version, process_manager, start_command, env_vars,
		domain_name, internal_port, proxy_type, status,
		last_deployed_revision, last_deployed_at, created_at, updated_at
	FROM deployments WHERE 1=1`

	var args []interface{}

	if filters.ProjectID != "" {
		query += " AND project_id = ?"
		args = append(args, filters.ProjectID)
	}
	if filters.ServerID != "" {
		query += " AND server_id = ?"
		args = append(args, filters.ServerID)
	}
	if filters.Status != "" {
		query += " AND status = ?"
		args = append(args, filters.Status)
	}
	if filters.Search != "" {
		query += " AND (name LIKE ? OR description LIKE ? OR domain_name LIKE ?)"
		sp := "%" + filters.Search + "%"
		args = append(args, sp, sp, sp)
	}

	query += " ORDER BY created_at DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deployments []models.Deployment
	for rows.Next() {
		d, err := scanDeployment(rows)
		if err != nil {
			return nil, err
		}
		deployments = append(deployments, d)
	}

	return deployments, nil
}

func GetDeploymentByID(id string) (*models.Deployment, error) {
	query := `SELECT
		id, project_id, server_id, name, description, source_url, source_token,
		runtime, runtime_version, process_manager, start_command, env_vars,
		domain_name, internal_port, proxy_type, status,
		last_deployed_revision, last_deployed_at, created_at, updated_at
	FROM deployments WHERE id = ?`

	row := DB.QueryRow(query, id)

	var d models.Deployment
	var envVarsJSON string
	var desc, srcToken, rtVersion, domainName, proxyType, lastRev, lastDeployedAt sql.NullString

	err := row.Scan(
		&d.ID, &d.ProjectID, &d.ServerID, &d.Name, &desc,
		&d.SourceURL, &srcToken,
		&d.Runtime, &rtVersion, &d.ProcessManager, &d.StartCommand, &envVarsJSON,
		&domainName, &d.InternalPort, &proxyType, &d.Status,
		&lastRev, &lastDeployedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if desc.Valid { d.Description = desc.String }
	if srcToken.Valid { d.SourceToken = srcToken.String }
	if rtVersion.Valid { d.RuntimeVersion = rtVersion.String }
	if domainName.Valid { d.DomainName = domainName.String }
	if proxyType.Valid { d.ProxyType = proxyType.String }
	if lastRev.Valid { d.LastDeployedRevision = lastRev.String }
	if lastDeployedAt.Valid { d.LastDeployedAt = lastDeployedAt.String }

	if envVarsJSON != "" {
		json.Unmarshal([]byte(envVarsJSON), &d.EnvVars)
	}

	return &d, nil
}

func UpdateDeployment(d models.Deployment) error {
	d.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	envVarsJSON, _ := json.Marshal(d.EnvVars)

	query := `UPDATE deployments SET
		project_id = ?, server_id = ?, name = ?, description = ?,
		source_url = ?, source_token = ?,
		runtime = ?, runtime_version = ?, process_manager = ?, start_command = ?, env_vars = ?,
		domain_name = ?, internal_port = ?, proxy_type = ?,
		status = ?, last_deployed_revision = ?, last_deployed_at = ?, updated_at = ?
	WHERE id = ?`

	_, err := DB.Exec(query,
		d.ProjectID, d.ServerID, d.Name, d.Description,
		d.SourceURL, d.SourceToken,
		d.Runtime, d.RuntimeVersion, d.ProcessManager, d.StartCommand, string(envVarsJSON),
		d.DomainName, d.InternalPort, d.ProxyType,
		d.Status, d.LastDeployedRevision, d.LastDeployedAt, d.UpdatedAt,
		d.ID,
	)
	if err == nil {
		invalidateCache(context.Background(), "deployments:all")
		invalidateCache(context.Background(), "deployments:id:"+d.ID)
	}
	return err
}

func UpdateDeploymentStatus(id, status, revision string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE deployments SET status = ?, last_deployed_revision = ?, last_deployed_at = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, status, revision, now, now, id)
	if err == nil {
		invalidateCache(context.Background(), "deployments:id:"+id)
		invalidateCache(context.Background(), "deployments:all")
	}
	return err
}

func DeleteDeployment(id string) error {
	_, err := DB.Exec(`DELETE FROM deployments WHERE id = ?`, id)
	if err == nil {
		invalidateCache(context.Background(), "deployments:all")
		invalidateCache(context.Background(), "deployments:id:"+id)
	}
	return err
}

// scanDeployment scans a deployment row into a models.Deployment
func scanDeployment(rows *sql.Rows) (models.Deployment, error) {
	var d models.Deployment
	var envVarsJSON string
	var desc, srcToken, rtVersion, domainName, proxyType, lastRev, lastDeployedAt sql.NullString

	err := rows.Scan(
		&d.ID, &d.ProjectID, &d.ServerID, &d.Name, &desc,
		&d.SourceURL, &srcToken,
		&d.Runtime, &rtVersion, &d.ProcessManager, &d.StartCommand, &envVarsJSON,
		&domainName, &d.InternalPort, &proxyType, &d.Status,
		&lastRev, &lastDeployedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return d, err
	}

	if desc.Valid { d.Description = desc.String }
	if srcToken.Valid { d.SourceToken = srcToken.String }
	if rtVersion.Valid { d.RuntimeVersion = rtVersion.String }
	if domainName.Valid { d.DomainName = domainName.String }
	if proxyType.Valid { d.ProxyType = proxyType.String }
	if lastRev.Valid { d.LastDeployedRevision = lastRev.String }
	if lastDeployedAt.Valid { d.LastDeployedAt = lastDeployedAt.String }

	if envVarsJSON != "" {
		json.Unmarshal([]byte(envVarsJSON), &d.EnvVars)
	}

	return d, nil
}
