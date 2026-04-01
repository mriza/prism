package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"strings"
)

func HandleDeployments(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		filters := db.DeploymentFilters{
			ProjectID: r.URL.Query().Get("projectId"),
			ServerID:  r.URL.Query().Get("serverId"),
			Status:    r.URL.Query().Get("status"),
			Search:    r.URL.Query().Get("search"),
		}

		deployments, err := db.GetDeployments(filters)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if deployments == nil {
			deployments = []models.Deployment{}
		}
		json.NewEncoder(w).Encode(deployments)

	case "POST":
		var d models.Deployment
		if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		// Validate required fields
		if d.ProjectID == "" {
			http.Error(w, "projectId is required", http.StatusBadRequest)
			return
		}
		if d.ServerID == "" {
			http.Error(w, "serverId is required", http.StatusBadRequest)
			return
		}
		if d.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}
		if d.SourceURL == "" {
			http.Error(w, "sourceUrl is required", http.StatusBadRequest)
			return
		}

		// Set defaults
		if d.Runtime == "" {
			d.Runtime = "binary"
		}
		if d.ProcessManager == "" {
			d.ProcessManager = "pm2"
		}
		if d.ProxyType == "" && d.DomainName != "" {
			d.ProxyType = "caddy"
		}
		if d.Status == "" {
			d.Status = "stopped"
		}

		created, err := db.CreateDeployment(d)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit
		db.LogAuditAction("system", "deployment_created", "deployment", created.ID, r.RemoteAddr, map[string]interface{}{
			"name":      created.Name,
			"sourceUrl": created.SourceURL,
			"runtime":   created.Runtime,
		})

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(created)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func HandleDeploymentDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/deployments/")
	if path == "" {
		http.Error(w, "Deployment ID missing", http.StatusBadRequest)
		return
	}

	// Check for /deploy sub-path: /api/deployments/{id}/deploy
	parts := strings.SplitN(path, "/", 2)
	id := parts[0]
	subAction := ""
	if len(parts) > 1 {
		subAction = parts[1]
	}

	if subAction == "deploy" && r.Method == "POST" {
		handleDeployTrigger(w, r, id)
		return
	}

	switch r.Method {
	case "GET":
		deployment, err := db.GetDeploymentByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if deployment == nil {
			http.Error(w, "Deployment not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(deployment)

	case "PUT":
		var d models.Deployment
		if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}
		d.ID = id

		if err := db.UpdateDeployment(d); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		db.LogAuditAction("system", "deployment_updated", "deployment", d.ID, r.RemoteAddr, map[string]interface{}{
			"name":   d.Name,
			"status": d.Status,
		})

		json.NewEncoder(w).Encode(d)

	case "DELETE":
		deployment, err := db.GetDeploymentByID(id)
		if err == nil && deployment != nil {
			db.LogAuditAction("system", "deployment_deleted", "deployment", id, r.RemoteAddr, map[string]interface{}{
				"name": deployment.Name,
			})
		}

		if err := db.DeleteDeployment(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleDeployTrigger sends deploy_app command to the agent and updates deployment status.
func handleDeployTrigger(w http.ResponseWriter, r *http.Request, id string) {
	authToken := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")

	deployment, err := db.GetDeploymentByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if deployment == nil {
		http.Error(w, "Deployment not found", http.StatusNotFound)
		return
	}

	// Update status to deploying
	db.UpdateDeploymentStatus(id, "deploying", "")

	// Build deploy options
	options := map[string]interface{}{
		"name":            deployment.Name,
		"source_url":      deployment.SourceURL,
		"source_token":    deployment.SourceToken,
		"runtime":         deployment.Runtime,
		"runtime_version": deployment.RuntimeVersion,
		"process_manager": deployment.ProcessManager,
		"start_command":   deployment.StartCommand,
		"domain_name":     deployment.DomainName,
		"internal_port":   float64(deployment.InternalPort),
		"proxy_type":      deployment.ProxyType,
	}
	if deployment.EnvVars != nil {
		options["env_vars"] = deployment.EnvVars
	}

	// Send deploy_app command to agent
	err = sendInternalControlCommand(deployment.ServerID, "deployment", "deploy_app", options, authToken)
	if err != nil {
		log.Printf("Deployment failed for %s: %v", deployment.Name, err)
		db.UpdateDeploymentStatus(id, "failed", "")
		http.Error(w, fmt.Sprintf("Deployment failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Mark as active
	db.UpdateDeploymentStatus(id, "active", "latest")

	db.LogAuditAction("system", "deployment_triggered", "deployment", id, r.RemoteAddr, map[string]interface{}{
		"name": deployment.Name,
	})

	// Re-fetch to return updated data
	updated, _ := db.GetDeploymentByID(id)
	if updated != nil {
		json.NewEncoder(w).Encode(updated)
	} else {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "active", "message": "Deployment triggered"})
	}
}
