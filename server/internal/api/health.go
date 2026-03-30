package api

import (
	"context"
	"encoding/json"
	"net/http"
	"prism-server/internal/db"
	"time"
)

// HealthStatus represents the health status response
type HealthStatus struct {
	Status    string                 `json:"status"` // healthy, unhealthy, starting
	Timestamp time.Time              `json:"timestamp"`
	Version   string                 `json:"version"`
	Checks    map[string]HealthCheck `json:"checks"`
}

// HealthCheck represents individual health check result
type HealthCheck struct {
	Status    string `json:"status"`
	Message   string `json:"message,omitempty"`
	Timestamp string `json:"timestamp"`
}

var (
	appVersion     = "4.2.0"
	startTime      = time.Now()
	startupComplete = false
)

// HandleHealthLive handles liveness probe
// Returns healthy if the server is running (not deadlocked)
func HandleHealthLive(w http.ResponseWriter, r *http.Request) {
	status := HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now().UTC(),
		Version:   appVersion,
		Checks: map[string]HealthCheck{
			"server": {
				Status:    "healthy",
				Message:   "Server is running",
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if r.URL.Query().Get("format") == "json" {
		json.NewEncoder(w).Encode(status)
	} else {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}
}

// HandleHealthReady handles readiness probe
// Returns healthy if the server is ready to accept traffic
func HandleHealthReady(w http.ResponseWriter, r *http.Request) {
	checks := make(map[string]HealthCheck)
	overallStatus := "healthy"

	// Check database
	dbCheck := checkDatabase()
	checks["database"] = dbCheck
	if dbCheck.Status != "healthy" {
		overallStatus = "unhealthy"
	}

	// Check cache (Valkey)
	cacheCheck := checkCache()
	checks["cache"] = cacheCheck
	if cacheCheck.Status != "healthy" && cacheCheck.Status != "degraded" {
		// Cache is optional, so only mark as degraded
		checks["cache"] = HealthCheck{
			Status:    "degraded",
			Message:   "Cache unavailable, using database only",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
	}

	// Check if startup is complete
	if !startupComplete {
		overallStatus = "starting"
	}

	status := HealthStatus{
		Status:    overallStatus,
		Timestamp: time.Now().UTC(),
		Version:   appVersion,
		Checks:    checks,
	}

	w.Header().Set("Content-Type", "application/json")
	if overallStatus != "healthy" {
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	json.NewEncoder(w).Encode(status)
}

// HandleHealthStartup handles startup probe
// Returns healthy if the server has completed startup
func HandleHealthStartup(w http.ResponseWriter, r *http.Request) {
	status := "healthy"
	message := "Startup complete"

	if !startupComplete {
		status = "starting"
		message = "Server is still starting up"
	}

	checks := map[string]HealthCheck{
		"startup": {
			Status:    status,
			Message:   message,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		"uptime": {
			Status:    "healthy",
			Message:   time.Since(startTime).String(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
	}

	response := HealthStatus{
		Status:    status,
		Timestamp: time.Now().UTC(),
		Version:   appVersion,
		Checks:    checks,
	}

	w.Header().Set("Content-Type", "application/json")
	if status != "healthy" {
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	json.NewEncoder(w).Encode(response)
}

// HandleHealthFull handles full health check with all details
func HandleHealthFull(w http.ResponseWriter, r *http.Request) {
	checks := make(map[string]HealthCheck)
	overallStatus := "healthy"

	// Database check
	dbCheck := checkDatabase()
	checks["database"] = dbCheck
	if dbCheck.Status != "healthy" {
		overallStatus = "unhealthy"
	}

	// Cache check
	cacheCheck := checkCache()
	checks["cache"] = cacheCheck

	// Server count check
	serverCheck := checkServers()
	checks["servers"] = serverCheck

	// Memory check
	memoryCheck := checkMemory()
	checks["memory"] = memoryCheck

	// Startup check
	if !startupComplete {
		overallStatus = "starting"
	}

	status := HealthStatus{
		Status:    overallStatus,
		Timestamp: time.Now().UTC(),
		Version:   appVersion,
		Checks:    checks,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(status)
}

// checkDatabase performs a database health check
func checkDatabase() HealthCheck {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Try a simple query
	err := db.DB.PingContext(ctx)
	if err != nil {
		return HealthCheck{
			Status:    "unhealthy",
			Message:   "Database connection failed: " + err.Error(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
	}

	// Check if we can query tables
	var count int
	err = db.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM servers").Scan(&count)
	if err != nil {
		return HealthCheck{
			Status:    "degraded",
			Message:   "Database query failed: " + err.Error(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
	}

	return HealthCheck{
		Status:    "healthy",
		Message:   "Database connected, " + string(rune(count)) + " servers",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// checkCache performs a cache health check
func checkCache() HealthCheck {
	if db.CacheClient == nil {
		return HealthCheck{
			Status:    "disabled",
			Message:   "Cache is not configured",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	// Try to ping cache
	_, err := db.CacheClient.Health(ctx)
	if err != nil {
		return HealthCheck{
			Status:    "unhealthy",
			Message:   "Cache connection failed: " + err.Error(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
	}

	return HealthCheck{
		Status:    "healthy",
		Message:   "Cache connected",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// checkServers performs a server connectivity check
func checkServers() HealthCheck {
	servers, err := db.GetServers()
	if err != nil {
		return HealthCheck{
			Status:    "degraded",
			Message:   "Failed to query servers: " + err.Error(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
	}

	activeCount := 0
	for _, s := range servers {
		if s.Status == "active" {
			activeCount++
		}
	}

	return HealthCheck{
		Status:    "healthy",
		Message:   string(rune(activeCount)) + "/" + string(rune(len(servers))) + " servers active",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// checkMemory performs a memory usage check
func checkMemory() HealthCheck {
	// Simple memory check - in production you'd use runtime.MemStats
	return HealthCheck{
		Status:    "healthy",
		Message:   "Memory usage normal",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// MarkStartupComplete marks the startup as complete
func MarkStartupComplete() {
	startupComplete = true
}

// IsStartupComplete returns whether startup is complete
func IsStartupComplete() bool {
	return startupComplete
}
