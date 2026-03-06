package main

import (
	"encoding/json"
	"fitz-server/internal/config"
	"fitz-server/internal/protocol"
	"fmt"
	"log"
	"net/http"
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
	Services []string
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
	mu     sync.RWMutex
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
	expectedToken := "secret-token" // Default
	if cfg != nil && cfg.Auth.Token != "" {
		expectedToken = cfg.Auth.Token
	}

	if token != expectedToken {
		log.Printf("Invalid token from %s. Expected: %s, Got: %s", hostname, expectedToken, token)
		// No need to lock here as session isn't created/shared yet, or create temp session
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse, // Or error type
			Payload: map[string]string{"error": "Invalid token"},
		})
		return
	}

	// Register Agent
	agentID := hostname 
	session := &AgentSession{
		ID:       agentID,
		Conn:     conn,
		LastSeen: time.Now(),
	}

	// Store Services
	if servicesInterface, ok := payloadMap["services"].([]interface{}); ok {
		for _, s := range servicesInterface {
			if str, ok := s.(string); ok {
				session.Services = append(session.Services, str)
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
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		return
	}

	hub.mu.RLock()
	defer hub.mu.RUnlock()
	
	type AgentSummary struct {
		ID       string   `json:"id"`
		Services []string `json:"services"`
	}
	
	var list []AgentSummary
	for _, a := range hub.Agents {
		list = append(list, AgentSummary{
			ID:       a.ID,
			Services: a.Services,
		})
	}
	
	json.NewEncoder(w).Encode(list)
}

func main() {
	// Load configuration
	cfg, err := config.Load("fitz-server.conf")
	if err != nil {
		log.Printf("Config not found, using defaults: %v", err)
	}

	// Hub Server
	http.HandleFunc("/agent/connect", func(w http.ResponseWriter, r *http.Request) {
		handleAgentConnection(w, r, cfg) // Pass config
	})
	http.HandleFunc("/api/agents", handleListAgents)
	http.HandleFunc("/api/control", handleServiceControl) // New endpoint

	// Serve Frontend (Static Files)
	fs := http.FileServer(http.Dir("./dist"))
	http.Handle("/", fs)
	
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
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

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
	select {
	case resp := <-respCh:
		// Forward response to client
		json.NewEncoder(w).Encode(resp.Payload)
	case <-time.After(5 * time.Second):
		http.Error(w, "Command timed out", http.StatusGatewayTimeout)
	}
}
