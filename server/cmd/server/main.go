package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"prism-server/internal/api"
	"prism-server/internal/config"
	"prism-server/internal/db"
	"prism-server/internal/hub"
	"prism-server/internal/metrics"
	"prism-server/internal/middleware"
	"prism-server/internal/models"
	"prism-server/internal/security"
	"prism-server/internal/webhook"
	"prism-server/internal/ws"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

var logger *slog.Logger
var wsHub *ws.Hub
var agentHub *hub.Hub
var serverConfig *config.Config             // Global config for token access
var globalCA *security.CertificateAuthority // Global Certificate Authority for signing agent certificates
var metricsCollector *metrics.MetricsCollector

// Log streaming for real-time WebSocket updates
type LogSubscriber struct {
	agentID string
	service string
	ch      chan models.AuditLog
}

var (
	logSubscribers   = make(map[*LogSubscriber]bool)
	logSubscribersMu sync.RWMutex
)

// WebSocket upgrader with per-message deflate compression (RFC 7692)
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
	EnableCompression: true, // Enable per-message deflate compression
}

// handleAgentConnection handles the WebSocket connection from the agent
func handleAgentConnection(w http.ResponseWriter, r *http.Request) {
	api.HandleAgentConnection(w, r)
}

func startAgentCleanupLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		var disconnectedAgents []string

		agents := agentHub.GetAgents()
		for id, agent := range agents {
			if now.Sub(agent.LastSeen) > 90*time.Second {
				log.Printf("Agent %s timed out (no KeepAlive for 90s), marking as offline...", id)
				agent.Conn.Close()
				disconnectedAgents = append(disconnectedAgents, id)
			}
		}

		// Remove disconnected agents from hub
		for _, id := range disconnectedAgents {
			agentHub.UnregisterAgent(id)
		}

		// Update status in database (don't delete, just mark as offline)
		for _, id := range disconnectedAgents {
			agentRecord, err := db.GetAgentByID(id)
			if err == nil && agentRecord != nil {
				db.UpdateAgentStatus(agentRecord.ID, "offline", agentRecord.Name, agentRecord.Description)
				log.Printf("Agent '%s' marked as offline in database", agentRecord.Hostname)
				api.BroadcastAgentUpdate(map[string]interface{}{
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

	// Initialize metrics collector
	metricsCollector = metrics.NewMetricsCollector()

	// Start cleanup loop for stale agents
	go startAgentCleanupLoop()

	// Start webhook delivery worker
	webhookWorker := webhook.NewDeliveryWorker(5, 30*time.Second)
	go webhookWorker.Start(context.Background())

	// Load configuration
	cfg, err := config.Load("prism-server.conf")
	if err != nil {
		logger.Warn("Config not found, using defaults", "error", err)
		cfg = &config.Config{}
	}

	// Store config globally for token access
	serverConfig = cfg
	api.SetHubToken(cfg.Auth.Token)
	if cfg != nil && len(cfg.Server.CORS.AllowedOrigins) > 0 {
		api.AllowedOrigins = cfg.Server.CORS.AllowedOrigins
	}

	// Validate configuration and generate secure secrets if needed
	if err := cfg.Validate("prism-server.conf"); err != nil {
		logger.Error("Configuration validation failed", "error", err)
		os.Exit(1)
	}

	// Set JWT secret from config - refuse to start if not configured
	if cfg.Auth.JwtSecret != "" {
		api.JWTSecret = []byte(cfg.Auth.JwtSecret)
	}
	if len(api.JWTSecret) == 0 {
		logger.Error("FATAL: JWT secret is not configured. Server refuses to start.")
		logger.Error("Set auth.jwt_secret in prism-server.conf or PRISM_JWT_SECRET env var")
		os.Exit(1)
	}

	// Initialize Database with SQLCipher encryption
	dbPath := "prism.db"
	if cfg != nil && cfg.Database.Path != "" {
		dbPath = cfg.Database.Path
	}

	// Load JWT Secret from config
	if cfg != nil && cfg.Auth.JwtSecret != "" {
		api.JWTSecret = []byte(cfg.Auth.JwtSecret)
	}

	// Initialize database
	if err := db.InitDB(dbPath); err != nil {
		logger.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	// Initialize webhook tables
	if err := db.InitWebhooksTable(); err != nil {
		logger.Error("Failed to initialize webhooks table", "error", err)
	} else {
		logger.Info("Webhooks table initialized")
	}
	if err := db.InitWebhookDeliveriesTable(); err != nil {
		logger.Error("Failed to initialize webhook deliveries table", "error", err)
	} else {
		logger.Info("Webhook deliveries table initialized")
	}

	// Initialize RBAC tables
	if err := db.InitRolesTable(); err != nil {
		logger.Error("Failed to initialize roles table", "error", err)
	} else {
		logger.Info("Roles table initialized")
	}
	if err := db.InitUserRolesTable(); err != nil {
		logger.Error("Failed to initialize user_roles table", "error", err)
	} else {
		logger.Info("User-role mappings initialized")
	}

	// Initialize configuration drift detection tables
	if err := db.InitConfigDriftTables(); err != nil {
		logger.Error("Failed to initialize config drift tables", "error", err)
	} else {
		logger.Info("Configuration drift detection tables initialized")
	}

	// Initialize audit log retention policies
	if err := db.InitAuditRetentionTable(); err != nil {
		logger.Error("Failed to initialize audit retention table", "error", err)
	} else {
		logger.Info("Audit log retention policies initialized")
	}

	// Initialize SQLCipher encryption if password is provided
	dbPassword := os.Getenv("PRISM_DB_PASSWORD")
	if dbPassword != "" {
		if err := db.InitializeSQLCipher(dbPassword); err != nil {
			logger.Error("Failed to initialize SQLCipher encryption", "error", err)
			os.Exit(1)
		}
		logger.Info("Database encryption enabled with SQLCipher")
	} else {
		logger.Info("Database encryption NOT enabled (set PRISM_DB_PASSWORD to enable)")
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

	// Initialize Certificate Authority for signing agent certificates
	caConfig := security.DefaultCACertConfig()
	globalCA, err = security.NewCertificateAuthority(caConfig)
	if err != nil {
		logger.Error("Failed to initialize Certificate Authority", "error", err)
		os.Exit(1)
	}
	logger.Info("Certificate Authority initialized",
		"common_name", globalCA.CACert.Subject.CommonName,
		"expires_at", globalCA.CACert.NotAfter)

	// Set the CA in the API package
	api.SetCertificateAuthority(globalCA)

	// Initialize Agent Hub
	agentHub = hub.NewHub()
	api.SetAgentHub(agentHub)

	// Initialize WebSocket Hub
	wsHub = ws.NewHub(nil)
	api.SetWSHub(wsHub)
	go wsHub.Run()

	// Setup real-time log streaming callback
	db.OnAuditLogCreated = func(audit models.AuditLog) {
		// Broadcast to all subscribers interested in this agent/service
		logSubscribersMu.RLock()
		defer logSubscribersMu.RUnlock()

		for sub := range logSubscribers {
			// Check if subscriber is interested in this log entry
			// Match by agent_id in details or resource_id
			shouldSend := false

			// Extract agent_id and service from audit log details
			details := audit.Details
			if details != nil {
				if agentID, ok := details["agent_id"].(string); ok && agentID == sub.agentID {
					shouldSend = true
				}
				if service, ok := details["service"].(string); ok && service == sub.service {
					shouldSend = true
				}
			}

			// Also check if resource_id matches agent_id
			if audit.ResourceID == sub.agentID {
				shouldSend = true
			}

			if shouldSend {
				select {
				case sub.ch <- audit:
				default:
					// Channel buffer full, skip this log
				}
			}
		}
	}

	// Hub Server
	http.HandleFunc("/agent/connect", handleAgentConnection)

	// WebSocket endpoint for Frontend real-time updates
	http.HandleFunc("/ws/agents", handleFrontendAgentsWS)

	// WebSocket endpoint for Logs real-time streaming
	http.HandleFunc("/ws/logs", handleLogsWS)

	// Public Enum
	http.HandleFunc("/api/auth/login", api.HandleLogin)

	// Protected Endpoints

	// REST API for Agents (Legacy)
	http.HandleFunc("/api/agents", api.AuthMiddleware(api.HandleListAgents, "admin", "manager", "user"))
	http.HandleFunc("/api/agents/", api.AuthMiddleware(api.HandleAgentAction, "admin"))

	http.HandleFunc("/api/control", api.AuthMiddleware(api.HandleServiceControl, "admin", "manager"))
	http.HandleFunc("/api/control/import", api.AuthMiddleware(api.HandleServiceImport, "admin", "manager"))

	http.HandleFunc("/api/security/ban", api.AuthMiddleware(api.HandleGlobalBan, "admin", "manager"))
	http.HandleFunc("/api/security/unban", api.AuthMiddleware(api.HandleGlobalUnban, "admin", "manager"))
	http.HandleFunc("/api/security/decisions", api.AuthMiddleware(api.HandleSecurityDecisions, "admin", "manager", "user"))

	// REST API endpoints for Projects and Service Accounts
	// NOTE: If we want finer grain (GET vs POST), we can wrap the inside or create different handlers.
	// We'll wrap the top level with all 3, and inside the handlers block non-GETs for "user".
	http.HandleFunc("/api/projects", api.AuthMiddleware(api.HandleProjects, "admin", "manager", "user"))
	http.HandleFunc("/api/projects/", api.AuthMiddleware(api.HandleProjectDetail, "admin", "manager", "user"))
	http.HandleFunc("/api/accounts", api.AuthMiddleware(api.HandleAccounts, "admin", "manager", "user"))
	http.HandleFunc("/api/accounts/", api.AuthMiddleware(api.HandleAccountDetail, "admin", "manager", "user"))

	// REST API for RBAC Permissions (Admin only)
	http.HandleFunc("/api/permissions", api.AuthMiddleware(api.HandleRBACPermissions, "admin"))

	// REST API for Servers (Admin only)
	http.HandleFunc("/api/servers", api.AuthMiddleware(api.HandleServers, "admin"))
	http.HandleFunc("/api/servers/", api.AuthMiddleware(api.HandleServerDetail, "admin"))
	http.HandleFunc("/api/servers/{id}/heartbeat", api.AuthMiddleware(api.HandleServerHeartbeat, "admin"))
	http.HandleFunc("/api/servers/{id}/services", api.AuthMiddleware(api.HandleServerServices, "admin"))

	// REST API for Certificates (Admin only)
	http.HandleFunc("/api/certificates", api.AuthMiddleware(api.HandleCertificates, "admin"))
	http.HandleFunc("/api/certificates/", api.AuthMiddleware(api.HandleCertificateDetail, "admin"))
	http.HandleFunc("/api/enrollment-keys", api.AuthMiddleware(api.HandleEnrollmentKeys, "admin"))
	http.HandleFunc("/api/enrollment-keys/", api.AuthMiddleware(api.HandleEnrollmentKeyDetail, "admin"))
	http.HandleFunc("/api/certificate-stats", api.AuthMiddleware(api.HandleCertificateStats, "admin"))
	http.HandleFunc("/api/enrollment-key-stats", api.AuthMiddleware(api.HandleEnrollmentKeyStats, "admin"))
	http.HandleFunc("/api/certificate-authority", api.AuthMiddleware(api.HandleCertificateAuthority, "admin"))

	http.HandleFunc("/api/deployments", api.AuthMiddleware(api.HandleDeployments, "admin", "manager", "user"))
	http.HandleFunc("/api/deployments/", api.AuthMiddleware(api.HandleDeploymentDetail, "admin", "manager", "user"))

	http.HandleFunc("/api/management-credentials", api.AuthMiddleware(api.HandleManagementCredentials, "admin", "manager"))
	http.HandleFunc("/api/management-credentials/", api.AuthMiddleware(api.HandleManagementCredentialDetail, "admin", "manager"))

	// REST API for Users (Admin only)
	http.HandleFunc("/api/users", api.AuthMiddleware(api.HandleUsers, "admin"))
	http.HandleFunc("/api/users/", api.AuthMiddleware(api.HandleUserDetail, "admin"))
	http.HandleFunc("/api/users/me", api.AuthMiddleware(api.HandleMe, "admin", "manager", "user"))
	// Password change endpoints
	http.HandleFunc("/api/users/me/change-password", api.AuthMiddleware(api.HandleUserPasswordChange, "admin", "manager", "user"))
	http.HandleFunc("/api/users/*/reset-password", api.AuthMiddleware(api.HandleAdminPasswordReset, "admin"))

	// REST API for Settings
	http.HandleFunc("/api/settings", api.AuthMiddleware(api.HandleSettings, "admin", "manager", "user"))

	// REST API for Logs
	http.HandleFunc("/api/logs", api.AuthMiddleware(api.HandleLogs, "admin", "manager", "user"))

	// REST API for Webhooks
	http.HandleFunc("/api/webhooks", api.AuthMiddleware(api.HandleWebhooks, "admin"))
	http.HandleFunc("/api/webhooks/", api.AuthMiddleware(api.HandleWebhooks, "admin"))
	http.HandleFunc("/api/webhooks/test", api.AuthMiddleware(api.HandleWebhookTest, "admin"))

	// REST API for Roles (Advanced RBAC)
	http.HandleFunc("/api/roles", api.AuthMiddleware(api.HandleRoles, "admin"))
	http.HandleFunc("/api/roles/", api.AuthMiddleware(api.HandleRoles, "admin"))

	// REST API for Configuration Drift Detection
	http.HandleFunc("/api/config-drift", api.AuthMiddleware(api.HandleConfigDrift, "admin", "manager"))
	http.HandleFunc("/api/config-drift/", api.AuthMiddleware(api.HandleConfigDrift, "admin", "manager"))
	http.HandleFunc("/api/agent-config", api.AuthMiddleware(api.HandleAgentConfig, "admin", "manager"))

	// Health check endpoints
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/ready", handleReady)
	// Kubernetes standard endpoints (aliases)
	http.HandleFunc("/healthz", handleHealth)
	http.HandleFunc("/readyz", handleReady)

	// Prometheus metrics endpoint
	http.Handle("/metrics", metricsCollector)

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
			middleware.MetricsMiddleware(metricsCollector)(
				middleware.LoggingMiddleware(
					middleware.RequestIDMiddleware(
						http.DefaultServeMux,
					),
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

// handleLogsWS handles WebSocket connections from frontend for real-time log streaming
func handleLogsWS(w http.ResponseWriter, r *http.Request) {
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

	// Get query parameters
	agentID := r.URL.Query().Get("agentId")
	service := r.URL.Query().Get("service")
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}

	if agentID == "" || service == "" {
		http.Error(w, "agentId and service parameters are required", http.StatusBadRequest)
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Warn("Failed to upgrade WebSocket connection", "error", err)
		return
	}

	// Generate client ID from token (simplified, could use JWT claims)
	clientID := fmt.Sprintf("logs-%s-%s-%d", agentID, service, time.Now().UnixNano())

	logger.Info("Logs WebSocket connection established", "clientID", clientID, "agentID", agentID, "service", service)

	// Create subscriber for this client
	subscriber := &LogSubscriber{
		agentID: agentID,
		service: service,
		ch:      make(chan models.AuditLog, 100),
	}

	// Register subscriber
	logSubscribersMu.Lock()
	logSubscribers[subscriber] = true
	logSubscribersMu.Unlock()

	// Unregister on disconnect
	defer func() {
		logSubscribersMu.Lock()
		delete(logSubscribers, subscriber)
		close(subscriber.ch)
		logSubscribersMu.Unlock()
	}()

	// Handle WebSocket messages
	go func() {
		defer conn.Close()

		// Forward real-time logs from subscriber channel
		go func() {
			for logEntry := range subscriber.ch {
				// Convert audit log to map for WebSocket message
				details := logEntry.Details
				if details == nil {
					details = make(map[string]interface{})
				}
				details["agent_id"] = logEntry.ResourceID // Use ResourceID as agent ID reference

				logMsg := map[string]interface{}{
					"type":    "log_entry",
					"channel": "logs",
					"payload": map[string]interface{}{
						"id":        logEntry.ID,
						"timestamp": logEntry.Timestamp,
						"user_id":   logEntry.UserID,
						"action":    logEntry.Action,
						"resource":  logEntry.ResourceType,
						"agent_id":  agentID,
						"service":   service,
						"details":   details,
					},
					"timestamp": time.Now().UnixNano(),
				}
				if data, err := json.Marshal(logMsg); err == nil {
					conn.WriteMessage(websocket.TextMessage, data)
				}
			}
		}()

		// Send initial batch of logs
		initialLogs, err := db.GetEventsFiltered(agentID, service, limit)
		if err != nil {
			logger.Error("Failed to fetch initial logs", "error", err)
			return
		}

		// Send subscription confirmation
		subMsg := map[string]interface{}{
			"type":      "subscribed",
			"channel":   "logs",
			"agentId":   agentID,
			"service":   service,
			"timestamp": time.Now().UnixNano(),
		}
		if data, err := json.Marshal(subMsg); err == nil {
			conn.WriteMessage(websocket.TextMessage, data)
		}

		// Send initial batch
		batchMsg := map[string]interface{}{
			"type":      "logs_batch",
			"channel":   "logs",
			"payload":   initialLogs,
			"timestamp": time.Now().UnixNano(),
		}
		if data, err := json.Marshal(batchMsg); err == nil {
			conn.WriteMessage(websocket.TextMessage, data)
		}

		// Listen for messages and handle ping/pong
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					logger.Debug("Logs WebSocket error", "error", err)
				}
				break
			}

			// Parse message
			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			// Handle ping
			if msgType, ok := msg["type"].(string); ok && msgType == "ping" {
				pongMsg := map[string]interface{}{
					"type":      "pong",
					"timestamp": time.Now().UnixNano(),
				}
				if data, err := json.Marshal(pongMsg); err == nil {
					conn.WriteMessage(websocket.TextMessage, data)
				}
			}
		}

		logger.Info("Logs WebSocket connection closed", "clientID", clientID)
	}()

	// Note: For real-time log streaming from agents, you would need to:
	// 1. Subscribe to agent log events via the WebSocket hub
	// 2. Forward relevant logs to this client
	// This is a basic implementation that sends initial logs and keeps connection alive
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

// These handlers were moved to api package.
// Standard health/ready checks are kept here but updated to use agentHub.

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
	if agentHub != nil {
		health["connected_agents"] = len(agentHub.GetAgents())
	}

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
	agentCount := 0
	if agentHub != nil {
		agentCount = len(agentHub.GetAgents())
	}

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
