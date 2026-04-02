package db

import (
	"os"
	"path/filepath"
	"prism-server/internal/models"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestMain(m *testing.M) {
	tempDir, err := os.MkdirTemp("", "prism-db-test-*")
	if err != nil {
		panic(err)
	}
	dbPath := filepath.Join(tempDir, "test.db")

	err = InitDB(dbPath)
	if err != nil {
		panic(err)
	}

	code := m.Run()

	DB.Close()
	os.RemoveAll(tempDir)
	os.Exit(code)
}

func TestProjectCRUD(t *testing.T) {
	// Create
	p := models.Project{
		Name:        "Test Project",
		Description: "Test Description",
		Color:       "blue",
	}
	
	created, err := CreateProject(p)
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}
	if created.ID == "" {
		t.Error("Expected project ID to be generated")
	}

	// Read
	projects, err := GetProjects()
	if err != nil {
		t.Fatalf("GetProjects failed: %v", err)
	}
	if len(projects) != 1 {
		t.Errorf("Expected 1 project, got %d", len(projects))
	}
	if projects[0].Name != p.Name {
		t.Errorf("Expected name %q, got %q", p.Name, projects[0].Name)
	}

	// Update
	projects[0].Name = "Updated Name"
	err = UpdateProject(projects[0])
	if err != nil {
		t.Fatalf("UpdateProject failed: %v", err)
	}

	updated, err := GetProjectByID(projects[0].ID)
	if err != nil {
		t.Fatalf("GetProjectByID failed: %v", err)
	}
	if updated.Name != "Updated Name" {
		t.Errorf("Expected updated name 'Updated Name', got %q", updated.Name)
	}

	// Delete
	err = DeleteProject(projects[0].ID)
	if err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}

	afterDelete, _ := GetProjects()
	if len(afterDelete) != 0 {
		t.Errorf("Expected 0 projects after delete, got %d", len(afterDelete))
	}
}

func TestAgentCRUD(t *testing.T) {
	// Create
	a := models.LegacyAgent{
		Name:     "Test Agent",
		Hostname: "test-host",
		Status:   "online",
	}
	
	created, err := CreateAgent(a)
	if err != nil {
		t.Fatalf("CreateAgent failed: %v", err)
	}
	if created.ID == "" {
		t.Error("Expected agent ID to be generated")
	}

	// Read
	agents, err := GetAgents()
	if err != nil {
		t.Fatalf("GetAgents failed: %v", err)
	}
	if len(agents) != 1 {
		t.Errorf("Expected 1 agent, got %d", len(agents))
	}

	// Update (LegacyAgent doesn't have an Update function in db.go yet)
}

func TestUserCRUD(t *testing.T) {
	// Create
	password := "testpass123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	
	u := models.User{
		Username: "testuser",
		Password: string(hash),
		Role:     "admin",
	}

	created, err := CreateUser(u)
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}
	if created.ID == "" {
		t.Error("Expected user ID to be generated")
	}

	// Read
	users, err := GetUsers()
	if err != nil {
		t.Fatalf("GetUsers failed: %v", err)
	}
	// Initial admin + our test user
	found := false
	for _, user := range users {
		if user.Username == "testuser" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Test user not found in user list")
	}

	// Update
	created.FullName = "Test User"
	err = UpdateUser(created)
	if err != nil {
		t.Fatalf("UpdateUser failed: %v", err)
	}

	updated, _ := GetUserByID(created.ID)
	if updated.FullName != "Test User" {
		t.Errorf("Expected full name 'Test User', got %q", updated.FullName)
	}

	// Authenticate (Manual check)
	dbUser, err := GetUserByUsername("testuser")
	if err != nil || dbUser == nil {
		t.Fatalf("GetUserByUsername failed: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(dbUser.Password), []byte(password)); err != nil {
		t.Errorf("Authentication failed: %v", err)
	}

	// Delete
	err = DeleteUser(created.ID)
	if err != nil {
		t.Fatalf("DeleteUser failed: %v", err)
	}

	afterDelete, _ := GetUserByID(created.ID)
	if afterDelete != nil {
		t.Error("Expected user to be deleted")
	}
}
