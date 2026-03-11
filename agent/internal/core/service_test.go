package core

import (
	"testing"
)

func TestStatus(t *testing.T) {
	if StatusRunning != "running" {
		t.Error("Expected StatusRunning to be 'running'")
	}
	if StatusStopped != "stopped" {
		t.Error("Expected StatusStopped to be 'stopped'")
	}
}

// Logic tests for any helper functions in service.go
// Currently service.go only contains interfaces and constants.
// If there were any non-interface functions, I would test them here.
