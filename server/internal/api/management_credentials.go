package api

import (
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"strings"
)

func HandleManagementCredentials(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		status := r.URL.Query().Get("status")
		serviceID := r.URL.Query().Get("serviceId")
		
		var credentials []models.ManagementCredential
		var err error
		
		if serviceID != "" {
			credentials, err = db.GetManagementCredentialsByServiceID(serviceID)
		} else if status != "" {
			credentials, err = db.GetManagementCredentialsByStatus(status)
		} else {
			credentials, err = db.GetAllManagementCredentials()
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if credentials == nil {
			credentials = []models.ManagementCredential{}
		}
		json.NewEncoder(w).Encode(credentials)

	case "POST":
		var mc models.ManagementCredential
		if err := json.NewDecoder(r.Body).Decode(&mc); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if mc.ServiceID == "" || mc.CredentialType == "" {
			http.Error(w, "service_id and credential_type are required", http.StatusBadRequest)
			return
		}

		created, err := db.CreateManagementCredential(mc)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit action
		db.LogAuditAction("system", "credential_created", "management_credential", created.ID, r.RemoteAddr, map[string]interface{}{
			"service_id":      created.ServiceID,
			"credential_type": created.CredentialType,
		})

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func HandleManagementCredentialDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	// Extract ID from path: /api/management-credentials/{id} or /api/management-credentials/{id}/verify
	path := strings.TrimPrefix(r.URL.Path, "/api/management-credentials/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "Credential ID missing", http.StatusBadRequest)
		return
	}
	id := parts[0]
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}

	switch r.Method {
	case "PUT":
		var mc models.ManagementCredential
		if err := json.NewDecoder(r.Body).Decode(&mc); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}
		mc.ID = id

		if err := db.UpdateManagementCredential(mc); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		db.LogAuditAction("system", "credential_updated", "management_credential", id, r.RemoteAddr, map[string]interface{}{
			"status": mc.Status,
		})

		json.NewEncoder(w).Encode(mc)

	case "POST":
		if action == "verify" {
			if err := db.VerifyManagementCredential(id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			db.LogAuditAction("system", "credential_verified", "management_credential", id, r.RemoteAddr, nil)
			json.NewEncoder(w).Encode(map[string]string{"status": "verified"})
		} else {
			http.Error(w, "Method not allowed or invalid action", http.StatusMethodNotAllowed)
		}

	case "DELETE":
		if err := db.DeleteManagementCredential(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		db.LogAuditAction("system", "credential_deleted", "management_credential", id, r.RemoteAddr, nil)

		w.WriteHeader(http.StatusNoContent)

	case "GET":
		// Handle GET requesting by service_id temporarily since we didn't add GetCredentialByID
		// This endpoints gets used if the frontend mistakenly tries a direct GET.
		mc, err := db.GetManagementCredentialByServiceID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if mc == nil {
			http.Error(w, "Credential not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(mc)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
