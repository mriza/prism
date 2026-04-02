package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"prism-server/internal/protocol"
	"prism-server/internal/ws"
	"time"
)

var WSHub *ws.Hub

func SetWSHub(h *ws.Hub) {
	WSHub = h
}

func HandleListAgents(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method == "OPTIONS" {
		return
	}

	agentsDB, err := db.GetAgents()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if AgentHub == nil {
		http.Error(w, "Hub not initialized", http.StatusInternalServerError)
		return
	}

	type AgentSummary struct {
		ID          string                 `json:"id"`
		Name        string                 `json:"name"`
		Description string                 `json:"description"`
		Hostname    string                 `json:"hostname"`
		OSInfo      string                 `json:"osInfo"`
		Status      string                 `json:"status"` // pending, approved, online, offline, rejected
		LastSeen    string                 `json:"lastSeen"`
		CreatedAt   string                 `json:"createdAt"`
		Services    []protocol.ServiceInfo `json:"services"`
	}

	var list []AgentSummary
	hubAgents := AgentHub.GetAgents()

	for _, a := range agentsDB {
		var svcInfos []protocol.ServiceInfo
		status := a.Status

		if session, ok := hubAgents[a.ID]; ok {
			if status == "approved" {
				status = "online"
			}
			for _, svcInfo := range session.Services {
				svcInfos = append(svcInfos, svcInfo)
			}
		} else {
			if status == "approved" {
				status = "offline"
			}
		}

		if svcInfos == nil {
			svcInfos = []protocol.ServiceInfo{}
		}

		list = append(list, AgentSummary{
			ID:          a.ID,
			Name:        a.Name,
			Description: a.Description,
			Hostname:    a.Hostname,
			OSInfo:      a.OSInfo,
			Status:      status,
			LastSeen:    a.LastSeen,
			CreatedAt:   a.CreatedAt,
			Services:    svcInfos,
		})
	}

	json.NewEncoder(w).Encode(list)
}

func HandleAgentAction(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method == "OPTIONS" {
		return
	}

	// URL format: /api/agents/{id}/approve or /api/agents/{id}
	path := r.URL.Path
	idStart := len("/api/agents/")
	if len(path) <= idStart {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	subPath := path[idStart:]
	id := subPath
	action := ""

	for i, c := range subPath {
		if c == '/' {
			id = subPath[:i]
			action = subPath[i+1:]
			break
		}
	}

	if r.Method == "DELETE" && action == "" {
		agentRecord, err := db.GetAgentByID(id)
		if err != nil || agentRecord == nil {
			agentRecord, err = db.GetAgentByHostname(id)
			if err != nil || agentRecord == nil {
				http.Error(w, "Agent not found", http.StatusNotFound)
				return
			}
		}

		if err := db.DeleteAgent(agentRecord.ID); err != nil {
			http.Error(w, "Failed to delete agent", http.StatusInternalServerError)
			return
		}

		log.Printf("Agent '%s' (%s) deleted successfully", agentRecord.Hostname, agentRecord.ID)

		if AgentHub != nil {
			if session, ok := AgentHub.GetAgent(agentRecord.ID); ok {
				log.Printf("Forcefully disconnecting agent %s due to deletion", agentRecord.Hostname)
				session.Conn.Close()
				AgentHub.UnregisterAgent(agentRecord.ID)
			}
		}

		BroadcastAgentUpdate(map[string]interface{}{
			"id":       agentRecord.ID,
			"hostname": agentRecord.Hostname,
			"status":   "deleted",
		}, "agent_deleted")

		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "POST" && action == "approve" {
		var payload struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && err != io.EOF {
			log.Printf("Warning: failed to decode approve payload: %v", err)
		}

		agentRecord, err := db.GetAgentByID(id)
		if err != nil || agentRecord == nil {
			agentRecord, err = db.GetAgentByHostname(id)
			if err != nil || agentRecord == nil {
				http.Error(w, "Agent not found", http.StatusNotFound)
				return
			}
		}

		if err := db.UpdateAgentStatus(agentRecord.ID, "approved", payload.Name, payload.Description); err != nil {
			http.Error(w, "Failed to approve agent", http.StatusInternalServerError)
			return
		}

		log.Printf("Agent '%s' (%s) approved successfully", agentRecord.Hostname, agentRecord.ID)

		BroadcastAgentUpdate(map[string]interface{}{
			"id":          agentRecord.ID,
			"hostname":    agentRecord.Hostname,
			"name":        payload.Name,
			"description": payload.Description,
			"status":      "approved",
		}, "agent_approved")

		if AgentHub != nil {
			// Hub check logic removed as permanent token is handled at connection time
		}

		w.WriteHeader(http.StatusOK)
		return
	}

	http.Error(w, "Method or action not allowed", http.StatusMethodNotAllowed)
}


func BroadcastAgentUpdate(agent map[string]interface{}, updateType string) {
	if WSHub == nil {
		return
	}

	message := ws.WSMessage{
		Type:      updateType,
		Channel:   "agents",
		Payload:   agent,
		Timestamp: time.Now().UnixNano(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal agent update: %v", err)
		return
	}

	WSHub.BroadcastToChannel("agents", data)
}

func BroadcastEvent(event models.Event) {
	if WSHub == nil {
		return
	}

	message := ws.WSMessage{
		Type:      "event",
		Channel:   "events",
		Payload:   event,
		Timestamp: time.Now().UnixNano(),
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal event update: %v", err)
		return
	}

	WSHub.BroadcastToChannel("events", data)
}
