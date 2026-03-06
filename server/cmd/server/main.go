package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"prism-server/internal/api"
	"prism-server/internal/config"
	"prism-server/internal/db"
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
	Services map[string]string
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
	if !ok {
		log.Println("Invalid payload format")
		return
	}

	// Simply map to struct (in production use mapstructure or json marshaling)
	// For now, let's just extract what we need
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

	// Register Agent
	agentID := hostname
	session := &AgentSession{
		ID:       agentID,
		Conn:     conn,
		Services: make(map[string]string),
		LastSeen: time.Now(),
	}

	// Store Services
	if servicesInterface, ok := payloadMap["services"].([]interface{}); ok {
		for _, s := range servicesInterface {
			if sMap, ok := s.(map[string]interface{}); ok {
				name, _ := sMap["name"].(string)
				status, _ := sMap["status"].(string)
				session.Services[name] = status
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
				payloadMap, _ := incoming.Payload.(map[string]interface{})
				if servicesInterface, ok := payloadMap["services"].([]interface{}); ok {
					for _, s := range servicesInterface {
						if sMap, ok := s.(map[string]interface{}); ok {
							name, _ := sMap["name"].(string)
							status, _ := sMap["status"].(string)
							agent.Services[name] = status
						}
					}
				}
			}
			hub.mu.Unlock()
		}

		if incoming.Type == protocol.MsgTypeResponse {
			payloadMap, _ := incoming.Payload.(map[string]interface{})
			cmdID, _ := payloadMap["command_id"].(string)

			hub.mu.RLock()
			ch, ok := hub.PendingResponses[cmdID]
			hub.mu.RUnlock()

			if ok {
				ch <- &incoming
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

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	type AgentSummary struct {
		ID       string                 `json:"id"`
		Services []protocol.ServiceInfo `json:"services"`
	}

	var list []AgentSummary
	for _, a := range hub.Agents {
		var svcInfos []protocol.ServiceInfo
		for name, status := range a.Services {
			svcInfos = append(svcInfos, protocol.ServiceInfo{Name: name, Status: status})
		}
		list = append(list, AgentSummary{
			ID:       a.ID,
			Services: svcInfos,
		})
	}

	json.NewEncoder(w).Encode(list)
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
	if err := db.InitDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Hub Server
	http.HandleFunc("/agent/connect", func(w http.ResponseWriter, r *http.Request) {
		handleAgentConnection(w, r, cfg) // Pass config
	})
	http.HandleFunc("/api/agents", handleListAgents)
	http.HandleFunc("/api/control", handleServiceControl) // New endpoint

	// New REST API endpoints for Projects and Service Accounts
	http.HandleFunc("/api/projects", api.HandleProjects)
	http.HandleFunc("/api/projects/", api.HandleProjectDetail)
	http.HandleFunc("/api/accounts", api.HandleAccounts)
	http.HandleFunc("/api/accounts/", api.HandleAccountDetail)

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

	addr := fmt.Sprintf(":%d", port)
	log.Printf("Hub Server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func handleServiceControl(w http.ResponseWriter, r *http.Request) {
	// Enable CORS (restricted to localhost/127.0.0.1 for dev, should be configured for prod)
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

	hub.mu.RLock()
	agent, ok := hub.Agents[req.AgentID]
	hub.mu.RUnlock()

	if !ok {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}

	// Send Command to Agent
	cmdID := fmt.Sprintf("%d", time.Now().UnixNano())
	cmd := protocol.Message{
		Type: protocol.MsgTypeCommand,
		Payload: protocol.CommandPayload{
			CommandID: cmdID,
			Action:    req.Action,
			Service:   req.Service,
			Options:   req.Options, // Add Options field to CommandPayload in protocol!
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
