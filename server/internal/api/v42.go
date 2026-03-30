package api

import (
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"strings"
)

// HandleRBACPermissions handles permission management
func HandleRBACPermissions(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		resourceType := r.URL.Query().Get("resourceType")
		var permissions []models.Permission
		var err error

		if resourceType != "" {
			permissions, err = db.GetPermissionsByResourceType(resourceType)
		} else {
			permissions, err = db.GetAllPermissions()
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(permissions)

	case "POST":
		var p models.Permission
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		created, err := db.CreatePermission(p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

// HandleRolePermissions handles role permission assignments
func HandleRolePermissions(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	// Extract role from path: /api/roles/{role}/permissions
	path := strings.TrimPrefix(r.URL.Path, "/api/roles/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	role := parts[0]

	switch r.Method {
	case "GET":
		serverID := r.URL.Query().Get("serverId")
		var serverIDPtr *string
		if serverID != "" {
			serverIDPtr = &serverID
		}

		permissions, err := db.GetPermissionsForRole(role, serverIDPtr)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(permissions)

	case "POST":
		var req struct {
			PermissionID  string  `json:"permissionId"`
			ServerGroupID *string `json:"serverGroupId"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		err := db.AssignPermissionToRole(role, req.PermissionID, req.ServerGroupID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

	case "DELETE":
		var req struct {
			PermissionID string `json:"permissionId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		err := db.RemovePermissionFromRole(role, req.PermissionID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// HandleUserAccess handles user server access
func HandleUserAccess(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	userID := strings.TrimPrefix(r.URL.Path, "/api/users/")
	parts := strings.Split(userID, "/")
	if len(parts) != 2 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	userID = parts[0]

	switch r.Method {
	case "GET":
		access, err := db.GetUserServerAccess(userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(access)

	case "POST":
		var req struct {
			ServerID    string  `json:"serverId"`
			AccessLevel string  `json:"accessLevel"`
			GrantedBy   string  `json:"grantedBy"`
			ExpiresAt   *string `json:"expiresAt"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		err := db.GrantUserServerAccess(userID, req.ServerID, req.AccessLevel, req.GrantedBy, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})

	case "DELETE":
		serverID := r.URL.Query().Get("serverId")
		if serverID == "" {
			http.Error(w, "serverId required", http.StatusBadRequest)
			return
		}

		err := db.RevokeUserServerAccess(userID, serverID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// HandleServerGroups handles server group management
func HandleServerGroups(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		groups, err := db.GetServerGroups()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(groups)

	case "POST":
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			CreatedBy   string `json:"createdBy"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		group, err := db.CreateServerGroup(req.Name, req.Description, req.CreatedBy)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(group)
	}
}

// HandleWebhooks handles webhook subscriptions
func HandleWebhooks(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		subscriptions, err := db.GetWebhookSubscriptions()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(subscriptions)

	case "POST":
		var sub models.WebhookSubscription
		if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		created, err := db.CreateWebhookSubscription(sub)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

// HandleWebhookDetail handles individual webhook operations
func HandleWebhookDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/webhooks/")
	if id == "" {
		http.Error(w, "Webhook ID missing", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "PUT":
		var sub models.WebhookSubscription
		sub.ID = id
		if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		err := db.UpdateWebhookSubscription(sub)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(sub)

	case "DELETE":
		err := db.DeleteWebhookSubscription(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// HandleRetentionPolicies handles retention policy management
func HandleRetentionPolicies(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		policies, err := db.GetRetentionPolicies()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(policies)

	case "POST":
		var policy models.RetentionPolicy
		if err := json.NewDecoder(r.Body).Decode(&policy); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		created, err := db.CreateRetentionPolicy(policy)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)
	}
}

// HandleRetentionCleanup triggers manual cleanup
func HandleRetentionCleanup(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	deleted, err := db.CleanupExpiredData()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "ok",
		"recordsDeleted": deleted,
	})
}

// HandleDriftEvents handles drift event management
func HandleDriftEvents(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		serverID := r.URL.Query().Get("serverId")
		var serverIDPtr *string
		if serverID != "" {
			serverIDPtr = &serverID
		}

		events, err := db.GetActiveDriftEvents(serverIDPtr)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(events)

	case "POST":
		// Resolve drift event
		var req struct {
			EventID    string `json:"eventId"`
			ResolvedBy string `json:"resolvedBy"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		err := db.ResolveDriftEvent(req.EventID, req.ResolvedBy)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
