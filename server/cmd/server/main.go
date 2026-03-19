package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"prism-server/internal/api"
	"prism-server/internal/config"
	"prism-server/internal/db"
	"prism-server/internal/middleware"
	"prism-server/internal/models"
	"prism-server/internal/protocol"
	"prism-server/internal/ws"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

var logger *slog.Logger
var wsHub *ws.Hub
var serverConfig *config.Config // Global config for token access

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Restrict CORS - only allow same origin or localhost in development
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		host := r.Host
		return strings.Contains(origin, host) ||
			strings.HasPrefix(origin, "http://localhost") ||
			strings.HasPrefix(origin, "http://127.0.0.1") ||
			strings.HasPrefix(origin, "ws://localhost") ||
			strings.HasPrefix(origin, "ws://127.0.0.1")
	},
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
	Agents           map[string]*AgentSession
	PendingResponses map[string]chan *protocol.Message
	mu               sync.RWMutex
}

var hub = Hub{
	Agents:           make(map[string]*AgentSession),
	PendingResponses: make(map[string]chan *protocol.Message),
}

// Thread-safe response channel helpers to prevent race conditions
func getResponseChan(cmdID string) (chan *protocol.Message, bool) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	ch, ok := hub.PendingResponses[cmdID]
	return ch, ok
}

func setResponseChan(cmdID string, ch chan *protocol.Message) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	hub.PendingResponses[cmdID] = ch
}

