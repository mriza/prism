package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"prism-server/internal/api"
	"prism-server/internal/config"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"prism-server/internal/protocol"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type AgentSession struct {
	ID       string
	Conn     *websocket.Conn
	Services map[string]protocol.ServiceInfo
	LastSeen time.Time
	mu       sync.Mutex // Lock for writing to Conn
}

func (s *AgentSession) Send(msg interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Conn.WriteJSON(msg)
}

type Hub struct {
	Agents map[string]*AgentSession
	// Map CommandID to channel for response
	PendingResponses map[string]chan *protocol.Message
	mu               sync.RWMutex
}

var hub = Hub{
	Agents:           make(map[string]*AgentSession),
	PendingResponses: make(map[string]chan *protocol.Message),
}

func handleAgentConnection(w http.ResponseWriter, r *http.Request, cfg *config.Config) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WS: %v", err)
		return
	}
	defer conn.Close()

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
	token, _ := payloadMap["token"].(string) // Validate token in real app

	// Validate Token
	expectedToken := ""
	if cfg != nil && cfg.Auth.Token != "" {
		expectedToken = cfg.Auth.Token
	}

	if expectedToken == "" {
		log.Printf("Server configuration error: No authentication token configured. Rejecting agent %s.", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Server misconfigured"},
		})
		return
	}

	if token != expectedToken {
		log.Printf("Invalid token from %s. Expected '%s', got '%s'", hostname, expectedToken, token)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Invalid token"},
		})
		return
	}

	// Token is valid. Now check Agent approval status in database.
	osInfo, _ := payloadMap["os_info"].(string)

	agent, err := db.GetAgentByHostname(hostname)
	if err != nil {
		log.Printf("Database error checking agent %s: %v", hostname, err)
		return
	}

	if agent == nil {
		// New Agent: Insert as 'pending' and reject connection
		newAgent := models.Agent{
			Hostname: hostname,
			OSInfo:   osInfo,
			Status:   "pending",
		}
		db.CreateAgent(newAgent)
		log.Printf("New Agent '%s' discovered. Registered as pending. Connection closed.", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent approval pending"},
		})
		return
	}

	if agent.Status == "pending" {
		log.Printf("Agent '%s' connection rejected (Status: pending)", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent approval pending"},
		})
		return
	}

	if agent.Status == "rejected" {
		log.Printf("Agent '%s' connection rejected (Status: rejected)", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent rejected"},
		})
		return
	}

	// Agent is approved. Update OS info and last seen.
	db.UpdateAgentLastSeen(agent.ID, osInfo)

	// Register connected Session
	agentID := hostname
	session := &AgentSession{
		ID:       agentID,
		Conn:     conn,
		Services: make(map[string]protocol.ServiceInfo),
		LastSeen: time.Now(),
	}

	// Store Services
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

				session.Services[name] = protocol.ServiceInfo{
					Name:    name,
					Status:  status,
					Metrics: metrics,
				}
			}
		}
	}

	hub.mu.Lock()
	hub.Agents[agentID] = session
	hub.mu.Unlock()

	log.Printf("Agent connected: %s", agentID)

	// Send Welcome
	welcome := protocol.Message{
		Type: protocol.MsgTypeWelcome,
		Payload: protocol.WelcomePayload{
			AgentID: agentID,
		},
	}
	session.Send(welcome)

	// Loop for messages (KeepAlive, Events)
	for {
		var incoming protocol.Message
		err := conn.ReadJSON(&incoming)
		if err != nil {
			log.Printf("Agent %s disconnected: %v", agentID, err)
			break
		}

		// Update heartbeats, handle events etc.
		if incoming.Type == protocol.MsgTypeKeepAlive {
			hub.mu.Lock()
			if agent, ok := hub.Agents[agentID]; ok {
				agent.LastSeen = time.Now()

				// Update service statuses
				if payloadMap, ok := incoming.Payload.(map[string]interface{}); ok && payloadMap != nil {
					if servicesInterface, ok := payloadMap["services"].([]interface{}); ok && servicesInterface != nil {
						for _, s := range servicesInterface {
							if sMap, ok := s.(map[string]interface{}); ok && sMap != nil {
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

								if name != "" {
									agent.Services[name] = protocol.ServiceInfo{
										Name:    name,
										Status:  status,
										Metrics: metrics,
									}
								}
							}
						}
					}
				}
			}
			hub.mu.Unlock()
		}

		if incoming.Type == protocol.MsgTypeResponse {
			if payloadMap, ok := incoming.Payload.(map[string]interface{}); ok && payloadMap != nil {
				if cmdID, ok := payloadMap["command_id"].(string); ok && cmdID != "" {
					hub.mu.RLock()
					ch, ok := hub.PendingResponses[cmdID]
					hub.mu.RUnlock()

					if ok && ch != nil {
						ch <- &incoming
					}
				}
			}
		}
	}

	hub.mu.Lock()
	delete(hub.Agents, agentID)
	hub.mu.Unlock()
}

