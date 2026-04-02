package modules

import (
	"strings"
	"testing"
)

func TestPostgresModule_ListDatabases(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("postgres\ntest_db\n"),
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewPostgresModule()
	dbs, err := module.ListDatabases()

	if err != nil {
		t.Fatalf("ListDatabases failed: %v", err)
	}

	if len(dbs) != 2 {
		t.Errorf("Expected 2 databases, got %d", len(dbs))
	}

	expected := []string{"postgres", "test_db"}
	for i, name := range expected {
		if dbs[i] != name {
			t.Errorf("Expected database %q, got %q", name, dbs[i])
		}
	}

	// Verify command
	if len(mock.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(mock.Commands))
	}
	cmd := mock.Commands[0]
	if !strings.Contains(cmd.Args[len(cmd.Args)-1], "SELECT datname FROM pg_database") {
		t.Errorf("Unexpected command query: %s", cmd.Args[len(cmd.Args)-1])
	}
}

func TestPostgresModule_CreateDatabase(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("0"), // Doesn't exist
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewPostgresModule()
	err := module.CreateDatabase("new_pg_db")

	if err != nil {
		t.Fatalf("CreateDatabase failed: %v", err)
	}

	// Should have 2 commands: check existence, then create
	if len(mock.Commands) != 2 {
		t.Fatalf("Expected 2 commands, got %d", len(mock.Commands))
	}
	
	createCmd := mock.Commands[1]
	if !strings.Contains(createCmd.Args[len(createCmd.Args)-1], "CREATE DATABASE \"new_pg_db\"") {
		t.Errorf("Unexpected create command: %v", createCmd)
	}
}

func TestPostgresModule_CreateUser(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewPostgresModule()
	// Password must meet complexity
	err := module.CreateUser("pguser", "StrongPass123!", "read", "test_db")

	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Should have at least 2 commands: CREATE USER and GRANT
	if len(mock.Commands) < 2 {
		t.Fatalf("Expected at least 2 commands, got %d", len(mock.Commands))
	}

	foundCreate := false
	foundGrant := false
	for _, cmd := range mock.Commands {
		query := cmd.Args[len(cmd.Args)-1]
		if strings.Contains(query, "CREATE USER \"pguser\"") {
			foundCreate = true
		}
		if strings.Contains(query, "GRANT CONNECT ON DATABASE \"test_db\" TO \"pguser\"") {
			foundGrant = true
		}
	}

	if !foundCreate {
		t.Error("Missing CREATE USER command")
	}
	if !foundGrant {
		t.Error("Missing GRANT command")
	}
}

func TestPostgresModule_InvalidIdentifiers(t *testing.T) {
	module := NewPostgresModule()
	
	// Injection attempt
	err := module.CreateDatabase("db\"; DROP TABLE pg_user; --")
	if err == nil {
		t.Error("Expected error for invalid database name, got nil")
	}

	err = module.CreateUser("user\"--", "Pass123!", "read", "test_db")
	if err == nil {
		t.Error("Expected error for invalid username, got nil")
	}
}

func TestPostgresModule_ManagementCredentials(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewPostgresModule()
	module.SetManagementCredentials(map[string]string{
		"username": "admin",
		"password": "secretpassword",
	})

	_, _ = module.ListDatabases()

	if len(mock.Commands) == 0 {
		t.Fatal("Expected command to be recorded")
	}

	cmd := mock.Commands[0]
	// Should use -U admin -h 127.0.0.1
	foundUser := false
	for i, arg := range cmd.Args {
		if arg == "-U" && i+1 < len(cmd.Args) && cmd.Args[i+1] == "admin" {
			foundUser = true
		}
	}
	if !foundUser {
		t.Errorf("Expected -U admin in command args, got %v", cmd.Args)
	}

	// Should have PGPASSWORD env
	foundPass := false
	for _, env := range cmd.Env {
		if strings.HasPrefix(env, "PGPASSWORD=secretpassword") {
			foundPass = true
		}
	}
	if !foundPass {
		t.Errorf("Expected PGPASSWORD=secretpassword in env, got %v", cmd.Env)
	}
}
