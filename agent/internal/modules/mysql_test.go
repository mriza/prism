package modules

import (
	"io"
	"strings"
	"testing"
)

// MockExecutor for testing
type MockExecutor struct {
	Commands []MockCommandData
	ReturnOutput []byte
	ReturnError  error
}

type MockCommandData struct {
	Name string
	Args []string
	Env  []string
	Stdin string
}

func (e *MockExecutor) Command(name string, arg ...string) Command {
	cmd := &MockCommand{
		Data: MockCommandData{
			Name: name,
			Args: arg,
		},
		Executor: e,
	}
	return cmd
}

type MockCommand struct {
	Data     MockCommandData
	Executor *MockExecutor
}

func (c *MockCommand) Run() error {
	c.Executor.Commands = append(c.Executor.Commands, c.Data)
	return c.Executor.ReturnError
}

func (c *MockCommand) Output() ([]byte, error) {
	c.Executor.Commands = append(c.Executor.Commands, c.Data)
	return c.Executor.ReturnOutput, c.Executor.ReturnError
}

func (c *MockCommand) CombinedOutput() ([]byte, error) {
	c.Executor.Commands = append(c.Executor.Commands, c.Data)
	return c.Executor.ReturnOutput, c.Executor.ReturnError
}

func (c *MockCommand) SetEnv(env []string) {
	c.Data.Env = env
}

func (c *MockCommand) SetStdin(r interface{}) {
	if reader, ok := r.(io.Reader); ok {
		buf := new(strings.Builder)
		io.Copy(buf, reader)
		c.Data.Stdin = buf.String()
	}
}

func TestMySQLModule_ListDatabases(t *testing.T) {
	mock := &MockExecutor{
		ReturnOutput: []byte("Database\ninformation_schema\nmysql\ntest_db\n"),
	}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMySQLModule()
	dbs, err := module.ListDatabases()

	if err != nil {
		t.Fatalf("ListDatabases failed: %v", err)
	}

	if len(dbs) != 3 {
		t.Errorf("Expected 3 databases, got %d", len(dbs))
	}

	expected := []string{"information_schema", "mysql", "test_db"}
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
	if cmd.Name != "mysql" || cmd.Args[1] != "SHOW DATABASES;" {
		t.Errorf("Unexpected command: %v", cmd)
	}
}

func TestMySQLModule_CreateDatabase(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMySQLModule()
	err := module.CreateDatabase("new_db")

	if err != nil {
		t.Fatalf("CreateDatabase failed: %v", err)
	}

	if len(mock.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(mock.Commands))
	}
	cmd := mock.Commands[0]
	if cmd.Name != "mysql" || strings.Contains(cmd.Args[1], "CREATE DATABASE IF NOT EXISTS `new_db`") == false {
		t.Errorf("Unexpected command: %v", cmd)
	}
}

func TestMySQLModule_CreateUser(t *testing.T) {
	mock := &MockExecutor{}
	SetExecutor(mock)
	defer SetExecutor(&DefaultExecutor{})

	module := NewMySQLModule()
	// Password must meet complexity
	err := module.CreateUser("testuser", "StrongPass123!", "read", "test_db.*")

	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	if len(mock.Commands) != 1 {
		t.Fatalf("Expected 1 command, got %d", len(mock.Commands))
	}
	cmd := mock.Commands[0]
	if !strings.Contains(cmd.Stdin, "CREATE USER IF NOT EXISTS 'testuser'@'%'") {
		t.Errorf("Missing CREATE USER in query: %s", cmd.Stdin)
	}
	if !strings.Contains(cmd.Stdin, "GRANT SELECT ON test_db.*") {
		t.Errorf("Missing GRANT SELECT in query: %s", cmd.Stdin)
	}
}

func TestMySQLModule_InvalidIdentifiers(t *testing.T) {
	module := NewMySQLModule()
	
	// Semicolon injection attempt
	err := module.CreateDatabase("db; DROP TABLE users;")
	if err == nil {
		t.Error("Expected error for invalid database name, got nil")
	}

	err = module.CreateUser("user;--", "Pass123!", "read", "*.*")
	if err == nil {
		t.Error("Expected error for invalid username, got nil")
	}
}
