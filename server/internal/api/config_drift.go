package api

import (
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"strings"

	"github.com/google/uuid"
)

// HandleConfigDrift handles configuration drift detection endpoints
func HandleConfigDrift(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/config-drift")
	path = strings.Trim(path, "/")

	switch {
	case path == "stats":
		handleDriftStats(w, r)
	case path == "resolve":
		handleResolveDrift(w, r)
	case path == "":
		handleListDrifts(w, r)
	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

// HandleAgentConfig handles agent configuration endpoints
func HandleAgentConfig(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		agentID := r.URL.Query().Get("agentId")
		if agentID == "" {
			http.Error(w, "agentId query parameter is required", http.StatusBadRequest)
			return
		}
		handleGetAgentConfig(w, r, agentID)
	case "POST":
		handleCreateAgentConfig(w, r)
	case "PUT":
		handleUpdateAgentConfig(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleListDrifts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	agentID := r.URL.Query().Get("agentId")
	severity := r.URL.Query().Get("severity")

	drifts, err := db.GetActiveDrifts(agentID, severity)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(drifts)
}

func handleDriftStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := db.GetDriftStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}

func handleResolveDrift(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		DriftID string `json:"driftId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.DriftID == "" {
		http.Error(w, "driftId is required", http.StatusBadRequest)
		return
	}

	// TODO: Get user ID from auth context
	resolvedBy := "admin"

	if err := db.ResolveConfigurationDrift(req.DriftID, resolvedBy); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func handleGetAgentConfig(w http.ResponseWriter, r *http.Request, agentID string) {
	config, err := db.GetAgentConfiguration(agentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if config == nil {
		http.Error(w, "Configuration not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(config)
}

func handleCreateAgentConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AgentID   string   `json:"agentId"`
		AgentName string   `json:"agentName"`
		Services  []string `json:"services"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.AgentID == "" {
		http.Error(w, "agentId is required", http.StatusBadRequest)
		return
	}

	now := currentTime()
	servicesJSON, _ := json.Marshal(req.Services)
	config := db.AgentConfiguration{
		ID:           uuid.New().String(),
		AgentID:      req.AgentID,
		AgentName:    req.AgentName,
		Services:     string(servicesJSON),
		LastVerified: now,
		CreatedAt:    now,
		UpdatedAt:    now,
		CreatedBy:    "admin",
	}

	if err := db.CreateAgentConfiguration(config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(config)
}

func handleUpdateAgentConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID        string   `json:"id"`
		AgentName string   `json:"agentName"`
		Services  []string `json:"services"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ID == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}

	config, err := db.GetAgentConfiguration(req.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if config == nil {
		http.Error(w, "Configuration not found", http.StatusNotFound)
		return
	}

	if req.AgentName != "" {
		config.AgentName = req.AgentName
	}
	if len(req.Services) > 0 {
		servicesJSON, _ := json.Marshal(req.Services)
		config.Services = string(servicesJSON)
	}
	config.UpdatedAt = currentTime()
	config.LastVerified = currentTime()

	if err := db.CreateAgentConfiguration(*config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(config)
}
