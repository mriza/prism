package middleware

import (
	"net/http"
	"strings"

	"prism-server/internal/config"
)

// CORSMiddleware handles Cross-Origin Resource Sharing
func CORSMiddleware(cfg config.CORSConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, allowedOrigin := range cfg.AllowedOrigins {
				if allowedOrigin == "*" || allowedOrigin == origin {
					allowed = true
					break
				}
				// Support wildcard subdomains (e.g., *.example.com)
				if strings.HasPrefix(allowedOrigin, "*.") {
					domain := allowedOrigin[2:]
					if strings.HasSuffix(origin, domain) {
						allowed = true
						break
					}
				}
			}

			if allowed {
				// Set CORS headers
				if cfg.AllowedOrigins[0] == "*" && cfg.AllowCredentials {
					// When using credentials, can't use wildcard origin
					w.Header().Set("Access-Control-Allow-Origin", origin)
				} else {
					w.Header().Set("Access-Control-Allow-Origin", strings.Join(cfg.AllowedOrigins, ","))
				}

				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "86400")

				// Handle preflight requests
				if r.Method == "OPTIONS" {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
