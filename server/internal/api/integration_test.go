package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"prism-server/internal/db"
	"prism-server/internal/hub"
	"prism-server/internal/models"
	"prism-server/internal/protocol"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/bcrypt"
)

func TestIntegration_EndToEnd(t *testing.T) {
	// 1. Setup
	db.InitDB(":memory:")
	h := hub.NewHub()
	SetAgentHub(h)
	SetHubToken("test-token")

	// Create Admin User
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	db.CreateUser(models.User{
		ID:       "admin-id",
		Username: "admin",
		Password: string(hash),
		Role:     "admin",
	})

	// Login to get token
	loginReq := map[string]string{"username": "admin", "password": "admin123"}
	loginBody, _ := json.Marshal(loginReq)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginBody))
	w := httptest.NewRecorder()
	HandleLogin(w, req)
	
	var loginResp map[string]string
	json.Unmarshal(w.Body.Bytes(), &loginResp)
	adminToken := loginResp["token"]

	// Create Project
	proj := models.Project{
		ID:   "proj-1",
		Name: "Test Project",
	}
	db.CreateProject(proj)

	// Start Test Server for WebSocket
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/agent/connect" {
			HandleAgentConnection(w, r)
		} else {
			// Mock other routes if needed
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	// 2. Connect Mock Agent
	wsURL := "ws" + server.URL[4:] + "/agent/connect"
	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect mock agent: %v", err)
	}
	defer conn.Close()

	// Register Agent
	regMsg := protocol.Message{
		Type: protocol.MsgTypeRegister,
		Payload: map[string]interface{}{
			"hostname": "mock-agent",
			"agent_id": "agent-1",
			"token":    "test-token",
			"services": []interface{}{
				map[string]interface{}{"name": "mysql", "status": "running"},
			},
		},
	}
	if err := conn.WriteJSON(regMsg); err != nil {
		t.Fatalf("Failed to send register msg: %v", err)
	}

	// Expect "Agent approval pending" response
	var resp protocol.Message
	if err := conn.ReadJSON(&resp); err != nil {
		t.Fatalf("Failed to read register response: %v", err)
	}
	respPayload, _ := resp.Payload.(map[string]interface{})
	if respPayload["error"] != "Agent approval pending" {
		t.Errorf("Expected approval pending, got %v", respPayload["error"])
	}

	// 3. Approve Agent
	// The agent should be in DB as 'pending'
	dbAgent, _ := db.GetAgentByID("agent-1")
	if dbAgent == nil {
		t.Fatal("Agent not found in DB after registration")
	}

	// Simulate approval via API
	// Note: We'd normally use the API handler, but we can call DB directly for speed in this test
	db.UpdateAgentStatus("agent-1", "approved", "Approved Agent", "")

	// 4. Reconnect Agent (Approved)
	conn2, _, _ := dialer.Dial(wsURL, nil)
	defer conn2.Close()
	conn2.WriteJSON(regMsg)

	// Expect Welcome message
	if err := conn2.ReadJSON(&resp); err != nil {
		t.Fatalf("Failed to read welcome msg: %v", err)
	}
	if resp.Type != protocol.MsgTypeWelcome {
		t.Errorf("Expected Welcome msg, got %s", resp.Type)
	}

	// Wait for agent to be registered in hub
	time.Sleep(100 * time.Millisecond)
	if _, ok := h.GetAgent("agent-1"); !ok {
		t.Fatal("Agent not found in Hub after approval and reconnect")
	}

	// 5. Execute Control Command
	// We'll use HandleServiceControl
	controlReq := map[string]interface{}{
		"agent_id": "agent-1",
		"service":  "mysql",
		"action":   "restart",
	}
	controlBody, _ := json.Marshal(controlReq)
	creq := httptest.NewRequest("POST", "/api/control", bytes.NewBuffer(controlBody))
	creq.Header.Set("Authorization", "Bearer "+adminToken)
	cw := httptest.NewRecorder()

	// We need a goroutine to handle the agent side of the command
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		// Wait for command
		var cmd protocol.Message
		if err := conn2.ReadJSON(&cmd); err != nil {
			return
		}
		
		// If it's the token command, read it and then wait for the next one (mysql restart)
		if payload, ok := cmd.Payload.(map[string]interface{}); ok && payload["action"] == "agent_set_hub_token" {
			// Read another
			if err := conn2.ReadJSON(&cmd); err != nil {
				return
			}
		}

		payload, _ := cmd.Payload.(map[string]interface{})
		cmdID := payload["command_id"].(string)

		// Send response
		resp := protocol.Message{
			Type: protocol.MsgTypeResponse,
			Payload: map[string]interface{}{
				"command_id": cmdID,
				"success":    true,
				"message":    "MySQL restarted successfully",
			},
		}
		conn2.WriteJSON(resp)
	}()

	HandleServiceControl(cw, creq)
	wg.Wait()

	if cw.Code != http.StatusOK {
		t.Errorf("Expected status 200 for control command, got %d: %s", cw.Code, cw.Body.String())
	}

	var finalResp map[string]interface{}
	json.Unmarshal(cw.Body.Bytes(), &finalResp)
	if finalResp["success"] != true {
		t.Errorf("Expected success response, got %v", finalResp)
	}
}
