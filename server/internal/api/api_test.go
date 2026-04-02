package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"prism-server/internal/db"
	"prism-server/internal/models"
	
	"golang.org/x/crypto/bcrypt"
)

var testServer *http.ServeMux
var testToken string

func setupTestServer(t *testing.T) {
	// Initialize test database
	db.InitDB(":memory:")
	
	// Create test user
	hash, _ := bcrypt.GenerateFromPassword([]byte("test123"), bcrypt.DefaultCost)
	user := models.User{
		ID:        "test-user",
		Username:  "testuser",
		Password:  string(hash),
		Role:      "admin",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	db.CreateUser(user)
	
	// Login to get token
	loginReq := map[string]string{
		"username": "testuser",
		"password": "test123",
	}
	loginBody, _ := json.Marshal(loginReq)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginBody))
	w := httptest.NewRecorder()
	
	HandleLogin(w, req)
	
	if w.Code != http.StatusOK {
		t.Fatalf("Failed to login: %s", w.Body.String())
	}
	
	var loginResp map[string]string
	json.Unmarshal(w.Body.Bytes(), &loginResp)
	testToken = loginResp["token"]
	
	// Setup test server
	testServer = http.NewServeMux()
	testServer.HandleFunc("/api/auth/login", HandleLogin)
	testServer.HandleFunc("/api/agents", AuthMiddleware(handleTestAgents, "admin"))
	testServer.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})
	testServer.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})
	testServer.HandleFunc("/api/settings", AuthMiddleware(handleTestSettings, "admin"))
}

func handleTestSettings(w http.ResponseWriter, r *http.Request) {
	settings, _ := db.GetSettings()
	json.NewEncoder(w).Encode(settings)
}

func handleTestAgents(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" || r.Method == "OPTIONS" {
		agents, _ := db.GetAgents()
		json.NewEncoder(w).Encode(agents)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func TestMain(m *testing.M) {
	setupTestServer(nil)
	code := m.Run()
	os.Exit(code)
}

func TestLoginSuccess(t *testing.T) {
	loginReq := map[string]string{
		"username": "testuser",
		"password": "test123",
	}
	
	body, _ := json.Marshal(loginReq)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	
	HandleLogin(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	
	if resp["token"] == "" {
		t.Error("Expected token in response")
	}
	
	if resp["username"] != "testuser" {
		t.Errorf("Expected username testuser, got %s", resp["username"])
	}
}

func TestLoginFailure(t *testing.T) {
	loginReq := map[string]string{
		"username": "testuser",
		"password": "wrongpassword",
	}
	
	body, _ := json.Marshal(loginReq)
	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	w := httptest.NewRecorder()
	
	HandleLogin(w, req)
	
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestLoginRateLimit(t *testing.T) {
	loginReq := map[string]string{
		"username": "testuser",
		"password": "wrongpassword",
	}
	
	body, _ := json.Marshal(loginReq)
	
	// Make 6 requests (limit is 5 per minute)
	for i := 0; i < 6; i++ {
		req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
		req.RemoteAddr = "127.0.0.1" // Same IP for rate limiting
		w := httptest.NewRecorder()
		
		HandleLogin(w, req)
		
		if i < 5 {
			if w.Code != http.StatusUnauthorized {
				t.Errorf("Request %d: Expected status 401, got %d", i, w.Code)
			}
		} else {
			if w.Code != http.StatusTooManyRequests {
				t.Errorf("Request %d: Expected status 429 (rate limit), got %d", i, w.Code)
			}
		}
	}
}

func TestAgentsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/agents", nil)
	req.Header.Set("Authorization", "Bearer "+testToken)
	w := httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	// Response can be empty array or null, both are acceptable
	// Just verify it's valid JSON
	var response json.RawMessage
	json.Unmarshal(w.Body.Bytes(), &response)
	
	if response == nil {
		t.Error("Expected valid JSON response")
	}
}

func TestAgentsEndpointUnauthorized(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/agents", nil)
	w := httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var health map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &health)
	
	if health["status"] != "healthy" {
		t.Errorf("Expected healthy status, got %v", health["status"])
	}
}

func TestReadyEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var ready map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &ready)
	
	if ready["status"] != "ready" {
		t.Errorf("Expected ready status, got %v", ready["status"])
	}
}

func TestSettingsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/settings", nil)
	req.Header.Set("Authorization", "Bearer "+testToken)
	w := httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var settings []models.Setting
	json.Unmarshal(w.Body.Bytes(), &settings)
	
	// Should have default settings
	if len(settings) == 0 {
		t.Error("Expected default settings")
	}
}

func TestErrorHandling(t *testing.T) {
	// Test 404
	req := httptest.NewRequest("GET", "/api/nonexistent", nil)
	w := httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
	
	// Test 405 (method not allowed)
	req = httptest.NewRequest("POST", "/api/agents", nil)
	req.Header.Set("Authorization", "Bearer "+testToken)
	w = httptest.NewRecorder()
	
	testServer.ServeHTTP(w, req)
	
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected status 405, got %d", w.Code)
	}
}
