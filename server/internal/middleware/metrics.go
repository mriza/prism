package middleware

import (
	"net/http"
	"prism-server/internal/metrics"
)

// MetricsMiddleware records HTTP request metrics
func MetricsMiddleware(mc *metrics.MetricsCollector) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Wrap response writer to capture status code
			wrapped := newMetricsResponseWriter(w)
			
			// Call next handler
			next.ServeHTTP(wrapped, r)
			
			// Record request
			mc.RecordRequest(r.URL.Path, wrapped.status)
		})
	}
}

// metricsResponseWriter wraps http.ResponseWriter to capture status code
type metricsResponseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func newMetricsResponseWriter(w http.ResponseWriter) *metricsResponseWriter {
	return &metricsResponseWriter{ResponseWriter: w, status: http.StatusOK}
}

func (rw *metricsResponseWriter) WriteHeader(code int) {
	if rw.wroteHeader {
		return
	}
	rw.status = code
	rw.wroteHeader = true
	rw.ResponseWriter.WriteHeader(code)
}