func deleteResponseChan(cmdID string) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	delete(hub.PendingResponses, cmdID)
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
		log.Printf("Security Alert: Invalid token from agent at %s. Token received: '%s...'. Expected token starts with: '%s...'", r.RemoteAddr, token[:min(len(token), 4)], expectedToken[:min(len(expectedToken), 4)])
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Invalid token. Please check your prism-agent.conf."},
		})
		return
	}

	// Token is valid. Now check Agent approval status in database.
	osInfo, _ := payloadMap["os_info"].(string)
	agentIDPayload, _ := payloadMap["agent_id"].(string)

	var agent *models.Agent

	if agentIDPayload != "" {
		agent, err = db.GetAgentByID(agentIDPayload)
	} else {
		// Fallback to hostname for older agents (transitional)
		agent, err = db.GetAgentByHostname(hostname)
	}

	if err != nil {
		log.Printf("Database error checking agent %s: %v", hostname, err)
		return
	}

	if agent == nil {
		// Check if another entry with the same hostname exists (e.g. agent re-deployed with a new ID).
		// If so, re-use that entry by updating its ID rather than creating a duplicate.
		existing, _ := db.GetAgentByHostname(hostname)
		if existing != nil && existing.ID != agentIDPayload {
			log.Printf("Agent '%s' reconnected with new ID %s (old: %s). Updating ID.", hostname, agentIDPayload, existing.ID)
			db.ReplaceAgentID(existing.ID, agentIDPayload)
			agent, _ = db.GetAgentByID(agentIDPayload)
		}

		if agent == nil {
			// Truly new agent: insert as 'pending'
			newAgent := models.Agent{
				ID:       agentIDPayload,
				Hostname: hostname,
				OSInfo:   osInfo,
				Status:   "pending",
				LastSeen: time.Now().UTC().Format(time.RFC3339),
			}
			db.CreateAgent(newAgent)
			log.Printf("New Agent '%s' (%s) discovered. Registered as pending. Awaiting approval.", hostname, agentIDPayload)

			conn.WriteJSON(protocol.Message{
				Type:    protocol.MsgTypeResponse,
				Payload: map[string]string{"error": "Agent approval pending"},
			})
			return
		}
	}

	// Only allow approved or offline (previously approved) agents to connect
	if agent.Status == "pending" {
		log.Printf("Agent '%s' is pending approval. Connection rejected until approved.", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent approval pending"},
		})
		return // IMPORTANT: Return here!
	}

	if agent.Status == "rejected" {
		log.Printf("Agent '%s' connection rejected (Status: rejected)", hostname)
		conn.WriteJSON(protocol.Message{
			Type:    protocol.MsgTypeResponse,
			Payload: map[string]string{"error": "Agent rejected"},
		})
		return
	}

	// Agent is approved or offline (previously approved). Update status to online and update last seen.
	db.UpdateAgentStatus(agent.ID, "online", agent.Name, agent.Description)
	db.UpdateAgentLastSeen(agent.ID, osInfo)

	log.Printf("Agent '%s' (%s) connected successfully (status: %s -> online)", hostname, agent.ID, agent.Status)

	// Register connected Session using persistent ID
	agentID := agent.ID
	session := &AgentSession{
		ID:       agentID,
		Conn:     conn,
		Services: make(map[string]protocol.ServiceInfo),
		LastSeen: time.Now(),
	}

	// Store Services from registration payload
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

	// Fetch Heartbeat Interval from DB
	heartbeatInterval := 15 // Default 15s
	if settings, err := db.GetSettings(); err == nil {
		for _, s := range settings {
			if s.Key == "heartbeatInterval" || s.Key == "pollingInterval" {
				if val, err := time.ParseDuration(s.Value); err == nil {
					heartbeatInterval = int(val.Seconds())
					break
				}
			}
		}
	}
	if heartbeatInterval <= 0 {
		heartbeatInterval = 15
	}

	// Send Welcome message
	welcome := protocol.Message{
		Type: protocol.MsgTypeWelcome,
		Payload: protocol.WelcomePayload{
			AgentID:           agentID,
			HeartbeatInterval: heartbeatInterval,
		},
	}
	session.Send(welcome)

	// Send permanent token to agent for persistent authentication
	tokenCmd := protocol.Message{
		Type: protocol.MsgTypeCommand,
		Payload: map[string]interface{}{
			"action":     "agent_set_hub_token",
			"service":    "agent",
			"command_id": fmt.Sprintf("set-token-%d", time.Now().UnixNano()),
			"options": map[string]interface{}{
				"token": serverConfig.Auth.Token,
			},
		},
	}
	session.Send(tokenCmd)
	log.Printf("Sent permanent token to connected agent %s", agentID)

	// Continue to message loop...

	// Broadcast agent connection to frontend via WebSocket
	agentData := map[string]interface{}{
		"id":       agentID,
		"hostname": hostname,
		"status":   "online",
		"services": session.Services,
		"lastSeen": time.Now().UTC().Format(time.RFC3339),
	}
	broadcastAgentUpdate(agentData, "agent_connected")

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

				// Check if agent is pending - skip status updates for pending agents
				dbAgent, err := db.GetAgentByID(agentID)
				if err == nil && dbAgent != nil && dbAgent.Status == "pending" {
					// Skip status updates for pending agents
					continue
				}

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
					// Use thread-safe helper
					if ch, ok := getResponseChan(cmdID); ok && ch != nil {
						select {
						case ch <- &incoming:
						default:
							// Channel full or closed, skip
						}
					}
				}
			}
		}

		if incoming.Type == protocol.MsgTypeEvent {
			if payloadMap, ok := incoming.Payload.(map[string]interface{}); ok && payloadMap != nil {
				// Get agent info to save with the event
				agentRecord, err := db.GetAgentByID(agentID)
				if err != nil || agentRecord == nil {
					log.Printf("Failed to resolve agent %s for event: %v", agentID, err)
					continue
				}

				typeName, _ := payloadMap["type"].(string)
				service, _ := payloadMap["service"].(string)
				status, _ := payloadMap["status"].(string)
				message, _ := payloadMap["message"].(string)

				event := models.Event{
					AgentID: agentRecord.ID,
					Type:    typeName,
					Service: service,
					Status:  status,
					Message: message,
				}

				if _, err := db.CreateEvent(event); err != nil {
					log.Printf("Failed to save event from %s: %v", agentID, err)
				} else {
					log.Printf("Event saved from %s: %s %s (%s)", agentID, typeName, service, status)
				}
			}
		}
	}

	hub.mu.Lock()
	delete(hub.Agents, agentID)
	hub.mu.Unlock()

	// Broadcast agent disconnection to frontend
	broadcastAgentUpdate(map[string]interface{}{
		"id":       agentID,
		"hostname": agentID,
		"status":   "offline",
	}, "agent_disconnected")
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
		Services    []protocol.ServiceInfo `json:"services"`
	}

	var list []AgentSummary
	for _, a := range agentsDB {
		var svcInfos []protocol.ServiceInfo
		status := a.Status

		if session, ok := hub.Agents[a.ID]; ok {
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
		// 1. Get agent first - try by ID, then by hostname
		agentRecord, err := db.GetAgentByID(id)
		if err != nil || agentRecord == nil {
			// Try by hostname
			agentRecord, err = db.GetAgentByHostname(id)
			if err != nil || agentRecord == nil {
				http.Error(w, "Agent not found", http.StatusNotFound)
				return
			}
		}

		// 2. Delete from database using correct ID
		if err := db.DeleteAgent(agentRecord.ID); err != nil {
			http.Error(w, "Failed to delete agent", http.StatusInternalServerError)
			return
		}

		log.Printf("Agent '%s' (%s) deleted successfully", agentRecord.Hostname, agentRecord.ID)

		// 3. Forcefully disconnect WS session if it exists to trigger auto re-registration
		hub.mu.Lock()
		if session, ok := hub.Agents[agentRecord.ID]; ok {
			log.Printf("Forcefully disconnecting agent %s due to deletion", agentRecord.Hostname)
			session.Conn.Close()
			delete(hub.Agents, agentRecord.ID)
		}
		hub.mu.Unlock()

		// 4. Broadcast deletion to frontend
		broadcastAgentUpdate(map[string]interface{}{
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
			// Don't fail if body is empty for backwards compatibility, but log it
			log.Printf("Warning: failed to decode approve payload: %v", err)
		}

		// Try to get agent by ID first, then by hostname (since URL might use either)
		agentRecord, err := db.GetAgentByID(id)
		if err != nil || agentRecord == nil {
			// Try by hostname
			agentRecord, err = db.GetAgentByHostname(id)
			if err != nil || agentRecord == nil {
				http.Error(w, "Agent not found", http.StatusNotFound)
				return
			}
		}

		// Update using the correct ID
		if err := db.UpdateAgentStatus(agentRecord.ID, "approved", payload.Name, payload.Description); err != nil {
			http.Error(w, "Failed to approve agent", http.StatusInternalServerError)
			return
		}

		log.Printf("Agent '%s' (%s) approved successfully", agentRecord.Hostname, agentRecord.ID)

		// Broadcast approval to frontend immediately (so UI updates without waiting for agent reconnect)
		broadcastAgentUpdate(map[string]interface{}{
			"id":          agentRecord.ID,
			"hostname":    agentRecord.Hostname,
			"name":        payload.Name,
			"description": payload.Description,
			"status":      "approved",
		}, "agent_approved")

		// Send token to agent if connected
		hub.mu.RLock()
		agentSession, exists := hub.Agents[agentRecord.ID]
		hub.mu.RUnlock()

		if exists && agentSession != nil {
			// Send command to agent to save the token
			tokenCmd := protocol.Message{
				Type: protocol.MsgTypeCommand,
				Payload: map[string]interface{}{
					"action":     "agent_set_hub_token",
					"service":    "agent",
					"command_id": fmt.Sprintf("set-token-%d", time.Now().UnixNano()),
					"options": map[string]interface{}{
						"token": serverConfig.Auth.Token,
					},
				},
			}
			if err := agentSession.Send(tokenCmd); err != nil {
				log.Printf("Failed to send token to agent %s: %v", agentRecord.Hostname, err)
			} else {
				log.Printf("Sent permanent token to agent %s", agentRecord.Hostname)
			}
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
		var disconnectedAgents []string
		for id, agent := range hub.Agents {
			// increased timeout to 90s (default heartbeat 15s * 6) to be more resilient
			if now.Sub(agent.LastSeen) > 90*time.Second {
				log.Printf("Agent %s timed out (no KeepAlive for 90s), marking as offline...", id)
				agent.Conn.Close()
				disconnectedAgents = append(disconnectedAgents, id)
			}
		}
		// Remove disconnected agents from hub
		for _, id := range disconnectedAgents {
			delete(hub.Agents, id)
		}
		hub.mu.Unlock()

		// Update status in database (don't delete, just mark as offline)
		for _, id := range disconnectedAgents {
			agentRecord, err := db.GetAgentByID(id)
			if err == nil && agentRecord != nil {
				db.UpdateAgentStatus(agentRecord.ID, "offline", agentRecord.Name, agentRecord.Description)
				log.Printf("Agent '%s' marked as offline in database", agentRecord.Hostname)
				broadcastAgentUpdate(map[string]interface{}{
					"id":       agentRecord.ID,
					"hostname": agentRecord.Hostname,
					"status":   "offline",
				}, "agent_disconnected")
			}
		}
	}
}

func main() {
	// Initialize structured logger
	logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	// Start cleanup loop for stale agents
	go startAgentCleanupLoop()

	// Load configuration
	cfg, err := config.Load("prism-server.conf")
	if err != nil {
		logger.Warn("Config not found, using defaults", "error", err)
		cfg = &config.Config{}
	}

	// Store config globally for token access
	serverConfig = cfg

	// Validate configuration and generate secure secrets if needed
	if err := cfg.Validate("prism-server.conf"); err != nil {
		logger.Error("Configuration validation failed", "error", err)
		os.Exit(1)
	}

	// Initialize Database
	dbPath := "prism.db"
	if cfg != nil && cfg.Database.Path != "" {
		dbPath = cfg.Database.Path
	}

	// Load JWT Secret from config
	if cfg != nil && cfg.Auth.JwtSecret != "" {
		api.JWTSecret = []byte(cfg.Auth.JwtSecret)
	}

	if err := db.InitDB(dbPath); err != nil {
		logger.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	// Initialize Valkey cache
	if cfg != nil {
		cacheCfg := db.CacheConfig{
			Addr:     cfg.Valkey.Addr,
			Password: cfg.Valkey.Password,
			DB:       cfg.Valkey.DB,
		}
		if err := db.InitCache(context.Background(), cacheCfg); err != nil {
			logger.Warn("Failed to initialize Valkey cache", "error", err)
		}
	}

	logger.Info("Database initialized", "path", dbPath)

	// Initialize WebSocket Hub
	// Note: Valkey cache integration can be added here for Pub/Sub
	wsHub = ws.NewHub(nil)
	go wsHub.Run()

	// Hub Server
	http.HandleFunc("/agent/connect", func(w http.ResponseWriter, r *http.Request) {
		handleAgentConnection(w, r, cfg) // Pass config
	})

	// WebSocket endpoint for Frontend real-time updates
	http.HandleFunc("/ws/agents", handleFrontendAgentsWS)

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

	http.HandleFunc("/api/control", api.AuthMiddleware(handleServiceControl, "admin", "manager"))
	http.HandleFunc("/api/control/import", api.AuthMiddleware(handleServiceImport, "admin", "manager"))

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
	http.HandleFunc("/api/users/me", api.AuthMiddleware(api.HandleMe, "admin", "manager", "user"))

	// REST API for Settings
	http.HandleFunc("/api/settings", api.AuthMiddleware(api.HandleSettings, "admin", "manager", "user"))

	// REST API for Logs
	http.HandleFunc("/api/logs", api.AuthMiddleware(api.HandleLogs, "admin", "manager", "user"))

	// Health check endpoints
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/ready", handleReady)

	// Serve Frontend (Static Files) with SPA fallback - Fixed path traversal vulnerability
	fs := http.FileServer(http.Dir("./dist"))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Clean and validate the path to prevent directory traversal
		cleanPath := filepath.Clean(r.URL.Path)

		// Reject any path that tries to escape the dist directory
		if strings.HasPrefix(cleanPath, "..") || strings.Contains(cleanPath, "..") {
			http.Error(w, "Invalid path", http.StatusBadRequest)
			return
		}

		// Build the full path
		fullPath := filepath.Join("./dist", cleanPath)

		// Verify the resolved path is still within dist directory
		absDist, _ := filepath.Abs("./dist")
		absFull, _ := filepath.Abs(fullPath)
		if !strings.HasPrefix(absFull, absDist) {
			http.Error(w, "Invalid path", http.StatusBadRequest)
			return
		}

		// Check if file exists
		info, err := os.Stat(fullPath)
		if os.IsNotExist(err) || info.IsDir() {
			// SPA fallback - serve index.html for non-existent routes
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
	logger.Info("Hub Server starting", "address", addr, "port", port)

	// Create server with timeouts for graceful shutdown
	// Note: WebSocket endpoint (/agent/connect) must NOT go through middleware
	// because middleware wraps ResponseWriter and breaks http.Hijacker interface
	server := &http.Server{
		Addr:         addr,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// WebSocket endpoint - skip middleware
			if r.URL.Path == "/agent/connect" {
				http.DefaultServeMux.ServeHTTP(w, r)
				return
			}
			// All other endpoints - use middleware
			middleware.LoggingMiddleware(
				middleware.RequestIDMiddleware(
					http.DefaultServeMux,
				),
			).ServeHTTP(w, r)
		}),
	}

	// Start server in goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Server failed", "error", err)
			os.Exit(1)
		}
	}()

	logger.Info("Hub Server listening", "address", addr)

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Create context with timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited properly")
}

