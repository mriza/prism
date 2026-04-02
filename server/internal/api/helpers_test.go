package api

import (
	"testing"
)

func TestIsValkeyType(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"legacy valkey", "valkey", true},
		{"valkey-server", "valkey-server", true},
		{"valkey-cache", "valkey-cache", true},
		{"valkey-broker", "valkey-broker", true},
		{"valkey-nosql", "valkey-nosql", true},
		{"mysql", "mysql", false},
		{"postgresql", "postgresql", false},
		{"mongodb", "mongodb", false},
		{"rabbitmq", "rabbitmq", false},
		{"empty", "", false},
		{"typo", "valkeyy", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValkeyType(tt.input)
			if result != tt.expected {
				t.Errorf("isValkeyType(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestIsDatabaseType(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"mysql", "mysql", true},
		{"postgresql", "postgresql", true},
		{"mongodb", "mongodb", true},
		{"rabbitmq", "rabbitmq", true},
		{"valkey", "valkey", true},
		{"valkey-cache", "valkey-cache", true},
		{"valkey-broker", "valkey-broker", true},
		{"valkey-nosql", "valkey-nosql", true},
		{"minio", "minio", false},
		{"caddy", "caddy", false},
		{"mosquitto", "mosquitto", false},
		{"empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isDatabaseType(tt.input)
			if result != tt.expected {
				t.Errorf("isDatabaseType(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}
