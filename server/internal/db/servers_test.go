package db

import (
	"prism-server/internal/models"
	"testing"
)

func TestServerOperations(t *testing.T) {
	s := models.Server{
		ID:           "server-test-1",
		Hostname:     "test-host",
		OS:           "linux",
		OSInfo:       "Ubuntu 22.04",
		Status:       "active",
		AgentVersion: "v4.4",
		Runtimes: []models.RuntimeInfo{
			{Name: "Node.js", Version: "20.0.0", Path: "/usr/bin/node"},
			{Name: "Python", Version: "3.10.0", Path: "/usr/bin/python3"},
		},
	}

	// Test Create
	_, err := CreateServer(s)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// Test Get
	retrieved, err := GetServerByID(s.ID)
	if err != nil {
		t.Fatalf("Failed to get server: %v", err)
	}
	if retrieved == nil {
		t.Fatal("Expected server to be retrieved, got nil")
	}
	if len(retrieved.Runtimes) != 2 {
		t.Errorf("Expected 2 runtimes, got %d", len(retrieved.Runtimes))
	}
	if retrieved.Runtimes[0].Name != "Node.js" {
		t.Errorf("Expected first runtime to be Node.js, got %s", retrieved.Runtimes[0].Name)
	}

	// Test Update Heartbeat
	newRuntimes := []models.RuntimeInfo{
		{Name: "Node.js", Version: "21.0.0", Path: "/usr/bin/node"},
	}
	err = UpdateServerHeartbeat(s.ID, "Ubuntu 24.04", "v4.5", newRuntimes)
	if err != nil {
		t.Fatalf("Failed to update server heartbeat: %v", err)
	}

	retrieved, _ = GetServerByID(s.ID)
	if retrieved.OSInfo != "Ubuntu 24.04" {
		t.Errorf("Expected OSInfo 'Ubuntu 24.04', got %s", retrieved.OSInfo)
	}
	if len(retrieved.Runtimes) != 1 {
		t.Errorf("Expected 1 runtime after update, got %d", len(retrieved.Runtimes))
	}
	if retrieved.Runtimes[0].Version != "21.0.0" {
		t.Errorf("Expected Node.js version 21.0.0, got %s", retrieved.Runtimes[0].Version)
	}
}
