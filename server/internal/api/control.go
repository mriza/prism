package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/hub"
	"prism-server/internal/models"
	"prism-server/internal/protocol"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var AgentHub *hub.Hub
var HubToken string
var AllowedOrigins []string

var Upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // Allow requests without Origin header (same-origin, curl, etc.)
		}
		// Check against allowed origins
		for _, allowed := range AllowedOrigins {
			if allowed == "*" || allowed == origin {
				return true
			}
			// Support wildcard subdomains (e.g., *.example.com)
			if strings.HasPrefix(allowed, "*.") {
				domain := allowed[2:]
				if strings.HasSuffix(origin, domain) {
					return true
				}
			}
		}
		// Default: allow localhost for development
		if strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1") {
			return true
		}
		log.Printf("WebSocket origin rejected: %s", origin)
		return false
	},
}

func SetAgentHub(h *hub.Hub) {
	AgentHub = h
}

func SetHubToken(token string) {
	HubToken = token
}

func HandleServiceControl(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims := GetUserClaims(r)
	if claims == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if AgentHub == nil {
		http.Error(w, "Hub not initialized", http.StatusInternalServerError)
		return
	}

	type ControlRequest struct {
		AgentID string                 `json:"agent_id"`
		Service string                 `json:"service"`
		Action  string                 `json:"action"`
		Options map[string]interface{} `json:"options,omitempty"`
	}

	var req ControlRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// RBAC Inspection: Managers cannot change the active firewall
	if req.Action == "firewall_set_active" && claims.Role != "admin" {
		http.Error(w, "Forbidden: Only admins can change the active firewall engine", http.StatusForbidden)
		return
	}

	agentDB, err := db.GetAgentByID(req.AgentID)
	if err != nil || agentDB == nil {
		http.Error(w, "Agent not found in database", http.StatusNotFound)
		return
	}

	if agentDB.Status == "pending" {
		http.Error(w, "Agent is pending approval. Please approve agent first.", http.StatusForbidden)
		return
	}

	agent, ok := AgentHub.GetAgent(agentDB.ID)
	if !ok {
		http.Error(w, "Agent is offline", http.StatusNotFound)
		return
	}

	service := req.Service
	if service == "firewall" {
		found := false
		for name, svc := range agent.Services {
			if isActive, ok := svc.Metrics["is_active"]; ok && isActive == 1 {
				service = name
				found = true
				break
			}
		}
		if !found {
			if _, ok := agent.Services["ufw"]; ok {
				service = "ufw"
			} else {
				http.Error(w, "No active firewall found on agent", http.StatusNotFound)
				return
			}
		}
	}

	// Inject Management Credentials if available
	svc, err := db.GetServiceByServerAndName(agentDB.ID, service)
	if err == nil && svc != nil {
		var mc *models.ManagementCredential
		var reqCredID string

		if req.Options != nil {
			if id, ok := req.Options["credential_id"].(string); ok {
				reqCredID = id
			}
		}

		if reqCredID != "" {
			mc, _ = db.GetManagementCredentialByID(reqCredID)
		} else {
			creds, _ := db.GetManagementCredentialsByServiceID(svc.ID)
			for _, c := range creds {
				if c.Status == "active" {
					mcCopy := c
					mc = &mcCopy
					break
				}
			}
		}

		if mc != nil && (mc.Status == "active" || req.Action == "verify_credential") {
			if req.Options == nil {
				req.Options = make(map[string]interface{})
			}
			req.Options["management_credentials"] = map[string]string{
				"username":          string(mc.UsernameEncrypted),
				"password":          string(mc.PasswordEncrypted),
				"connection_params": string(mc.ConnectionParamsEncrypted),
				"type":              mc.CredentialType,
			}
		}
	}

	cmdID := fmt.Sprintf("%d", time.Now().UnixNano())
	cmd := protocol.Message{
		Type: protocol.MsgTypeCommand,
		Payload: protocol.CommandPayload{
			CommandID: cmdID,
			Action:    req.Action,
			Service:   service,
			Options:   req.Options,
		},
	}

	respCh := make(chan *protocol.Message, 1)
	AgentHub.SetResponseChan(cmdID, respCh)
	defer AgentHub.DeleteResponseChan(cmdID)

	if err := agent.Send(cmd); err != nil {
		http.Error(w, "Failed to send command to agent", http.StatusInternalServerError)
		return
	}

	select {
	case resp := <-respCh:
		json.NewEncoder(w).Encode(resp.Payload)
	case <-time.After(30 * time.Second):
		http.Error(w, "Command timed out", http.StatusGatewayTimeout)
	}
}

