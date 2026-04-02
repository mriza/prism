package db

import (
	"database/sql"
	"log"
	"prism-server/internal/models"
	"time"

	"github.com/google/uuid"
)

// Permission operations

func CreatePermission(p models.Permission) (models.Permission, error) {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}

	query := `INSERT INTO permissions (id, name, description, resource_type, action, created_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, p.ID, p.Name, p.Description, p.ResourceType, p.Action, p.CreatedAt)
	if err != nil {
		return p, err
	}

	log.Printf("Created permission: %s (%s)", p.Name, p.Action)
	return p, nil
}

func GetPermissionByName(name string) (*models.Permission, error) {
	query := `SELECT id, name, description, resource_type, action, created_at FROM permissions WHERE name = ?`
	row := DB.QueryRow(query, name)

	var p models.Permission
	var createdAt string
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.ResourceType, &p.Action, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	p.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return &p, nil
}

func GetPermissionsByResourceType(resourceType string) ([]models.Permission, error) {
	query := `SELECT id, name, description, resource_type, action, created_at FROM permissions WHERE resource_type = ? ORDER BY name`
	rows, err := DB.Query(query, resourceType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var permissions []models.Permission
	for rows.Next() {
		var p models.Permission
		var createdAt string
		err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.ResourceType, &p.Action, &createdAt)
		if err != nil {
			return nil, err
		}
		p.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		permissions = append(permissions, p)
	}

	return permissions, nil
}

func GetAllPermissions() ([]models.Permission, error) {
	query := `SELECT id, name, description, resource_type, action, created_at FROM permissions ORDER BY resource_type, name`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var permissions []models.Permission
	for rows.Next() {
		var p models.Permission
		var createdAt string
		err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.ResourceType, &p.Action, &createdAt)
		if err != nil {
			return nil, err
		}
		p.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		permissions = append(permissions, p)
	}

	return permissions, nil
}

// Initialize default permissions
func InitializeDefaultPermissions() error {
	defaultPermissions := []struct {
		name         string
		resourceType string
		action       string
		description  string
	}{
		// Server permissions
		{"server.read", "server", "read", "View server details"},
		{"server.write", "server", "write", "Edit server configuration"},
		{"server.delete", "server", "delete", "Delete server"},
		{"server.control", "server", "control", "Start/stop/restart services on server"},

		// Service permissions
		{"service.read", "service", "read", "View service details"},
		{"service.write", "service", "write", "Edit service configuration"},
		{"service.control", "service", "control", "Start/stop/restart service"},

		// Account permissions
		{"account.read", "account", "read", "View accounts"},
		{"account.write", "account", "write", "Create/edit accounts"},
		{"account.delete", "account", "delete", "Delete accounts"},

		// Project permissions
		{"project.read", "project", "read", "View projects"},
		{"project.write", "project", "write", "Create/edit projects"},
		{"project.delete", "project", "delete", "Delete projects"},

		// User permissions
		{"user.read", "user", "read", "View users"},
		{"user.write", "user", "write", "Create/edit users"},
		{"user.delete", "user", "delete", "Delete users"},
	}

	for _, perm := range defaultPermissions {
		existing, _ := GetPermissionByName(perm.name)
		if existing == nil {
			_, err := CreatePermission(models.Permission{
				Name:         perm.name,
				ResourceType: perm.resourceType,
				Action:       perm.action,
				Description:  perm.description,
			})
			if err != nil {
				log.Printf("Warning: failed to create default permission %s: %v", perm.name, err)
			}
		}
	}

	log.Println("Default RBAC permissions initialized")
	return nil
}
