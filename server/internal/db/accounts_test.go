package db

import (
	"os"
	"prism-server/internal/models"
	"testing"
)

func TestMain(m *testing.M) {
	// Setup temporary database
	dbPath := "/tmp/prism_test.db"
	os.Remove(dbPath)
	err := InitDB(dbPath)
	if err != nil {
		panic(err)
	}
	
	code := m.Run()
	
	// Cleanup
	os.Remove(dbPath)
	os.Exit(code)
}

func TestServiceAccountOperations(t *testing.T) {
	acc := models.ServiceAccount{
		Name:    "Test Account",
		Type:    "mongodb",
		AgentID: "agent-1",
		Host:    "localhost",
		Port:    27017,
	}

	// Test Create
	created, err := CreateServiceAccount(acc)
	if err != nil {
		t.Fatalf("Failed to create service account: %v", err)
	}
	if created.ID == "" {
		t.Error("Expected ID to be populated")
	}

	// Test Get
	accounts, err := GetServiceAccounts("")
	if err != nil {
		t.Fatalf("Failed to get service accounts: %v", err)
	}
	if len(accounts) == 0 {
		t.Error("Expected at least one account")
	}

	// Test Update
	created.Name = "Updated Name"
	err = UpdateServiceAccount(created)
	if err != nil {
		t.Fatalf("Failed to update service account: %v", err)
	}

	accounts, _ = GetServiceAccounts("")
	if accounts[0].Name != "Updated Name" {
		t.Errorf("Expected name 'Updated Name', got %s", accounts[0].Name)
	}

	// Test Delete
	err = DeleteServiceAccount(created.ID)
	if err != nil {
		t.Fatalf("Failed to delete service account: %v", err)
	}

	accounts, _ = GetServiceAccounts("")
	for _, a := range accounts {
		if a.ID == created.ID {
			t.Error("Expected account to be deleted")
		}
	}
}
