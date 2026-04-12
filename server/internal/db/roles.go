package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Role represents a custom role with specific permissions
type Role struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"` // List of permission strings
	IsSystem    bool      `json:"isSystem"`    // System roles cannot be deleted
	CreatedAt   string    `json:"createdAt"`
	UpdatedAt   string    `json:"updatedAt"`
	CreatedBy   string    `json:"createdBy"`
}

// RolePermission represents a role-permission mapping
type RolePermission struct {
	RoleID       string `json:"roleId"`
	Permission   string `json:"permission"`
	ResourceType string `json:"resourceType"` // servers, agents, projects, accounts, users, settings, webhooks
	Action       string `json:"action"`       // read, create, update, delete, manage
}

// UserRoleMapping maps users to roles
type UserRoleMapping struct {
	UserID string `json:"userId"`
	RoleID string `json:"roleId"`
}

// InitRolesTable creates the roles table if not exists
func InitRolesTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS roles (
		id TEXT PRIMARY KEY,
		name TEXT UNIQUE NOT NULL,
		description TEXT,
		permissions TEXT NOT NULL DEFAULT '[]',
		is_system BOOLEAN NOT NULL DEFAULT 0,
		created_by TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	
	-- Create default system roles if they don't exist
	INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at) VALUES
	('role-admin', 'admin', 'Full access to all resources', '["servers:*","agents:*","projects:*","accounts:*","users:*","settings:*","webhooks:*"]', 1, datetime('now'), datetime('now')),
	('role-manager', 'manager', 'Can manage servers, agents, projects but not users', '["servers:*","agents:*","projects:*","accounts:*","settings:read"]', 1, datetime('now'), datetime('now')),
	('role-user', 'user', 'Read-only access to most resources', '["servers:read","agents:read","projects:read","accounts:read"]', 1, datetime('now'), datetime('now')),
	('role-auditor', 'auditor', 'Read-only access to all resources', '["servers:read","agents:read","projects:read","accounts:read","users:read","settings:read","webhooks:read"]', 1, datetime('now'), datetime('now'));
	`
	_, err := DB.Exec(query)
	return err
}

// InitUserRolesTable creates the user-role mapping table
func InitUserRolesTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS user_roles (
		user_id TEXT NOT NULL,
		role_id TEXT NOT NULL,
		assigned_by TEXT,
		assigned_at TEXT NOT NULL,
		PRIMARY KEY (user_id, role_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
	CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
	
	-- Map existing admin users to admin role
	INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by, assigned_at)
	SELECT id, 'role-admin', 'system', datetime('now') FROM users WHERE role = 'admin';
	
	-- Map existing manager users to manager role
	INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by, assigned_at)
	SELECT id, 'role-manager', 'system', datetime('now') FROM users WHERE role = 'manager';
	
	-- Map existing user users to user role
	INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by, assigned_at)
	SELECT id, 'role-user', 'system', datetime('now') FROM users WHERE role = 'user';
	`
	_, err := DB.Exec(query)
	return err
}

// CreateRole creates a new custom role
func CreateRole(r Role) error {
	permissionsJSON, err := json.Marshal(r.Permissions)
	if err != nil {
		return fmt.Errorf("failed to marshal permissions: %w", err)
	}

	query := `INSERT INTO roles (id, name, description, permissions, is_system, created_by, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = DB.Exec(query, r.ID, r.Name, r.Description, string(permissionsJSON), r.IsSystem, r.CreatedBy, r.CreatedAt, r.UpdatedAt)
	return err
}

// GetRole retrieves a role by ID
func GetRole(id string) (*Role, error) {
	var r Role
	var permsJSON string
	query := `SELECT id, name, description, permissions, is_system, created_by, created_at, updated_at FROM roles WHERE id = ?`
	err := DB.QueryRow(query, id).Scan(&r.ID, &r.Name, &r.Description, &permsJSON, &r.IsSystem, &r.CreatedBy, &r.CreatedAt, &r.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal([]byte(permsJSON), &r.Permissions); err != nil {
		return nil, err
	}
	return &r, nil
}

// GetAllRoles retrieves all roles
func GetAllRoles() ([]Role, error) {
	query := `SELECT id, name, description, permissions, is_system, created_by, created_at, updated_at FROM roles ORDER BY is_system DESC, name ASC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []Role
	for rows.Next() {
		var r Role
		var permsJSON string
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &permsJSON, &r.IsSystem, &r.CreatedBy, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(permsJSON), &r.Permissions); err != nil {
			return nil, err
		}
		roles = append(roles, r)
	}
	return roles, nil
}

