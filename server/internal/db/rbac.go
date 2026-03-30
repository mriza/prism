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

// Role Permission operations

func AssignPermissionToRole(role string, permissionID string, serverGroupID *string) error {
	id := uuid.NewString()
	query := `INSERT INTO role_permissions (id, role, permission_id, server_group_id, created_at) VALUES (?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, id, role, permissionID, serverGroupID, time.Now().UTC())
	return err
}

func RemovePermissionFromRole(role string, permissionID string) error {
	query := `DELETE FROM role_permissions WHERE role = ? AND permission_id = ?`
	_, err := DB.Exec(query, role, permissionID)
	return err
}

func GetPermissionsForRole(role string, serverID *string) ([]models.Permission, error) {
	// If serverID is provided, check both global permissions and server group specific permissions
	var query string
	var args []interface{}

	if serverID != nil {
		query = `
			SELECT DISTINCT p.id, p.name, p.description, p.resource_type, p.action, p.created_at
			FROM permissions p
			INNER JOIN role_permissions rp ON p.id = rp.permission_id
			LEFT JOIN server_group_members sgm ON rp.server_group_id = sgm.group_id
			WHERE rp.role = ? AND (rp.server_group_id IS NULL OR sgm.server_id = ?)
			ORDER BY p.resource_type, p.name
		`
		args = []interface{}{role, *serverID}
	} else {
		query = `
			SELECT p.id, p.name, p.description, p.resource_type, p.action, p.created_at
			FROM permissions p
			INNER JOIN role_permissions rp ON p.id = rp.permission_id
			WHERE rp.role = ? AND rp.server_group_id IS NULL
			ORDER BY p.resource_type, p.name
		`
		args = []interface{}{role}
	}

	rows, err := DB.Query(query, args...)
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

// User Server Access operations

func GrantUserServerAccess(userID, serverID, accessLevel, grantedBy string, expiresAt *time.Time) error {
	id := uuid.NewString()
	query := `INSERT INTO user_server_access (id, user_id, server_id, access_level, granted_by, granted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`

	var expiresAtStr sql.NullString
	if expiresAt != nil {
		expiresAtStr = sql.NullString{String: expiresAt.Format(time.RFC3339), Valid: true}
	}

	_, err := DB.Exec(query, id, userID, serverID, accessLevel, grantedBy, time.Now().UTC(), expiresAtStr)
	return err
}

func RevokeUserServerAccess(userID, serverID string) error {
	query := `DELETE FROM user_server_access WHERE user_id = ? AND server_id = ?`
	_, err := DB.Exec(query, userID, serverID)
	return err
}

func GetUserServerAccess(userID string) ([]models.UserServerAccess, error) {
	query := `SELECT id, user_id, server_id, access_level, granted_by, granted_at, expires_at FROM user_server_access WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)`
	rows, err := DB.Query(query, userID, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accesses []models.UserServerAccess
	for rows.Next() {
		var a models.UserServerAccess
		var grantedAt, expiresAtNull sql.NullString
		err := rows.Scan(&a.ID, &a.UserID, &a.ServerID, &a.AccessLevel, &a.GrantedBy, &grantedAt, &expiresAtNull)
		if err != nil {
			return nil, err
		}
		if grantedAt.Valid {
			a.GrantedAt, _ = time.Parse(time.RFC3339, grantedAt.String)
		}
		if expiresAtNull.Valid {
			t, _ := time.Parse(time.RFC3339, expiresAtNull.String)
			a.ExpiresAt = &t
		}
		accesses = append(accesses, a)
	}

	return accesses, nil
}

func CheckUserServerAccess(userID, serverID, requiredAction string) (bool, error) {
	// Get user's role first
	user, err := GetUserByID(userID)
	if err != nil || user == nil {
		return false, err
	}

	// Get permissions for this user's role on this server
	permissions, err := GetPermissionsForRole(user.Role, &serverID)
	if err != nil {
		return false, err
	}

	// Check if any permission grants the required action
	for _, p := range permissions {
		if p.Action == requiredAction || p.Action == "*" {
			return true, nil
		}
	}

	// Also check direct user_server_access
	query := `SELECT access_level FROM user_server_access WHERE user_id = ? AND server_id = ? AND (expires_at IS NULL OR expires_at > ?)`
	row := DB.QueryRow(query, userID, serverID, time.Now().UTC())

	var accessLevel string
	err = row.Scan(&accessLevel)
	if err == nil {
		// Map access levels to actions
		actionMap := map[string][]string{
			"view":  {"read", "list"},
			"edit":  {"read", "list", "write", "update"},
			"admin": {"*"},
		}
		if actions, ok := actionMap[accessLevel]; ok {
			for _, action := range actions {
				if action == requiredAction {
					return true, nil
				}
			}
		}
	}

	return false, nil
}

// Server Group operations

func CreateServerGroup(name, description, createdBy string) (models.ServerGroup, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	group := models.ServerGroup{
		ID:          id,
		Name:        name,
		Description: description,
		CreatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	query := `INSERT INTO server_groups (id, name, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, group.ID, group.Name, group.Description, group.CreatedBy, group.CreatedAt, group.UpdatedAt)
	if err != nil {
		return group, err
	}

	return group, nil
}

func AddServerToGroup(groupID, serverID string) error {
	id := uuid.NewString()
	query := `INSERT INTO server_group_members (id, group_id, server_id, created_at) VALUES (?, ?, ?, ?)`
	_, err := DB.Exec(query, id, groupID, serverID, time.Now().UTC())
	return err
}

func RemoveServerFromGroup(groupID, serverID string) error {
	query := `DELETE FROM server_group_members WHERE group_id = ? AND server_id = ?`
	_, err := DB.Exec(query, groupID, serverID)
	return err
}

func GetServerGroups() ([]models.ServerGroup, error) {
	query := `SELECT id, name, description, created_by, created_at, updated_at FROM server_groups ORDER BY name`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.ServerGroup
	for rows.Next() {
		var g models.ServerGroup
		var createdAt, updatedAt string
		err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.CreatedBy, &createdAt, &updatedAt)
		if err != nil {
			return nil, err
		}
		g.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		g.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		groups = append(groups, g)
	}

	return groups, nil
}

func GetServersInGroup(groupID string) ([]string, error) {
	query := `SELECT server_id FROM server_group_members WHERE group_id = ?`
	rows, err := DB.Query(query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var serverIDs []string
	for rows.Next() {
		var serverID string
		err := rows.Scan(&serverID)
		if err != nil {
			return nil, err
		}
		serverIDs = append(serverIDs, serverID)
	}

	return serverIDs, nil
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

	// Assign default permissions to admin role
	adminPerms, _ := GetPermissionsForRole("admin", nil)
	if len(adminPerms) == 0 {
		allPerms, _ := GetAllPermissions()
		for _, p := range allPerms {
			AssignPermissionToRole("admin", p.ID, nil)
		}
	}

	log.Println("Default RBAC permissions initialized")
	return nil
}
