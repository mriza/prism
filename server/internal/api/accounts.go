package api

import (
	"bytes"
	"encoding/json"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"fmt"
	"log"
	"net/http"
	"strings"
)

func sendInternalControlCommand(agentID, service, action string, options map[string]interface{}) error {
	payload := map[string]interface{}{
		"agent_id": agentID,
		"service":  service,
		"action":   action,
		"options":  options,
	}
	b, _ := json.Marshal(payload)
	resp, err := http.Post("http://localhost:65432/api/control", "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("control api returned status %d", resp.StatusCode)
	}
	return nil
}

func HandleAccounts(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		projectID := r.URL.Query().Get("projectId")
		accounts, err := db.GetServiceAccounts(projectID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if accounts == nil {
			accounts = []models.ServiceAccount{}
		}
		json.NewEncoder(w).Encode(accounts)

	case "POST":
		var a models.ServiceAccount
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		// 1. Remote Provisioning Logic via Agent
		if a.Type == "mysql" || a.Type == "postgresql" || a.Type == "mongodb" {
			if a.Database != "" {
				err := sendInternalControlCommand(a.AgentID, string(a.Type), "db_create_db", map[string]interface{}{
					"name": a.Database,
				})
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create database on agent: %v", err), http.StatusInternalServerError)
					return
				}
			}
			if a.Username != "" && a.Password != "" {
				err := sendInternalControlCommand(a.AgentID, string(a.Type), "db_create_user", map[string]interface{}{
					"username": a.Username,
					"password": a.Password,
				})
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to create user on agent: %v", err), http.StatusInternalServerError)
					return
				}
			}
		}

		// 2. Open Firewall Port
		if a.Port > 0 {
			err := sendInternalControlCommand(a.AgentID, "ufw", "ufw_allow", map[string]interface{}{
				"port":     float64(a.Port),
				"protocol": "tcp",
			})
			if err != nil {
				log.Printf("Warning: failed to open UFW port: %v", err)
			}
		}

		// 3. Save to Local Hub DB
		created, err := db.CreateServiceAccount(a)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func HandleAccountDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/accounts/")
	if id == "" {
		http.Error(w, "Account ID missing", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "PUT":
		var a models.ServiceAccount
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}
		a.ID = id
		if err := db.UpdateServiceAccount(a); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(a)

	case "DELETE":
		if err := db.DeleteServiceAccount(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
