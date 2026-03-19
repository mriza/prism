package middleware

import (
	"context"
	"net/http"
	"time"
)

// TimeoutConfig holds timeout configuration
type TimeoutConfig struct {
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// DefaultTimeout returns default timeout configuration
func DefaultTimeout() TimeoutConfig {
	return TimeoutConfig{
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}
}

// TimeoutMiddleware adds context timeout to HTTP handlers
func TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			// Add timeout to response header
			w.Header().Set("X-Timeout-Seconds", timeout.String())

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// WithContextTimeout wraps a handler with context timeout
func WithContextTimeout(handler func(http.ResponseWriter, *http.Request), timeout time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()

		// Call handler with context
		handler(w, r.WithContext(ctx))
	}
}

// CheckContextError checks if context was cancelled or timed out
func CheckContextError(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}
