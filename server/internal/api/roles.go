package api

import (
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"strings"

	"github.com/google/uuid"
)

// HandleRoles handles CRUD operations for custom roles
func HandleRoles(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/roles")
	path = strings.Trim(path, "/")

	// Check if request is for a specific role
	if path != "" && !strings.Contains(path, "/") {
		// /api/roles/{id}
		handleRoleDetail(w, r, path)
		return
	}

	if strings.Contains(path, "/users") {
		// /api/roles/{id}/users
		parts := strings.Split(path, "/")
		if len(parts) >= 2 {
			handleRoleUsers(w, r, parts[0])
			return
		}
	}

	switch r.Method {
	case "GET":
		handleListRoles(w, r)
	case "POST":
		handleCreateRole(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := db.GetAllRoles()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(roles)
}

func handleCreateRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Permissions []string `json:"permissions"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Role name is required", http.StatusBadRequest)
		return
	}

	if len(req.Permissions) == 0 {
		http.Error(w, "At least one permission is required", http.StatusBadRequest)
		return
	}

	now := currentTime()
	role := db.Role{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
		IsSystem:    false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := db.CreateRole(role); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "Role name already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(role)
}

func handleRoleDetail(w http.ResponseWriter, r *http.Request, id string) {
	switch r.Method {
	case "GET":
		handleGetRole(w, r, id)
	case "PUT":
		handleUpdateRole(w, r, id)
	case "DELETE":
		handleDeleteRole(w, r, id)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleGetRole(w http.ResponseWriter, r *http.Request, id string) {
	role, err := db.GetRole(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if role == nil {
		http.Error(w, "Role not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(role)
}

func handleUpdateRole(w http.ResponseWriter, r *http.Request, id string) {
	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Permissions []string `json:"permissions"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	role, err := db.GetRole(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if role == nil {
		http.Error(w, "Role not found", http.StatusNotFound)
		return
	}

	if role.IsSystem {
		http.Error(w, "Cannot update system roles", http.StatusForbidden)
		return
	}

	if req.Name != "" {
		role.Name = req.Name
	}
	if req.Description != "" {
		role.Description = req.Description
	}
	if len(req.Permissions) > 0 {
		role.Permissions = req.Permissions
	}
	role.UpdatedAt = currentTime()

	if err := db.UpdateRole(*role); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(role)
}

func handleDeleteRole(w http.ResponseWriter, r *http.Request, id string) {
	if err := db.DeleteRole(id); err != nil {
		if strings.Contains(err.Error(), "system role") {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func handleRoleUsers(w http.ResponseWriter, r *http.Request, roleID string) {
	switch r.Method {
	case "GET":
		handleGetUsersWithRole(w, r, roleID)
	case "POST":
		handleAssignRoleToUser(w, r, roleID)
	case "DELETE":
		handleRemoveRoleFromUser(w, r, roleID)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleGetUsersWithRole(w http.ResponseWriter, r *http.Request, roleID string) {
	role, err := db.GetRole(roleID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if role == nil {
		http.Error(w, "Role not found", http.StatusNotFound)
		return
	}

	// Get users with this role - we'll need to query users table
	// For now, return role info
	json.NewEncoder(w).Encode(role)
}

func handleAssignRoleToUser(w http.ResponseWriter, r *http.Request, roleID string) {
	var req struct {
		UserID string `json:"userId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.UserID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Verify role exists
	role, err := db.GetRole(roleID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if role == nil {
		http.Error(w, "Role not found", http.StatusNotFound)
		return
	}

	if err := db.AssignRoleToUser(req.UserID, roleID, "admin"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func handleRemoveRoleFromUser(w http.ResponseWriter, r *http.Request, roleID string) {
	var req struct {
		UserID string `json:"userId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.UserID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	if err := db.RemoveRoleFromUser(req.UserID, roleID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