// UpdateRole updates an existing role
func UpdateRole(r Role) error {
	permissionsJSON, err := json.Marshal(r.Permissions)
	if err != nil {
		return fmt.Errorf("failed to marshal permissions: %w", err)
	}

	query := `UPDATE roles SET name=?, description=?, permissions=?, updated_at=? WHERE id=? AND is_system=0`
	res, err := DB.Exec(query, r.Name, r.Description, string(permissionsJSON), time.Now().UTC().Format(time.RFC3339), r.ID)
	if err != nil {
		return err
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("cannot update system role or role not found")
	}
	return nil
}

// DeleteRole deletes a custom role (system roles cannot be deleted)
func DeleteRole(id string) error {
	// Check if system role
	var isSystem bool
	if err := DB.QueryRow(`SELECT is_system FROM roles WHERE id = ?`, id).Scan(&isSystem); err != nil {
		return err
	}
	if isSystem {
		return fmt.Errorf("cannot delete system role")
	}

	_, err := DB.Exec(`DELETE FROM roles WHERE id = ?`, id)
	return err
}

// AssignRoleToUser assigns a role to a user
func AssignRoleToUser(userID, roleID, assignedBy string) error {
	query := `INSERT OR REPLACE INTO user_roles (user_id, role_id, assigned_by, assigned_at) VALUES (?, ?, ?, ?)`
	_, err := DB.Exec(query, userID, roleID, assignedBy, time.Now().UTC().Format(time.RFC3339))
	return err
}

// RemoveRoleFromUser removes a role from a user
func RemoveRoleFromUser(userID, roleID string) error {
	// Check if system role
	var isSystem bool
	if err := DB.QueryRow(`SELECT r.is_system FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ? AND ur.role_id = ?`, userID, roleID).Scan(&isSystem); err != nil {
		return err
	}
	if isSystem {
		return fmt.Errorf("cannot remove system role from user")
	}

	_, err := DB.Exec(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`, userID, roleID)
	return err
}

// GetUserRoles retrieves all roles for a user
func GetUserRoles(userID string) ([]Role, error) {
	query := `SELECT r.id, r.name, r.description, r.permissions, r.is_system, r.created_by, r.created_at, r.updated_at 
	          FROM roles r 
	          JOIN user_roles ur ON r.id = ur.role_id 
	          WHERE ur.user_id = ?`
	rows, err := DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []Role
	for rows.Next() {
		var r Role
		var permsJSON string
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &permsJSON, &r.IsSystem, &r.CreatedBy, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(permsJSON), &r.Permissions); err != nil {
			return nil, err
		}
		roles = append(roles, r)
	}
	return roles, nil
}

// CheckUserPermission checks if a user has a specific permission
func CheckUserPermission(userID, resource, action string) (bool, error) {
	permission := fmt.Sprintf("%s:%s", resource, action)
	wildcardPermission := fmt.Sprintf("%s:*", resource)
	allPermission := "*"

	query := `SELECT r.permissions FROM roles r 
	          JOIN user_roles ur ON r.id = ur.role_id 
	          WHERE ur.user_id = ?`
	rows, err := DB.Query(query, userID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var permsJSON string
		if err := rows.Scan(&permsJSON); err != nil {
			return false, err
		}

		var permissions []string
		if err := json.Unmarshal([]byte(permsJSON), &permissions); err != nil {
			return false, err
		}

		for _, p := range permissions {
			if p == allPermission || p == permission || p == wildcardPermission {
				return true, nil
			}
		}
	}

	return false, nil
}

// HasPermission checks if a user has a specific permission
func HasPermission(userID, permission string) (bool, error) {
	query := `SELECT r.permissions FROM roles r 
	          JOIN user_roles ur ON r.id = ur.role_id 
	          WHERE ur.user_id = ?`
	rows, err := DB.Query(query, userID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var permsJSON string
		if err := rows.Scan(&permsJSON); err != nil {
			return false, err
		}

		var permissions []string
		if err := json.Unmarshal([]byte(permsJSON), &permissions); err != nil {
			return false, err
		}

		for _, p := range permissions {
			if p == "*" || p == permission {
				return true, nil
			}
			// Check wildcard (e.g., "servers:*" matches "servers:read")
			if len(p) > 2 && p[len(p)-1] == '*' && p[len(p)-2] == ':' {
				prefix := p[:len(p)-1] // "servers:"
				if len(permission) >= len(prefix) && permission[:len(prefix)] == prefix {
					return true, nil
				}
			}
		}
	}

	return false, nil
}
