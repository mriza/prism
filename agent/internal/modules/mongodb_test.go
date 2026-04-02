package modules

import (
	"strings"
	"testing"
)

func TestMongoDBModule_GetFacts(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("7.0.5\n"),
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMongoDBModule()
	facts, err := module.GetFacts()

	if err != nil {
		t.Fatalf("GetFacts failed: %v", err)
	}

	if facts["version"] != "7.0.5" {
		t.Errorf("Expected version 7.0.5, got %s", facts["version"])
	}
}

func TestMongoDBModule_ListDatabases(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("admin\nconfig\nlocal\ntest_db\n"),
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMongoDBModule()
	dbs, err := module.ListDatabases()

	if err != nil {
		t.Fatalf("ListDatabases failed: %v", err)
	}

	if len(dbs) != 4 {
		t.Errorf("Expected 4 databases, got %d", len(dbs))
	}

	expected := []string{"admin", "config", "local", "test_db"}
	for i, name := range expected {
		if dbs[i] != name {
			t.Errorf("Expected database %q, got %q", name, dbs[i])
		}
	}
}

func TestMongoDBModule_ListUsers(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("admin@admin\nroot@admin\ntestuser@test_db\n"),
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMongoDBModule()
	users, err := module.ListUsers()

	if err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}

	if len(users) != 3 {
		t.Errorf("Expected 3 users, got %d", len(users))
	}

	expected := []string{"admin@admin", "root@admin", "testuser@test_db"}
	for i, name := range expected {
		if users[i] != name {
			t.Errorf("Expected user %q, got %q", name, users[i])
		}
	}
}

func TestMongoDBModule_CreateUser(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMongoDBModule()
	err := module.CreateUser("testuser@test_db", "Pass123!", "readWrite", "")

	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Should have at least 1 command (createUser/updateUser script)
	if len(mock.Commands) < 1 {
		t.Fatal("Expected at least 1 command")
	}

	// Find the createUser script command
	foundScript := false
	for _, cmd := range mock.Commands {
		for _, arg := range cmd.Args {
			if strings.Contains(arg, "createUser") && strings.Contains(arg, "testuser") {
				foundScript = true
				break
			}
		}
	}

	if !foundScript {
		t.Error("Missing createUser script in commands")
	}
}

func TestMongoDBModule_UpdatePrivileges(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMongoDBModule()
	err := module.UpdatePrivileges("testuser@test_db", "read", "")

	if err != nil {
		t.Fatalf("UpdatePrivileges failed: %v", err)
	}

	if len(mock.Commands) < 1 {
		t.Fatal("Expected at least 1 command")
	}

	foundUpdate := false
	for _, cmd := range mock.Commands {
		for _, arg := range cmd.Args {
			if strings.Contains(arg, "updateUser") && strings.Contains(arg, "testuser") && strings.Contains(arg, "read") {
				foundUpdate = true
				break
			}
		}
	}

	if !foundUpdate {
		t.Error("Missing updateUser script in commands")
	}
}
