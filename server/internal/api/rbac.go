package api

import (
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
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
