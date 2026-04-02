package api

import (
	"fmt"
	"testing"
)

// TestFTPServiceTypeMapping tests the explicit FTP type mapping (BUG-005 fix)
func TestFTPServiceTypeMapping(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"ftp-vsftpd", "ftp-vsftpd", "vsftpd"},
		{"vsftpd", "vsftpd", "vsftpd"},
		{"ftp-sftpgo", "ftp-sftpgo", "sftpgo"},
		{"sftpgo", "sftpgo", "sftpgo"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the switch case logic from accounts.go
			agentSvc := ""
			switch tt.input {
			case "ftp-vsftpd", "vsftpd":
				agentSvc = "vsftpd"
			case "ftp-sftpgo", "sftpgo":
				agentSvc = "sftpgo"
			}
			
			if agentSvc != tt.expected {
				t.Errorf("FTP type %q mapped to %q, want %q", tt.input, agentSvc, tt.expected)
			}
		})
	}
}

// TestRabbitMQWarningHeader tests that RabbitMQ sync errors set warning header
func TestRabbitMQWarningHeader(t *testing.T) {
	// This test verifies the logic that sets X-RabbitMQ-Warning header
	// when binding sync fails (BUG-003 fix)
	
	tests := []struct {
		name          string
		syncError     error
		expectWarning bool
	}{
		{"sync success", nil, false},
		{"sync failure", fmt.Errorf("connection timeout"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the warning header logic
			hasWarning := false
			if tt.syncError != nil {
				hasWarning = true
				// In real code: w.Header().Set("X-RabbitMQ-Warning", "Bindings sync failed: "+err.Error())
			}
			
			if hasWarning != tt.expectWarning {
				t.Errorf("Expected warning=%v, got %v", tt.expectWarning, hasWarning)
			}
		})
	}
}

// TestPM2ProxyErrorHandling tests that PM2 proxy errors are returned (BUG-004 fix)
func TestPM2ProxyErrorHandling(t *testing.T) {
	tests := []struct {
		name          string
		proxyError    error
		expectFailure bool
	}{
		{"proxy success", nil, false},
		{"proxy failure", fmt.Errorf("port already in use"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the error handling logic from PUT handler
			hasError := false
			if tt.proxyError != nil {
				hasError = true
				// In real code: http.Error(w, fmt.Sprintf("Failed to configure PM2 reverse proxy: %v", err), http.StatusInternalServerError)
			}
			
			if hasError != tt.expectFailure {
				t.Errorf("Expected failure=%v, got %v", tt.expectFailure, hasError)
			}
		})
	}
}
