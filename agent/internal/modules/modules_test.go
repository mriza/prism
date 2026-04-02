package modules

import (
	"strconv"
	"strings"
	"testing"
)

// Test ValkeyModule helpers
func TestValkeyModule_DatabaseName(t *testing.T) {
	tests := []struct {
		name     string
		index    int
		expected string
	}{
		{"index 0", 0, "db0"},
		{"index 5", 5, "db5"},
		{"index 15", 15, "db15"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertDatabaseIndex(tt.index)
			if result != tt.expected {
				t.Errorf("convertDatabaseIndex(%d) = %q, want %q", tt.index, result, tt.expected)
			}
		})
	}
}

func TestValkeyModule_ACLKeyPattern(t *testing.T) {
	tests := []struct {
		name     string
		target   string
		expected string
	}{
		{"empty target", "", "~*"},
		{"wildcard", "*", "~*"},
		{"specific db", "db5", "~db5:*"},
		{"specific key", "user:123", "~user:123:*"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertTargetToKeyPattern(tt.target)
			if result != tt.expected {
				t.Errorf("convertTargetToKeyPattern(%q) = %q, want %q", tt.target, result, tt.expected)
			}
		})
	}
}

// Helper functions that would be used in ValkeyModule
func convertDatabaseIndex(index int) string {
	return "db" + strconv.Itoa(index)
}

func convertTargetToKeyPattern(target string) string {
	if target == "" || target == "*" {
		return "~*"
	}
	return "~" + target + ":*"
}

// Test that Valkey module exists and is properly structured
func TestValkeyModule_Exists(t *testing.T) {
	module := NewValkeyModule()

	if module == nil {
		t.Fatal("ValkeyModule should not be nil")
	}

	if module.SystemdModule == nil {
		t.Error("ValkeyModule should have SystemdModule")
	}

	// ValkeyModule embeds SystemdModule, use Name from embedded module
	if module.SystemdModule.Name() != "valkey" {
		t.Errorf("Expected name 'valkey', got %q", module.SystemdModule.Name())
	}
}

// Test MySQL Module
func TestMySQLModule_Exists(t *testing.T) {
	module := NewMySQLModule()

	if module == nil {
		t.Fatal("MySQLModule should not be nil")
	}
}

// Test PostgreSQL Module
func TestPostgresModule_Exists(t *testing.T) {
	module := NewPostgresModule()

	if module == nil {
		t.Fatal("PostgresModule should not be nil")
	}
}

// Test MongoDB Module
func TestMongoDBModule_Exists(t *testing.T) {
	module := NewMongoDBModule()

	if module == nil {
		t.Fatal("MongoDBModule should not be nil")
	}
}

// Test RabbitMQ Module
func TestRabbitMQModule_Exists(t *testing.T) {
	module := NewRabbitMQModule()

	if module == nil {
		t.Fatal("RabbitMQModule should not be nil")
	}
}

// Test MinIO Module
func TestMinIOModule_Exists(t *testing.T) {
	module := NewMinIOModule()

	if module == nil {
		t.Fatal("MinIOModule should not be nil")
	}
}

// Test Caddy Module
func TestCaddyModule_Exists(t *testing.T) {
	module := NewCaddyModule()

	if module == nil {
		t.Fatal("CaddyModule should not be nil")
	}
}

// Test Nginx Module
func TestNginxModule_Exists(t *testing.T) {
	module := NewNginxModule()

	if module == nil {
		t.Fatal("NginxModule should not be nil")
	}
}

// Test Deployment Module
func TestDeploymentModule_Exists(t *testing.T) {
	module := NewDeploymentModule()

	if module == nil {
		t.Fatal("DeploymentModule should not be nil")
	}
}

// Test that all database modules implement DatabaseModule interface
func TestDatabaseModule_Interface(t *testing.T) {
	modules := []struct {
		name string
		mod  interface{}
	}{
		{"MySQL", NewMySQLModule()},
		{"PostgreSQL", NewPostgresModule()},
		{"MongoDB", NewMongoDBModule()},
		{"Valkey", NewValkeyModule()},
		// RabbitMQ excluded because it uses vhosts and specific user types
	}

	for _, m := range modules {
		t.Run(m.name, func(t *testing.T) {
			// Check if module has ListDatabases method (DatabaseModule interface)
			if _, ok := m.mod.(interface{ ListDatabases() ([]string, error) }); !ok {
				t.Errorf("%s module should implement ListDatabases", m.name)
			}

			// Check if module has ListUsers method (DatabaseModule interface)
			if _, ok := m.mod.(interface{ ListUsers() ([]string, error) }); !ok {
				t.Errorf("%s module should implement ListUsers", m.name)
			}

			// Check if module has CreateUser method (DatabaseModule interface)
			if _, ok := m.mod.(interface {
				CreateUser(string, string, string, string) error
			}); !ok {
				t.Errorf("%s module should implement CreateUser", m.name)
			}
		})
	}
}

// Test runtime detection helpers
func TestDetectRuntimes(t *testing.T) {
	// This test verifies that DetectRuntimes doesn't crash
	// Actual runtime detection depends on what's installed on the system
	runtimes := DetectRuntimes()

	// Should return a slice (may be empty)
	if runtimes == nil {
		t.Error("DetectRuntimes should return a slice, not nil")
	}
}

// Test helper functions
func TestStringsContain(t *testing.T) {
	tests := []struct {
		name     string
		slice    []string
		item     string
		expected bool
	}{
		{"found", []string{"a", "b", "c"}, "b", true},
		{"not found", []string{"a", "b", "c"}, "d", false},
		{"empty slice", []string{}, "a", false},
		{"first item", []string{"a", "b", "c"}, "a", true},
		{"last item", []string{"a", "b", "c"}, "c", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsString(tt.slice, tt.item)
			if result != tt.expected {
				t.Errorf("containsString(%v, %q) = %v, want %v", tt.slice, tt.item, result, tt.expected)
			}
		})
	}
}

// Helper function for testing
func containsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// Ensure modules package is properly imported
var _ = strings.TrimSpace
