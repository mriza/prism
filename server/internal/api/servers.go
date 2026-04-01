package api

import (
	"encoding/json"
	"log"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"strings"
)

// HandleServers handles server management endpoints
func HandleServers(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		// Get all servers or filter by status
		status := r.URL.Query().Get("status")

		var servers []models.Server
		var err error

		if status != "" {
			// Filter by status
			servers, err = getServersByStatus(status)
		} else {
			servers, err = db.GetServers()
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if servers == nil {
			servers = []models.Server{}
		}
		json.NewEncoder(w).Encode(servers)

	case "POST":
		// Approve pending server
		var req struct {
			Hostname    string `json:"hostname"`
			Name        string `json:"name"`
			Description string `json:"description"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if req.Hostname == "" {
			http.Error(w, "hostname is required", http.StatusBadRequest)
			return
		}

		// Get pending server by hostname
		server, err := db.GetServerByHostname(req.Hostname)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if server == nil {
			http.Error(w, "Server not found", http.StatusNotFound)
			return
		}

		if server.Status != "pending" {
			http.Error(w, "Server is not pending approval", http.StatusBadRequest)
			return
		}

		// Update server status to active
		name := req.Name
		if name == "" {
			name = req.Hostname
		}

		err = db.UpdateServerStatus(server.ID, "active", name, req.Description)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Publish event
		if db.PubSub != nil {
			db.PubSub.PublishServerStatusChange(r.Context(), server.ID, "pending", "active")
		}

		// Log audit
		db.LogAuditAction("system", "server_approved", "server", server.ID, r.RemoteAddr, map[string]interface{}{
			"hostname": req.Hostname,
			"name":     name,
		})

		log.Printf("Server '%s' (%s) approved", name, server.ID)

		// Return updated server
		updatedServer, _ := db.GetServerByID(server.ID)
		json.NewEncoder(w).Encode(updatedServer)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleServerDetail handles individual server operations
func HandleServerDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/servers/")
	if id == "" {
		http.Error(w, "Server ID missing", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		server, err := db.GetServerByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if server == nil {
			http.Error(w, "Server not found", http.StatusNotFound)
			return
		}

		// Get services for this server
		services, _ := db.GetServicesByServerID(id)

		response := map[string]interface{}{
			"server":   server,
			"services": services,
		}

		json.NewEncoder(w).Encode(response)

	case "PUT":
		var req struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Status      string `json:"status"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		server, err := db.GetServerByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if server == nil {
			http.Error(w, "Server not found", http.StatusNotFound)
			return
		}

		// Update server
		name := req.Name
		if name == "" {
			name = server.Name
		}

		description := req.Description
		if description == "" {
			description = server.Description
		}

		status := req.Status
		if status == "" {
			status = server.Status
		}

		err = db.UpdateServerStatus(id, status, name, description)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Publish event if status changed
		if db.PubSub != nil && status != server.Status {
			db.PubSub.PublishServerStatusChange(r.Context(), id, server.Status, status)
		}

		// Log audit
		db.LogAuditAction("system", "server_updated", "server", id, r.RemoteAddr, map[string]interface{}{
			"name":   name,
			"status": status,
		})

		updatedServer, _ := db.GetServerByID(id)
		json.NewEncoder(w).Encode(updatedServer)

	case "DELETE":
		// Get server for audit log
		server, _ := db.GetServerByID(id)

		// Delete server (cascade will delete services, accounts, etc.)
		err := db.DeleteServer(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit
		if server != nil {
			db.LogAuditAction("system", "server_deleted", "server", id, r.RemoteAddr, map[string]interface{}{
				"hostname": server.Hostname,
			})
		}

		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandlePendingServers returns list of pending servers awaiting approval
func HandlePendingServers(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	servers, err := getServersByStatus("pending")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if servers == nil {
		servers = []models.Server{}
	}

	json.NewEncoder(w).Encode(servers)
}

// getServersByStatus gets servers filtered by status
func getServersByStatus(status string) ([]models.Server, error) {
	allServers, err := db.GetServers()
	if err != nil {
		return nil, err
	}

	var filtered []models.Server
	for _, s := range allServers {
		if s.Status == status {
			filtered = append(filtered, s)
		}
	}

	return filtered, nil
}

// HandleServerHeartbeat handles agent heartbeat updates
func HandleServerHeartbeat(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ServerID     string               `json:"server_id"`
		Hostname     string               `json:"hostname"`
		OSInfo       string               `json:"os_info"`
		AgentVersion string               `json:"agent_version"`
		Runtimes     []models.RuntimeInfo `json:"runtimes"`
		Metrics      map[string]interface{} `json:"metrics"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	if req.ServerID == "" && req.Hostname == "" {
		http.Error(w, "server_id or hostname is required", http.StatusBadRequest)
		return
	}

	// Find server
	var server *models.Server
	var err error

	if req.ServerID != "" {
		server, err = db.GetServerByID(req.ServerID)
	} else {
		server, err = db.GetServerByHostname(req.Hostname)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if server == nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Update heartbeat
	err = db.UpdateServerHeartbeat(server.ID, req.OSInfo, req.AgentVersion, req.Runtimes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// If server was unreachable, mark as active
	if server.Status == "unreachable" {
		db.UpdateServerStatus(server.ID, "active", server.Name, server.Description)
		if db.PubSub != nil {
			db.PubSub.PublishServerStatusChange(r.Context(), server.ID, "unreachable", "active")
		}
		log.Printf("Server '%s' recovered from unreachable state", server.Name)
	}

	// Publish telemetry event
	if db.PubSub != nil && req.Metrics != nil {
		db.PubSub.PublishTelemetryReceived(r.Context(), server.ID, "", req.Metrics)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// HandleServerServices returns services for a specific server
func HandleServerServices(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	// Extract server ID from path: /api/servers/{id}/services
	path := strings.TrimPrefix(r.URL.Path, "/api/servers/")
	parts := strings.Split(path, "/")

	if len(parts) < 2 || parts[1] != "services" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	serverID := parts[0]

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	services, err := db.GetServicesByServerID(serverID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if services == nil {
		services = []models.Service{}
	}

	json.NewEncoder(w).Encode(services)
}
