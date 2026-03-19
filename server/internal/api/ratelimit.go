package api

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter implements a simple in-memory rate limiter
type RateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     int           // max requests
	window   time.Duration // time window
}

type visitor struct {
	last     time.Time
	count    int
	resetAt  time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}
	
	// Start cleanup goroutine
	go rl.cleanup()
	
	return rl
}

// cleanup removes old entries periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.resetAt) > rl.window {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if a request from the given IP is allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	
	now := time.Now()
	
	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{
			last:    now,
			count:   1,
			resetAt: now.Add(rl.window),
		}
		return true
	}
	
	// Reset if window has passed
	if now.After(v.resetAt) {
		v.count = 1
		v.resetAt = now.Add(rl.window)
		v.last = now
		return true
	}
	
	// Check if rate limit exceeded
	if v.count >= rl.rate {
		return false
	}
	
	v.count++
	v.last = now
	return true
}

// Middleware creates an HTTP middleware that applies rate limiting
func (rl *RateLimiter) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get client IP
		ip := r.RemoteAddr
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			ip = forwarded
		}
		
		if !rl.Allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "rate limit exceeded", "message": "Too many requests. Please try again later."}`))
			return
		}
		
		next(w, r)
	}
}

// LoginRateLimiter is a global rate limiter for login attempts (5 per minute)
var LoginRateLimiter = NewRateLimiter(5, time.Minute)