func handleListAgents(w http.ResponseWriter, r *http.Request) {
	// Enable CORS (restricted to localhost/127.0.0.1 for dev, should be configured for prod)
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		return
	}

	agentsDB, err := db.GetAgents()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	type AgentSummary struct {
		ID          string                 `json:"id"`
		Name        string                 `json:"name"`
		Description string                 `json:"description"`
		Hostname    string                 `json:"hostname"`
		OSInfo      string                 `json:"osInfo"`
		Status      string                 `json:"status"` // pending, approved, online, offline, rejected
		LastSeen    string                 `json:"lastSeen"`
		CreatedAt   string                 `json:"createdAt"`
		Services  []protocol.ServiceInfo `json:"services"`
	}

	var list []AgentSummary
	for _, a := range agentsDB {
		var svcInfos []protocol.ServiceInfo
		status := a.Status

		if session, ok := hub.Agents[a.Hostname]; ok {
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

func handleAgentAction(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

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

	// Check if there's an action (like /approve)
	for i, c := range subPath {
		if c == '/' {
			id = subPath[:i]
			action = subPath[i+1:]
			break
		}
	}

	if r.Method == "DELETE" && action == "" {
		// 1. Get agent first to know its hostname
		agentRecord, err := db.GetAgentByID(id)
		if err != nil || agentRecord == nil {
			http.Error(w, "Agent not found", http.StatusNotFound)
			return
		}

		// 2. Delete from database
		if err := db.DeleteAgent(id); err != nil {
			http.Error(w, "Failed to delete agent", http.StatusInternalServerError)
			return
		}

		// 3. Forcefully disconnect WS session if it exists to trigger auto re-registration
		hub.mu.Lock()
		if session, ok := hub.Agents[agentRecord.Hostname]; ok {
			log.Printf("Forcefully disconnecting agent %s due to deletion", agentRecord.Hostname)
			session.Conn.Close()
			delete(hub.Agents, agentRecord.Hostname)
		}
		hub.mu.Unlock()

		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "POST" && action == "approve" {
		var payload struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil && err != io.EOF {
			// Don't fail if body is empty for backwards compatibility, but log it
			log.Printf("Warning: failed to decode approve payload: %v", err)
		}

		if err := db.UpdateAgentStatus(id, "approved", payload.Name, payload.Description); err != nil {
			http.Error(w, "Failed to approve agent", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Error(w, "Method or action not allowed", http.StatusMethodNotAllowed)
}

func startAgentCleanupLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		hub.mu.Lock()
		for id, agent := range hub.Agents {
			if now.Sub(agent.LastSeen) > 45*time.Second {
				log.Printf("Agent %s timed out (no KeepAlive for 45s), removing...", id)
				agent.Conn.Close()
				delete(hub.Agents, id)
			}
		}
		hub.mu.Unlock()
	}
}

func main() {
	// Start cleanup loop for stale agents
	go startAgentCleanupLoop()

	// Load configuration
	cfg, err := config.Load("prism-server.conf")
	if err != nil {
		log.Printf("Config not found, using defaults: %v", err)
	}

	// Initialize Database
	dbPath := "prism.db" // Default path, could get from config later
	if cfg != nil && cfg.Database.Path != "" {
		dbPath = cfg.Database.Path
	}

	// Load JWT Secret from config if available
	if cfg != nil && cfg.Auth.JwtSecret != "" {
		api.JWTSecret = []byte(cfg.Auth.JwtSecret)
	}

	if err := db.InitDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Hub Server
	http.HandleFunc("/agent/connect", func(w http.ResponseWriter, r *http.Request) {
		handleAgentConnection(w, r, cfg) // Pass config
	})
	// Public Enum
	http.HandleFunc("/api/auth/login", api.HandleLogin)

	// Protected Endpoints
	http.HandleFunc("/api/agents", api.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" || r.Method == "OPTIONS" {
			handleListAgents(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}, "admin", "manager", "user"))

	http.HandleFunc("/api/agents/", api.AuthMiddleware(handleAgentAction, "admin")) // Only admins can approve/delete agents
	
	http.HandleFunc("/api/control", api.AuthMiddleware(handleServiceControl, "admin", "manager")) // manual inspection below
	
	http.HandleFunc("/api/security/ban", api.AuthMiddleware(handleGlobalBan, "admin", "manager"))
	http.HandleFunc("/api/security/unban", api.AuthMiddleware(handleGlobalUnban, "admin", "manager"))
	http.HandleFunc("/api/security/decisions", api.AuthMiddleware(handleSecurityDecisions, "admin", "manager", "user"))

	// REST API endpoints for Projects and Service Accounts
	// NOTE: If we want finer grain (GET vs POST), we can wrap the inside or create different handlers.
	// We'll wrap the top level with all 3, and inside the handlers block non-GETs for "user".
	http.HandleFunc("/api/projects", api.AuthMiddleware(api.HandleProjects, "admin", "manager", "user"))
	http.HandleFunc("/api/projects/", api.AuthMiddleware(api.HandleProjectDetail, "admin", "manager", "user"))
	http.HandleFunc("/api/accounts", api.AuthMiddleware(api.HandleAccounts, "admin", "manager", "user"))
	http.HandleFunc("/api/accounts/", api.AuthMiddleware(api.HandleAccountDetail, "admin", "manager", "user"))
	
	// REST API for Users (Admin only)
	http.HandleFunc("/api/users", api.AuthMiddleware(api.HandleUsers, "admin"))
	http.HandleFunc("/api/users/", api.AuthMiddleware(api.HandleUserDetail, "admin"))

	// Serve Frontend (Static Files) with SPA fallback
	fs := http.FileServer(http.Dir("./dist"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := "./dist" + r.URL.Path
		info, err := os.Stat(path)
		if os.IsNotExist(err) || info.IsDir() {
			http.ServeFile(w, r, "./dist/index.html")
			return
		}
		fs.ServeHTTP(w, r)
	})

	port := 65432
	if cfg != nil {
		port = cfg.Server.Port
	}

	api.ControlURL = fmt.Sprintf("http://localhost:%d/api/control", port)

	addr := fmt.Sprintf(":%d", port)
	log.Printf("Hub Server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func handleServiceControl(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims := api.GetUserClaims(r)
	if claims == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	type ControlRequest struct {
		AgentID string                 `json:"agent_id"`
		Service string                 `json:"service"`
		Action  string                 `json:"action"` // start, stop, restart, status, get_facts, db_...
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

	hub.mu.RLock()
	agent, ok := hub.Agents[agentDB.Hostname]
	hub.mu.RUnlock()

	if !ok {
		http.Error(w, "Agent is offline", http.StatusNotFound)
		return
	}

	service := req.Service
	if service == "firewall" {
		// Resolve active firewall
		found := false
		for name, svc := range agent.Services {
			if isActive, ok := svc.Metrics["is_active"]; ok && isActive == 1 {
				service = name
				found = true
				break
			}
		}
		if !found {
			// Fallback to ufw if no active one found (might be first time setup)
			if _, ok := agent.Services["ufw"]; ok {
				service = "ufw"
			} else {
				http.Error(w, "No active firewall found on agent", http.StatusNotFound)
				return
			}
		}
	}

	// Send Command to Agent
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

	// Prepare channel for response
	respCh := make(chan *protocol.Message, 1)
	hub.mu.Lock()
	hub.PendingResponses[cmdID] = respCh
	hub.mu.Unlock()

	defer func() {
		hub.mu.Lock()
		delete(hub.PendingResponses, cmdID)
		hub.mu.Unlock()
	}()

	if err := agent.Send(cmd); err != nil {
		http.Error(w, "Failed to send command to agent", http.StatusInternalServerError)
		return
	}

	// Wait for response with timeout
	// Increased to 30s for operations like Ansible playbooks
	select {
	case resp := <-respCh:
		// Forward response to client
		json.NewEncoder(w).Encode(resp.Payload)
	case <-time.After(30 * time.Second):
		http.Error(w, "Command timed out", http.StatusGatewayTimeout)
	}
}

func handleGlobalBan(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		IP       string `json:"ip"`
		Duration string `json:"duration"`
		Reason   string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.IP == "" {
		http.Error(w, "IP address is required", http.StatusBadRequest)
		return
	}

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	fireCount := 0
	for _, agent := range hub.Agents {
		cmdID := fmt.Sprintf("ban-%d", time.Now().UnixNano())
		cmd := protocol.Message{
			Type: protocol.MsgTypeCommand,
			Payload: protocol.CommandPayload{
				CommandID: cmdID,
				Action:    "crowdsec_add",
				Service:   "crowdsec",
				Options: map[string]interface{}{
					"ip":       req.IP,
					"duration": req.Duration,
					"reason":   req.Reason,
					"type":     "ban",
				},
			},
		}
		// Fire and forget - global bans attempt to hit all online agents
		// In a production system, we might want to collect responses 
		// and return an aggregate success/fail list.
		go agent.Send(cmd)
		fireCount++
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Ban command dispatched to %d agents", fireCount),
	})
}

func handleGlobalUnban(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		IP string `json:"ip"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.IP == "" {
		http.Error(w, "IP address is required", http.StatusBadRequest)
		return
	}

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	fireCount := 0
	for _, agent := range hub.Agents {
		cmdID := fmt.Sprintf("unban-%d", time.Now().UnixNano())
		cmd := protocol.Message{
			Type: protocol.MsgTypeCommand,
			Payload: protocol.CommandPayload{
				CommandID: cmdID,
				Action:    "crowdsec_delete_by_ip",
				Service:   "crowdsec",
				Options: map[string]interface{}{
					"ip": req.IP,
				},
			},
		}
		go agent.Send(cmd)
		fireCount++
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Unban command dispatched to %d agents", fireCount),
	})
}

func handleSecurityDecisions(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// We must gather decisions concurrently from all online agents
	hub.mu.RLock()
	agents := make([]*AgentSession, 0, len(hub.Agents))
	for _, agent := range hub.Agents {
		// Only poll if they have the crowdsec service running
		if svc, ok := agent.Services["crowdsec"]; ok && svc.Status == "running" {
			agents = append(agents, agent)
		}
	}
	hub.mu.RUnlock()

	if len(agents) == 0 {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	type DecisionItem struct {
		ID        int    `json:"id"`
		Origin    string `json:"origin"`
		Type      string `json:"type"`
		Scope     string `json:"scope"`
		Value     string `json:"value"`
		Duration  string `json:"duration"`
		Reason    string `json:"scenario"`
		AgentName string `json:"agent_name"`
		AgentID   string `json:"agent_id"`
	}

	var mu sync.Mutex
	var allDecisions []DecisionItem
	var wg sync.WaitGroup

	for _, agent := range agents {
		wg.Add(1)
		go func(ag *AgentSession) {
			defer wg.Done()
			
			cmdID := fmt.Sprintf("cslist-%d", time.Now().UnixNano())
			cmd := protocol.Message{
				Type: protocol.MsgTypeCommand,
				Payload: protocol.CommandPayload{
					CommandID: cmdID,
					Action:    "crowdsec_list",
					Service:   "crowdsec",
				},
			}

			respCh := make(chan *protocol.Message, 1)
			
			hub.mu.Lock()
			hub.PendingResponses[cmdID] = respCh
			hub.mu.Unlock()

			defer func() {
				hub.mu.Lock()
				delete(hub.PendingResponses, cmdID)
				hub.mu.Unlock()
			}()

			if err := ag.Send(cmd); err != nil {
				return
			}

			select {
			case resp := <-respCh:
				if respPayload, ok := resp.Payload.(map[string]interface{}); ok {
					if success, _ := respPayload["success"].(bool); success {
						if msg, _ := respPayload["message"].(string); msg != "" && msg != "[]" && msg != "null" {
							var decs []DecisionItem
							if err := json.Unmarshal([]byte(msg), &decs); err == nil {
								// Assign metadata
								for i := range decs {
									decs[i].AgentName = ag.ID // We use ID (hostname) as name
									decs[i].AgentID = ag.ID
								}
								mu.Lock()
								allDecisions = append(allDecisions, decs...)
								mu.Unlock()
							}
						}
					}
				}
			case <-time.After(5 * time.Second): // Quick timeout for UI
				return
			}
		}(agent)
	}

	wg.Wait()

	if allDecisions == nil {
		allDecisions = []DecisionItem{} // Always return array instead of null
	}
	json.NewEncoder(w).Encode(allDecisions)
}