func HandleServiceImport(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims := GetUserClaims(r)
	if claims == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	type ImportRequest struct {
		AgentID string `json:"agent_id"`
		Service string `json:"service"`
	}

	var req ImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	agentDB, err := db.GetAgentByID(req.AgentID)
	if err != nil || agentDB == nil {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}

	if agentDB.Status == "pending" {
		http.Error(w, "Agent is pending approval", http.StatusForbidden)
		return
	}

	agent, ok := AgentHub.GetAgent(agentDB.ID)
	if !ok {
		http.Error(w, "Agent is offline", http.StatusNotFound)
		return
	}

	cmdID := fmt.Sprintf("import-%d", time.Now().UnixNano())
	cmd := protocol.Message{
		Type: protocol.MsgTypeCommand,
		Payload: protocol.CommandPayload{
			CommandID: cmdID,
			Action:    "service_import_resources",
			Service:   req.Service,
		},
	}

	respCh := make(chan *protocol.Message, 1)
	AgentHub.SetResponseChan(cmdID, respCh)
	defer AgentHub.DeleteResponseChan(cmdID)

	if err := agent.Send(cmd); err != nil {
		http.Error(w, "Failed to send command to agent", http.StatusInternalServerError)
		return
	}

	select {
	case resp := <-respCh:
		json.NewEncoder(w).Encode(resp.Payload)
	case <-time.After(30 * time.Second):
		http.Error(w, "Command timed out", http.StatusGatewayTimeout)
	}
}

func HandleAgentConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WS: %v", err)
		return
	}
	defer conn.Close()

	if AgentHub == nil {
		log.Println("AgentHub not initialized")
		return
	}

	// 1. Wait for Register Message
	var msg protocol.Message
	if err := conn.ReadJSON(&msg); err != nil {
		log.Printf("Failed to read register msg: %v", err)
		return
	}

	if msg.Type != protocol.MsgTypeRegister {
		log.Printf("Expected register message, got %s", msg.Type)
		return
	}

	// Parse Payload
	payloadMap, ok := msg.Payload.(map[string]interface{})
	if !ok || payloadMap == nil {
		log.Println("Invalid payload format: missing or not a map")
		return
	}

	hostname, _ := payloadMap["hostname"].(string)
	token, _ := payloadMap["token"].(string)

	if HubToken == "" {
		log.Printf("Server configuration error: No authentication token configured. Rejecting agent %s.", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Server misconfigured"},
		})
		return
	}

	if token != HubToken {
		log.Printf("Security Alert: Invalid token from agent at %s", r.RemoteAddr)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Invalid token"},
		})
		return
	}

	osInfo, _ := payloadMap["os_info"].(string)
	agentIDPayload, _ := payloadMap["agent_id"].(string)

	var runtimes []models.RuntimeInfo
	if rtInterface, ok := payloadMap["runtimes"].([]interface{}); ok {
		for _, rt := range rtInterface {
			if rtMap, ok := rt.(map[string]interface{}); ok {
				name, _ := rtMap["name"].(string)
				version, _ := rtMap["version"].(string)
				path, _ := rtMap["path"].(string)
				runtimes = append(runtimes, models.RuntimeInfo{
					Name:    name,
					Version: version,
					Path:    path,
				})
			}
		}
	}

	var agent *models.LegacyAgent
	if agentIDPayload != "" {
		agent, _ = db.GetAgentByID(agentIDPayload)
	} else {
		agent, _ = db.GetAgentByHostname(hostname)
	}

	if agent == nil {
		existing, _ := db.GetAgentByHostname(hostname)
		if existing != nil && existing.ID != agentIDPayload {
			db.ReplaceAgentID(existing.ID, agentIDPayload)
			agent, _ = db.GetAgentByID(agentIDPayload)
		}

		if agent == nil {
			newAgent := models.LegacyAgent{
				ID:       agentIDPayload,
				Hostname: hostname,
				OSInfo:   osInfo,
				Status:   "pending",
				LastSeen: time.Now().UTC().Format(time.RFC3339),
			}
			db.CreateAgent(newAgent)
			conn.WriteJSON(protocol.Message{
				Type:    protocol.MsgTypeResponse,
				Payload: map[string]string{"error": "Agent approval pending"},
			})
			return
		}
	}

	if agent.Status == "pending" {
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent approval pending"},
		})
		return
	}

	if agent.Status == "rejected" {
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent rejected"},
		})
		return
	}

	db.UpdateAgentStatus(agent.ID, "online", agent.Name, agent.Description)
	db.UpdateAgentLastSeen(agent.ID, osInfo)
	db.UpdateServerHeartbeat(agent.ID, osInfo, "", runtimes)
	db.UpdateServerStatus(agent.ID, "active", agent.Name, agent.Description)

	agentID := agent.ID
	session := &hub.AgentSession{
		ID:       agentID,
		Conn:     conn,
		Services: make(map[string]protocol.ServiceInfo),
		LastSeen: time.Now(),
	}

	initialServices := make(map[string]protocol.ServiceInfo)
	if servicesInterface, ok := payloadMap["services"].([]interface{}); ok {
		for _, s := range servicesInterface {
			if sMap, ok := s.(map[string]interface{}); ok {
				name, _ := sMap["name"].(string)
				status, _ := sMap["status"].(string)
				var metrics map[string]float64
				if m, ok := sMap["metrics"].(map[string]interface{}); ok {
					metrics = make(map[string]float64)
					for k, v := range m {
						if val, ok := v.(float64); ok {
							metrics[k] = val
						}
					}
				}
				initialServices[name] = protocol.ServiceInfo{
					Name:    name,
					Status:  status,
					Metrics: metrics,
				}
			}
		}
	}
	session.SetServices(initialServices)

	AgentHub.RegisterAgent(agentID, session)

	// Send Welcome message
	welcome := protocol.Message{
		Type: protocol.MsgTypeWelcome,
		Payload: protocol.WelcomePayload{
			AgentID:           agentID,
			HeartbeatInterval: 15,
		},
	}
	session.Send(welcome)

	// Send permanent token
	tokenCmd := protocol.Message{
		Type: protocol.MsgTypeCommand,
		Payload: map[string]interface{}{
			"action":     "agent_set_hub_token",
			"service":    "agent",
			"command_id": fmt.Sprintf("set-token-%d", time.Now().UnixNano()),
			"options": map[string]interface{}{
				"token": HubToken,
			},
		},
	}
	session.Send(tokenCmd)

	BroadcastAgentUpdate(map[string]interface{}{
		"id":       agentID,
		"hostname": hostname,
		"status":   "online",
		"services": session.GetAllServices(),
		"lastSeen": time.Now().UTC().Format(time.RFC3339),
	}, "agent_connected")

	for {
		var incoming protocol.Message
		err := conn.ReadJSON(&incoming)
		if err != nil {
			break
		}

		if incoming.Type == protocol.MsgTypeKeepAlive {
			if agent, ok := AgentHub.GetAgent(agentID); ok {
				agent.LastSeen = time.Now()
				
				if payloadMap, ok := incoming.Payload.(map[string]interface{}); ok {
					if servicesInterface, ok := payloadMap["services"].([]interface{}); ok {
						for _, s := range servicesInterface {
							if sMap, ok := s.(map[string]interface{}); ok {
								name, _ := sMap["name"].(string)
								if name == "" {
									continue
								}
								status, _ := sMap["status"].(string)
								var metrics map[string]float64
								if m, ok := sMap["metrics"].(map[string]interface{}); ok {
									metrics = make(map[string]float64)
									for k, v := range m {
										if val, ok := v.(float64); ok {
											metrics[k] = val
										}
									}
								}
								// Overwrite the service entirely because metrics might have changed
								agent.UpdateService(name, protocol.ServiceInfo{
									Name:    name,
									Status:  status,
									Metrics: metrics,
								})
							}
						}
					}
				}
			}
		}

		if incoming.Type == protocol.MsgTypeResponse {
			if payloadMap, ok := incoming.Payload.(map[string]interface{}); ok && payloadMap != nil {
				if cmdID, ok := payloadMap["command_id"].(string); ok && cmdID != "" {
					if ch, ok := AgentHub.GetResponseChan(cmdID); ok && ch != nil {
						select {
						case ch <- &incoming:
						default:
						}
					}
				}
			}
		}

		if incoming.Type == protocol.MsgTypeEvent {
			if payloadMap, ok := incoming.Payload.(map[string]interface{}); ok {
				event := models.Event{
					AgentID: agentID,
					ProjectID: func() string {
						if pid, ok := payloadMap["project_id"].(string); ok {
							return pid
						}
						return ""
					}(),
					Type:    payloadMap["type"].(string),
					Service: payloadMap["service"].(string),
					Status:  payloadMap["status"].(string),
					Message: payloadMap["message"].(string),
				}
				savedEvent, err := db.CreateEvent(event)
				if err == nil {
					BroadcastEvent(savedEvent)
				} else {
					log.Printf("Failed to save event from agent %s: %v", agentID, err)
				}
				
				// Update in-memory session if this is a service status change
				if event.Type == "service_status_change" && event.Service != "" {
					if agent, ok := AgentHub.GetAgent(agentID); ok {
						if svc, exists := agent.GetService(event.Service); exists {
							svc.Status = event.Status
							agent.UpdateService(event.Service, svc)
						} else {
							// New service discovered via event
							agent.UpdateService(event.Service, protocol.ServiceInfo{
								Name:   event.Service,
								Status: event.Status,
							})
						}
					}
				}
			}
		}
	}

	AgentHub.UnregisterAgent(agentID)
	BroadcastAgentUpdate(map[string]interface{}{
		"id":       agentID,
		"hostname": agentID,
		"status":   "offline",
	}, "agent_disconnected")
}
