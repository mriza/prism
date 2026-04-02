package sqlite

import (
	"fmt"
	"os"
	"testing"
	"time"
)

func setupTestDB(t *testing.T) *Database {
	// Create temporary database file
	tmpfile, err := os.CreateTemp("", "test_*.db")
	if err != nil {
		t.Fatal(err)
	}

	db, err := NewDatabase(tmpfile.Name())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		db.Close()
		os.Remove(tmpfile.Name())
	})

	return db
}

func TestUserOperations(t *testing.T) {
	db := setupTestDB(t)

	// Create user
	user := User{
		ID:        "test-user-1",
		Username:  "testuser",
		Password:  "hashedpassword",
		FullName:  "Test User",
		Email:     "test@example.com",
		Role:      "admin",
		CreatedAt: time.Now().UTC(),
	}

	err := db.CreateUser(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get user by username
	retrieved, err := db.GetUserByUsername("testuser")
	if err != nil {
		t.Fatalf("Failed to get user: %v", err)
	}

	if retrieved.Username != user.Username {
		t.Errorf("Expected username %s, got %s", user.Username, retrieved.Username)
	}

	// Get all users
	users, err := db.GetUsers()
	if err != nil {
		t.Fatalf("Failed to get users: %v", err)
	}

	if len(users) != 1 {
		t.Errorf("Expected 1 user, got %d", len(users))
	}

	// Update user
	user.FullName = "Updated User"
	err = db.UpdateUser(user)
	if err != nil {
		t.Fatalf("Failed to update user: %v", err)
	}

	// Verify update
	updated, _ := db.GetUserByUsername("testuser")
	if updated.FullName != "Updated User" {
		t.Errorf("Expected updated name, got %s", updated.FullName)
	}

	// Delete user
	err = db.DeleteUser(user.ID)
	if err != nil {
		t.Fatalf("Failed to delete user: %v", err)
	}

	// Verify deletion
	deleted, _ := db.GetUserByUsername("testuser")
	if deleted != nil {
		t.Error("User should be deleted")
	}
}

func TestAgentOperations(t *testing.T) {
	db := setupTestDB(t)

	// Create agent
	agent := Agent{
		ID:        "test-agent-1",
		Name:      "Test Agent",
		Hostname:  "test-host",
		OSInfo:    "Ubuntu 24.04",
		Status:    "pending",
		CreatedAt: time.Now().UTC(),
		LastSeen:  time.Now().UTC(),
	}

	err := db.CreateAgent(agent)
	if err != nil {
		t.Fatalf("Failed to create agent: %v", err)
	}

	// Get agent by hostname
	retrieved, err := db.GetAgentByHostname("test-host")
	if err != nil {
		t.Fatalf("Failed to get agent: %v", err)
	}

	if retrieved.Hostname != agent.Hostname {
		t.Errorf("Expected hostname %s, got %s", agent.Hostname, retrieved.Hostname)
	}

	// Update agent status
	err = db.UpdateAgentStatus(agent.ID, "approved", "Approved Agent", "Test description")
	if err != nil {
		t.Fatalf("Failed to update agent: %v", err)
	}

	// Verify update
	updated, _ := db.GetAgentByHostname("test-host")
	if updated.Status != "approved" {
		t.Errorf("Expected status approved, got %s", updated.Status)
	}

	// Update last seen
	err = db.UpdateAgentLastSeen(agent.ID, "Updated OS Info")
	if err != nil {
		t.Fatalf("Failed to update last seen: %v", err)
	}

	// Verify last seen updated
	updated2, _ := db.GetAgentByHostname("test-host")
	if updated2.OSInfo != "Updated OS Info" {
		t.Errorf("Expected updated OS info, got %s", updated2.OSInfo)
	}

	// Delete agent
	err = db.DeleteAgent(agent.ID)
	if err != nil {
		t.Fatalf("Failed to delete agent: %v", err)
	}
}

func TestEventOperations(t *testing.T) {
	db := setupTestDB(t)

	// Create event
	event := Event{
		ID:        "test-event-1",
		AgentID:   "agent-123",
		Type:      "service_status_change",
		Service:   "nginx",
		Status:    "running",
		Message:   "Service started",
		CreatedAt: time.Now().UTC(),
	}

	err := db.CreateEvent(event)
	if err != nil {
		t.Fatalf("Failed to create event: %v", err)
	}

	// Get recent events
	events, err := db.GetEvents(10)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	if len(events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(events))
	}

	// Get events by agent
	eventsByAgent, err := db.GetEventsByAgent(event.AgentID, 10)
	if err != nil {
		t.Fatalf("Failed to get events by agent: %v", err)
	}

	if len(eventsByAgent) != 1 {
		t.Errorf("Expected 1 event, got %d", len(eventsByAgent))
	}
}

func TestProjectOperations(t *testing.T) {
	db := setupTestDB(t)

	// Create project
	project := Project{
		ID:          "test-project-1",
		Name:        "Test Project",
		Description: "Test Description",
		Color:       "#FF0000",
		CreatedAt:   time.Now().UTC(),
	}

	err := db.CreateProject(project)
	if err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Get all projects
	projects, err := db.GetProjects()
	if err != nil {
		t.Fatalf("Failed to get projects: %v", err)
	}

	if len(projects) != 1 {
		t.Errorf("Expected 1 project, got %d", len(projects))
	}

	// Update project
	project.Description = "Updated Description"
	err = db.UpdateProject(project)
	if err != nil {
		t.Fatalf("Failed to update project: %v", err)
	}

	// Delete project
	err = db.DeleteProject(project.ID)
	if err != nil {
		t.Fatalf("Failed to delete project: %v", err)
	}
}

func TestSettingsOperations(t *testing.T) {
	db := setupTestDB(t)

	// Update setting
	err := db.UpdateSetting("test_key", "test_value")
	if err != nil {
		t.Fatalf("Failed to update setting: %v", err)
	}

	// Get setting
	value, err := db.GetSetting("test_key")
	if err != nil {
		t.Fatalf("Failed to get setting: %v", err)
	}

	if value != "test_value" {
		t.Errorf("Expected test_value, got %s", value)
	}

	// Get all settings
	settings, err := db.GetSettings()
	if err != nil {
		t.Fatalf("Failed to get settings: %v", err)
	}

	if settings["test_key"] != "test_value" {
		t.Errorf("Expected test_value in settings map")
	}
}

func TestDatabaseConcurrency(t *testing.T) {
	db := setupTestDB(t)

	// Test sequential event creation (SQLite has limited concurrent write support)
	for i := 0; i < 10; i++ {
		event := Event{
			ID:        fmt.Sprintf("event-%d", i),
			AgentID:   "agent-1",
			Type:      "test",
			Service:   "test",
			Status:    "running",
			Message:   fmt.Sprintf("Event %d", i),
			CreatedAt: time.Now().UTC(),
		}
		err := db.CreateEvent(event)
		if err != nil {
			t.Errorf("Failed to create event %d: %v", i, err)
		}
	}

	// Verify all events created
	events, _ := db.GetEvents(100)
	if len(events) != 10 {
		t.Errorf("Expected 10 events, got %d", len(events))
	}
}