// handleFrontendAgentsWS handles WebSocket connections from frontend for real-time agent updates
func handleFrontendAgentsWS(w http.ResponseWriter, r *http.Request) {
	// Authenticate user
	token := r.URL.Query().Get("token")
	if token == "" {
		// Try to get from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				token = parts[1]
			}
		}
	}

	// Validate token (basic validation, can be enhanced)
	if token == "" {
		http.Error(w, "Authorization required", http.StatusUnauthorized)
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Warn("Failed to upgrade WebSocket connection", "error", err)
		return
	}

	// Generate client ID from token (simplified, could use JWT claims)
	clientID := fmt.Sprintf("frontend-%d", time.Now().UnixNano())

	// Handle WebSocket client
	if wsHub != nil {
		go wsHub.HandleClient(conn, clientID)
	} else {
		logger.Error("WebSocket hub not initialized")
		conn.Close()
	}
}

// broadcastAgentUpdate broadcasts agent update to all connected WebSocket clients
func broadcastAgentUpdate(agent map[string]interface{}, updateType string) {
	if wsHub == nil {
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
		logger.Error("Failed to marshal agent update", "error", err)
		return
	}

	// Broadcast to all subscribed clients
	wsHub.BroadcastToChannel("agents", data)
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

	// Check if agent is pending - cannot execute commands on pending agents
	if agentDB.Status == "pending" {
		http.Error(w, "Agent is pending approval. Please approve agent first.", http.StatusForbidden)
		return
	}

	hub.mu.RLock()
	agent, ok := hub.Agents[agentDB.ID]
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

	// Prepare channel for response - use thread-safe helper
	respCh := make(chan *protocol.Message, 1)
	setResponseChan(cmdID, respCh)
	defer deleteResponseChan(cmdID)

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
			setResponseChan(cmdID, respCh)
			defer deleteResponseChan(cmdID)

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

func handleServiceImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	claims := api.GetUserClaims(r)
	if claims == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		AgentID string `json:"agent_id"`
		Service string `json:"service"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	agentDB, err := db.GetAgentByID(req.AgentID)
	if err != nil || agentDB == nil {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}

	hub.mu.RLock()
	agentSession, ok := hub.Agents[agentDB.ID]
	hub.mu.RUnlock()

	if !ok {
		http.Error(w, "Agent is offline", http.StatusNotFound)
		return
	}

	// 1. Get Discovered Items & Settings (Concurrent)
	type result struct {
		data string
		err  error
	}
	importCh := make(chan result, 1)
	settingsCh := make(chan result, 1)

	go func() {
		cmdID := fmt.Sprintf("import-%d", time.Now().UnixNano())
		cmd := protocol.Message{
			Type: protocol.MsgTypeCommand,
			Payload: protocol.CommandPayload{
				CommandID: cmdID,
				Action:    "service_import_items",
				Service:   req.Service,
			},
		}

		respCh := make(chan *protocol.Message, 1)
		setResponseChan(cmdID, respCh)
		defer deleteResponseChan(cmdID)

		if err := agentSession.Send(cmd); err != nil {
			importCh <- result{err: err}
			return
		}

		select {
		case resp := <-respCh:
			outputMap, _ := resp.Payload.(map[string]interface{})
			// Check for both success and output
			success, _ := outputMap["success"].(bool)
			outputStr, _ := outputMap["output"].(string)
			if !success {
				errMsg, _ := outputMap["error"].(string)
				importCh <- result{err: fmt.Errorf("%s", errMsg)}
			} else {
				importCh <- result{data: outputStr}
			}
		case <-time.After(15 * time.Second):
			importCh <- result{err: fmt.Errorf("import timed out")}
		}
	}()

	go func() {
		cmdID := fmt.Sprintf("settings-%d", time.Now().UnixNano())
		cmd := protocol.Message{
			Type: protocol.MsgTypeCommand,
			Payload: protocol.CommandPayload{
				CommandID: cmdID,
				Action:    "service_get_settings",
				Service:   req.Service,
			},
		}

		respCh := make(chan *protocol.Message, 1)
		setResponseChan(cmdID, respCh)
		defer deleteResponseChan(cmdID)

		if err := agentSession.Send(cmd); err != nil {
			settingsCh <- result{err: err}
			return
		}

		select {
		case resp := <-respCh:
			outputMap, _ := resp.Payload.(map[string]interface{})
			outputStr, _ := outputMap["output"].(string)
			settingsCh <- result{data: outputStr}
		case <-time.After(15 * time.Second):
			settingsCh <- result{err: fmt.Errorf("settings timed out")}
		}
	}()

	importRes := <-importCh
	if importRes.err != nil {
		http.Error(w, "Failed to get discovered items: "+importRes.err.Error(), http.StatusInternalServerError)
		return
	}

	settingsRes := <-settingsCh
	var currentSettings map[string]interface{}
	if settingsRes.err == nil && settingsRes.data != "" {
		json.Unmarshal([]byte(settingsRes.data), &currentSettings)
	}

	// Parse Items
	var discovered struct {
		Databases    []string `json:"databases"`
		Users        []string `json:"users"`
		FtpUsers     []string `json:"ftp_users"`
		Sites        []string `json:"sites"`
		Buckets      []string `json:"buckets"`
		StorageUsers []struct {
			AccessKey string `json:"access_key"`
		} `json:"storage_users"`
		VHosts  []string `json:"vhosts"`
		MQUsers []struct {
			Name string `json:"name"`
			Tags string `json:"tags"`
		} `json:"mq_users"`
		Processes []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"processes"`
		MQTTUsers    []string `json:"mqtt_users"`
		ImportErrors []string `json:"import_errors"`
	}
	if err := json.Unmarshal([]byte(importRes.data), &discovered); err != nil {
		http.Error(w, "Failed to parse discovered items: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Check for partial errors from agent
	if len(discovered.ImportErrors) > 0 {
		log.Printf("Warning: Agent reported partial import errors for %s: %v", req.Service, discovered.ImportErrors)
	}

	// 3. Reverse Load into Database
	existingAccounts, _ := db.GetServiceAccounts("")
	memo := make(map[string]bool)
	for _, acc := range existingAccounts {
		if acc.AgentID == req.AgentID && acc.Type == req.Service {
			memo[acc.Name] = true
		}
	}

	addedCount := 0

	// Try to get port from settings
	port := 0
	if currentSettings != nil {
		if pVal, ok := currentSettings["port"]; ok {
			switch v := pVal.(type) {
			case float64:
				port = int(v)
			case string:
				fmt.Sscanf(v, "%d", &port)
			}
		}
	}

	// Helper to add discovery account
	addAccount := func(name, accType string, extra map[string]interface{}) {
		if memo[name] {
			return
		}

		acc := models.ServiceAccount{
			AgentID: req.AgentID,
			Type:    accType,
			Name:    name,
			Port:    port,
			Tags:    []string{"imported", "discovered"},
		}

		// Field specific defaults
		if accType == "s3-minio" || accType == "s3-garage" {
			if root, ok := extra["root"].(string); ok {
				acc.Bucket = root
			}
			if key, ok := extra["access_key"].(string); ok {
				acc.AccessKey = key
				acc.Name = key // use key as name for users
			}
		}

		if req.Service == "rabbitmq" {
			if vhost, ok := extra["vhost"].(string); ok {
				acc.VHost = vhost
			}
		}

		if req.Service == "pm2" || req.Service == "supervisor" || req.Service == "systemd" {
			acc.AppName = name
			if id, ok := extra["id"].(string); ok {
				acc.ID = id // Keep original ID if possible for managed processes
			}
		}

		db.CreateServiceAccount(acc)
		addedCount++
	}

	// Iterate discovered
	for _, name := range discovered.Databases {
		if name == "information_schema" || name == "performance_schema" || name == "mysql" || name == "sys" || name == "postgres" {
			continue
		}
		addAccount(name, req.Service, nil)
	}

	for _, name := range discovered.Users {
		if name == "root" || name == "admin" || name == "postgres" {
			continue
		}
		addAccount(name, req.Service, nil)
	}

	for _, name := range discovered.FtpUsers {
		addAccount(name, req.Service, nil)
	}

	for _, name := range discovered.Sites {
		addAccount(name, req.Service, nil)
	}

	for _, name := range discovered.Buckets {
		addAccount(name, req.Service, map[string]interface{}{"root": name})
	}

	for _, u := range discovered.StorageUsers {
		addAccount(u.AccessKey, req.Service, map[string]interface{}{"access_key": u.AccessKey})
	}

	for _, vhost := range discovered.VHosts {
		addAccount(vhost, req.Service, map[string]interface{}{"vhost": vhost})
	}

	for _, u := range discovered.MQUsers {
		addAccount(u.Name, req.Service, map[string]interface{}{"role": u.Tags})
	}

	for _, p := range discovered.Processes {
		addAccount(p.Name, req.Service, map[string]interface{}{"id": p.ID})
	}

	for _, name := range discovered.MQTTUsers {
		addAccount(name, req.Service, nil)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"added":   addedCount,
		"message": fmt.Sprintf("Imported %d new items from %s", addedCount, req.Service),
	})
}

