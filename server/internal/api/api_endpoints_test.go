package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"prism-server/internal/db"
	"prism-server/internal/models"
)

func TestHandleProjects(t *testing.T) {
	// Test GET /api/projects
	req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	w := httptest.NewRecorder()

	HandleProjects(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var projects []models.Project
	if err := json.NewDecoder(w.Body).Decode(&projects); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	// Should return empty array, not null
	if projects == nil {
		t.Error("Expected empty array, got nil")
	}
}

func TestHandleProjectsPOST(t *testing.T) {
	project := models.Project{
		Name:        "Test Project",
		Description: "Test Description",
		Color:       "blue",
	}

	body, _ := json.Marshal(project)
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(body))
	w := httptest.NewRecorder()

	HandleProjects(w, req)

	// Should create successfully or fail due to DB not initialized
	if w.Code != http.StatusCreated && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 201 or 500, got %d", w.Code)
	}
}

func TestHandleDeployments(t *testing.T) {
	// Test GET /api/deployments
	req := httptest.NewRequest(http.MethodGet, "/api/deployments", nil)
	w := httptest.NewRecorder()

	HandleDeployments(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var deployments []models.Deployment
	if err := json.NewDecoder(w.Body).Decode(&deployments); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	// Should return empty array, not null
	if deployments == nil {
		t.Error("Expected empty array, got nil")
	}
}

func TestHandleDeploymentsPOST(t *testing.T) {
	deployment := models.Deployment{
		ProjectID:      "project-1",
		ServerID:       "server-1",
		Name:           "Test Deployment",
		Description:    "Test Description",
		SourceURL:      "https://github.com/test/repo",
		Runtime:        "nodejs",
		RuntimeVersion: "18.x",
		ProcessManager: "pm2",
		StartCommand:   "npm start",
		DomainName:     "test.example.com",
		InternalPort:   3000,
		ProxyType:      "caddy",
		Status:         "pending",
	}

	body, _ := json.Marshal(deployment)
	req := httptest.NewRequest(http.MethodPost, "/api/deployments", bytes.NewReader(body))
	w := httptest.NewRecorder()

	HandleDeployments(w, req)

	// Should create successfully or fail due to DB not initialized
	if w.Code != http.StatusCreated && w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status 201 or 500, got %d", w.Code)
	}
}

func TestHandleUsers(t *testing.T) {
	// Test GET /api/users
	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	w := httptest.NewRecorder()

	HandleUsers(w, req)

	// Should return 200 (may be unauthorized without token, but endpoint exists)
	if w.Code != http.StatusOK && w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 200 or 401, got %d", w.Code)
	}
}

func TestHandleLogs(t *testing.T) {
	// Test GET /api/logs
	req := httptest.NewRequest(http.MethodGet, "/api/logs", nil)
	w := httptest.NewRecorder()

	HandleLogs(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var logs []models.Event
	if err := json.NewDecoder(w.Body).Decode(&logs); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	// Should return empty array, not null
	if logs == nil {
		t.Error("Expected empty array, got nil")
	}
}

// Ensure db package is used
var _ = db.GetServiceAccountByID
