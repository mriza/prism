package main

import (
	"testing"
)

func TestNormalizeServiceName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		// Valkey subtypes should all map to "valkey"
		{"valkey-cache", "valkey-cache", "valkey"},
		{"valkey-broker", "valkey-broker", "valkey"},
		{"valkey-nosql", "valkey-nosql", "valkey"},
		{"valkey-server", "valkey-server", "valkey"},
		{"legacy-valkey", "valkey", "valkey"},
		
		// Other services should remain unchanged
		{"mysql", "mysql", "mysql"},
		{"postgresql", "postgresql", "postgresql"},
		{"mongodb", "mongodb", "mongodb"},
		{"rabbitmq", "rabbitmq", "rabbitmq"},
		{"minio", "minio", "minio"},
		{"caddy", "caddy", "caddy"},
		{"nginx", "nginx", "nginx"},
		{"mosquitto", "mosquitto", "mosquitto"},
		
		// Edge cases
		{"empty", "", ""},
		{"unknown", "unknown-service", "unknown-service"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeServiceName(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeServiceName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// Test that all Valkey subtypes are handled in the switch case
func TestValkeyModuleRegistration(t *testing.T) {
	valkeySubtypes := []string{
		"valkey",
		"valkey-server",
		"valkey-cache",
		"valkey-broker",
		"valkey-nosql",
	}

	for _, subtype := range valkeySubtypes {
		t.Run(subtype, func(t *testing.T) {
			// Verify that normalizeServiceName maps all subtypes to "valkey"
			normalized := normalizeServiceName(subtype)
			if normalized != "valkey" {
				t.Errorf("Valkey subtype %q should normalize to 'valkey', got %q", subtype, normalized)
			}
		})
	}
}

// Test that non-Valkey services are not affected
func TestNonValkeyServicesUnchanged(t *testing.T) {
	nonValkeyServices := []string{
		"mysql",
		"postgresql",
		"mongodb",
		"rabbitmq",
		"minio",
		"caddy",
		"nginx",
		"mosquitto",
		"vsftpd",
		"sftpgo",
		"pm2",
		"supervisor",
		"ansible",
	}

	for _, service := range nonValkeyServices {
		t.Run(service, func(t *testing.T) {
			normalized := normalizeServiceName(service)
			if normalized != service {
				t.Errorf("Non-Valkey service %q should remain unchanged, got %q", service, normalized)
			}
		})
	}
}
