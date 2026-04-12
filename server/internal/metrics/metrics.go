package metrics

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// MetricType represents the type of metric
type MetricType string

const (
	CounterType   MetricType = "counter"
	GaugeType     MetricType = "gauge"
	HistogramType MetricType = "histogram"
)

// Metric holds metric data
type Metric struct {
	Name   string
	Help   string
	Type   MetricType
	Labels map[string]string
	Value  float64
}

// MetricsCollector collects and serves Prometheus metrics
type MetricsCollector struct {
	mu       sync.RWMutex
	metrics  map[string]*Metric
	requests *RequestCounter
}

// RequestCounter tracks HTTP request metrics
type RequestCounter struct {
	mu            sync.RWMutex
	totalRequests int64
	requestsByPath map[string]int64
	errorsByPath   map[string]int64
	lastReset     time.Time
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	mc := &MetricsCollector{
		metrics: make(map[string]*Metric),
		requests: &RequestCounter{
			requestsByPath: make(map[string]int64),
			errorsByPath:   make(map[string]int64),
			lastReset:      time.Now(),
		},
	}

	// Register default metrics
	mc.RegisterMetric("prism_uptime_seconds", "Server uptime in seconds", GaugeType, nil)
	mc.RegisterMetric("prism_total_requests", "Total number of HTTP requests", CounterType, nil)
	mc.RegisterMetric("prism_connected_agents", "Number of connected agents", GaugeType, nil)
	mc.RegisterMetric("prism_ws_clients", "Number of WebSocket clients", GaugeType, nil)
	mc.RegisterMetric("prism_db_connections", "Database connection pool size", GaugeType, nil)

	return mc
}

// RegisterMetric registers a new metric
func (mc *MetricsCollector) RegisterMetric(name, help string, metricType MetricType, labels map[string]string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.metrics[name] = &Metric{
		Name:   name,
		Help:   help,
		Type:   metricType,
		Labels: labels,
	}
}

// SetMetric sets a metric value
func (mc *MetricsCollector) SetMetric(name string, value float64) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	if m, ok := mc.metrics[name]; ok {
		m.Value = value
	}
}

// IncrementCounter increments a counter metric
func (mc *MetricsCollector) IncrementCounter(name string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	if m, ok := mc.metrics[name]; ok {
		m.Value++
	}
}

// RecordRequest records an HTTP request
func (mc *MetricsCollector) RecordRequest(path string, statusCode int) {
	mc.requests.mu.Lock()
	defer mc.requests.mu.Unlock()

	mc.requests.totalRequests++

	// Normalize path (remove IDs)
	normalizedPath := normalizePath(path)

	mc.requests.requestsByPath[normalizedPath]++
	if statusCode >= 400 {
		mc.requests.errorsByPath[normalizedPath]++
	}
}

// normalizePath removes variable parts from paths for better metrics
func normalizePath(path string) string {
	parts := strings.Split(path, "/")
	normalized := make([]string, len(parts))
	for i, part := range parts {
		if i > 1 && len(part) > 0 && part[0] >= '0' && part[0] <= '9' {
			normalized[i] = ":id"
		} else {
			normalized[i] = part
		}
	}
	return strings.Join(normalized, "/")
}

// ServeHTTP serves Prometheus metrics
func (mc *MetricsCollector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	mc.mu.RLock()
	mc.requests.mu.RLock()
	defer mc.mu.RUnlock()
	defer mc.requests.mu.RUnlock()

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Write HELP and TYPE comments, then metric values
	fmt.Fprintf(w, "# HELP prism_uptime_seconds Server uptime in seconds\n")
	fmt.Fprintf(w, "# TYPE prism_uptime_seconds gauge\n")
	fmt.Fprintf(w, "prism_uptime_seconds %.2f\n", time.Since(startTime).Seconds())

	fmt.Fprintf(w, "# HELP prism_total_requests Total number of HTTP requests\n")
	fmt.Fprintf(w, "# TYPE prism_total_requests counter\n")
	fmt.Fprintf(w, "prism_total_requests %d\n", mc.requests.totalRequests)

	fmt.Fprintf(w, "# HELP prism_requests_by_path HTTP requests by path\n")
	fmt.Fprintf(w, "# TYPE prism_requests_by_path counter\n")
	for path, count := range mc.requests.requestsByPath {
		fmt.Fprintf(w, "prism_requests_by_path{path=\"%s\"} %d\n", path, count)
	}

	fmt.Fprintf(w, "# HELP prism_errors_by_path HTTP errors by path\n")
	fmt.Fprintf(w, "# TYPE prism_errors_by_path counter\n")
	for path, count := range mc.requests.errorsByPath {
		fmt.Fprintf(w, "prism_errors_by_path{path=\"%s\"} %d\n", path, count)
	}

	// Write custom metrics
	for _, m := range mc.metrics {
		fmt.Fprintf(w, "# HELP %s %s\n", m.Name, m.Help)
		fmt.Fprintf(w, "# TYPE %s %s\n", m.Name, m.Type)
		if len(m.Labels) > 0 {
			labelParts := make([]string, 0, len(m.Labels))
			for k, v := range m.Labels {
				labelParts = append(labelParts, fmt.Sprintf("%s=\"%s\"", k, v))
			}
			fmt.Fprintf(w, "%s{%s} %.2f\n", m.Name, strings.Join(labelParts, ","), m.Value)
		} else {
			fmt.Fprintf(w, "%s %.2f\n", m.Name, m.Value)
		}
	}
}

// startTime records when the metrics collector was created
var startTime = time.Now()