// handleHealth returns server health status
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
	}

	// Check database
	if db.DB != nil {
		if err := db.DB.Ping(); err != nil {
			health["database"] = "unhealthy"
			health["status"] = "unhealthy"
		} else {
			health["database"] = "healthy"
		}
	} else {
		health["database"] = "not configured"
	}

	// Check WebSocket hub
	if wsHub != nil {
		health["websocket_clients"] = wsHub.GetClientCount()
	}

	// Check agents
	hub.mu.RLock()
	health["connected_agents"] = len(hub.Agents)
	hub.mu.RUnlock()

	status := http.StatusOK
	if health["status"] == "unhealthy" {
		status = http.StatusServiceUnavailable
	}

	w.WriteHeader(status)
	json.NewEncoder(w).Encode(health)
}

// handleReady returns server readiness status
func handleReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ready := true
	reasons := []string{}

	// Check database
	if db.DB == nil {
		ready = false
		reasons = append(reasons, "database not initialized")
	} else if err := db.DB.Ping(); err != nil {
		ready = false
		reasons = append(reasons, "database connection failed")
	}

	// Check if server can accept connections
	hub.mu.RLock()
	agentCount := len(hub.Agents)
	hub.mu.RUnlock()

	if agentCount == 0 {
		// Not necessarily unready, but worth noting
		reasons = append(reasons, "no agents connected")
	}

	response := map[string]interface{}{
		"status": "ready",
	}

	if !ready {
		response["status"] = "not ready"
		response["reasons"] = reasons
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	json.NewEncoder(w).Encode(response)
}
