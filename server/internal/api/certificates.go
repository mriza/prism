package api

import (
	"encoding/json"
	"log"
	"net/http"
	"prism-server/internal/db"
	"prism-server/internal/models"
	"prism-server/internal/security"
	"strings"
	"time"
)

// globalCA holds the Certificate Authority instance for signing agent certificates
// It is initialized at server startup in cmd/server/main.go via SetCertificateAuthority
var globalCA *security.CertificateAuthority

// SetCertificateAuthority sets the global Certificate Authority instance
// This should be called once at server startup
func SetCertificateAuthority(ca *security.CertificateAuthority) {
	globalCA = ca
}

// HandleCertificates handles certificate management endpoints
func HandleCertificates(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		// Get all certificates or filter by status
		status := r.URL.Query().Get("status")

		var certificates []models.AgentCertificate
		var err error

		if status != "" {
			certificates, err = db.GetCertificatesByStatus(status)
		} else {
			certificates, err = db.GetCertificatesByStatus("active")
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if certificates == nil {
			certificates = []models.AgentCertificate{}
		}
		json.NewEncoder(w).Encode(certificates)

	case "POST":
		// Generate new certificate for server
		var req struct {
			ServerID string `json:"server_id"`
			Hostname string `json:"hostname"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if req.ServerID == "" {
			http.Error(w, "server_id is required", http.StatusBadRequest)
			return
		}

		// Get CA from context (initialized at startup)
		ca := getCertificateAuthority()
		if ca == nil {
			http.Error(w, "Certificate authority not initialized", http.StatusInternalServerError)
			return
		}

		// Generate certificate
		certPEM, keyPEM, err := ca.GenerateAgentCertificate(req.ServerID, req.Hostname)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Get fingerprint
		fingerprint, err := security.GetCertificateFingerprint(certPEM)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Get certificate info
		certInfo, err := security.GetCertificateInfo(certPEM)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Store in database
		cert := models.AgentCertificate{
			ID:          certInfo["serial"].(string),
			ServerID:    req.ServerID,
			Fingerprint: fingerprint,
			IssuedAt:    certInfo["not_before"].(time.Time),
			ExpiresAt:   certInfo["not_after"].(time.Time),
		}

		_, err = db.CreateAgentCertificate(cert)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit
		db.LogAuditAction("system", "certificate_generated", "agent_certificate", cert.ID, r.RemoteAddr, map[string]interface{}{
			"server_id":   req.ServerID,
			"hostname":    req.Hostname,
			"fingerprint": fingerprint,
		})

		// Return certificate and key
		response := map[string]interface{}{
			"certificate": string(certPEM),
			"private_key": string(keyPEM),
			"fingerprint": fingerprint,
			"expires_at":  cert.ExpiresAt,
		}

		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleCertificateDetail handles individual certificate operations
func HandleCertificateDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/certificates/")
	if id == "" {
		http.Error(w, "Certificate ID missing", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		cert, err := db.GetAgentCertificateByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if cert == nil {
			http.Error(w, "Certificate not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(cert)

	case "POST":
		// Revoke certificate
		var req struct {
			Reason string `json:"reason"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		if req.Reason == "" {
			req.Reason = "administrative"
		}

		err := db.RevokeAgentCertificate(id, req.Reason)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit
		db.LogAuditAction("system", "certificate_revoked", "agent_certificate", id, r.RemoteAddr, map[string]interface{}{
			"reason": req.Reason,
		})

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleEnrollmentKeys handles enrollment key management
func HandleEnrollmentKeys(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	switch r.Method {
	case "GET":
		// Get all enrollment keys
		includeUsed := r.URL.Query().Get("include_used") == "true"

		keys, err := db.GetEnrollmentKeys(includeUsed)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if keys == nil {
			keys = []models.EnrollmentKey{}
		}

		// Don't return key hashes
		sanitizedKeys := make([]map[string]interface{}, len(keys))
		for i, key := range keys {
			sanitizedKeys[i] = map[string]interface{}{
				"id":                key.ID,
				"created_by":        key.CreatedBy,
				"expires_at":        key.ExpiresAt,
				"used_at":           key.UsedAt,
				"used_by_server_id": key.UsedByServerID,
			}
		}

		json.NewEncoder(w).Encode(sanitizedKeys)

	case "POST":
		// Generate new enrollment key
		var req struct {
			Validity string `json:"validity"` // e.g., "1h", "24h"
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}

		// Parse validity duration
		validity := 1 * time.Hour // default 1 hour
		if req.Validity != "" {
			var err error
			validity, err = time.ParseDuration(req.Validity)
			if err != nil {
				http.Error(w, "Invalid validity duration", http.StatusBadRequest)
				return
			}
		}

		// Get user from context (for now, use "system")
		createdBy := "system"

		// Generate key
		psk, key, err := db.GenerateEnrollmentKeyWithCallback(r.Context(), createdBy, validity)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit
		db.LogAuditAction("system", "enrollment_key_created", "enrollment_key", key.ID, r.RemoteAddr, map[string]interface{}{
			"validity":   validity.String(),
			"expires_at": key.ExpiresAt,
		})

		// Return the PSK (only time it's available)
		response := map[string]interface{}{
			"psk":        psk,
			"key_id":     key.ID,
			"expires_at": key.ExpiresAt,
			"validity":   validity.String(),
			"warning":    "Save this PSK securely. It will not be shown again.",
		}

		log.Printf("Generated enrollment key: %s", psk)

		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleEnrollmentKeyDetail handles individual enrollment key operations
func HandleEnrollmentKeyDetail(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/enrollment-keys/")
	if id == "" {
		http.Error(w, "Enrollment key ID missing", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		key, err := db.GetEnrollmentKeyByID(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if key == nil {
			http.Error(w, "Enrollment key not found", http.StatusNotFound)
			return
		}

		// Don't return key hash
		response := map[string]interface{}{
			"id":                key.ID,
			"created_by":        key.CreatedBy,
			"expires_at":        key.ExpiresAt,
			"used_at":           key.UsedAt,
			"used_by_server_id": key.UsedByServerID,
		}

		json.NewEncoder(w).Encode(response)

	case "DELETE":
		err := db.DeleteEnrollmentKey(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Log audit
		db.LogAuditAction("system", "enrollment_key_deleted", "enrollment_key", id, r.RemoteAddr, nil)

		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleCertificateStats returns certificate statistics
func HandleCertificateStats(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := db.GetCertificateStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}

// HandleEnrollmentKeyStats returns enrollment key statistics
func HandleEnrollmentKeyStats(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := db.GetEnrollmentKeyStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}

// HandleCertificateAuthority returns CA information
func HandleCertificateAuthority(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ca := getCertificateAuthority()
	if ca == nil {
		http.Error(w, "Certificate authority not initialized", http.StatusInternalServerError)
		return
	}

	// Return CA info (not the private key!)
	info := map[string]interface{}{
		"common_name":  ca.CACert.Subject.CommonName,
		"organization": ca.CACert.Subject.Organization,
		"not_before":   ca.CACert.NotBefore,
		"not_after":    ca.CACert.NotAfter,
		"serial":       ca.CACert.SerialNumber.String(),
		"is_ca":        ca.CACert.IsCA,
		"max_path_len": ca.CACert.MaxPathLen,
	}

	json.NewEncoder(w).Encode(info)
}

// getCertificateAuthority returns the global CA instance
// The CA is initialized at server startup in cmd/server/main.go
func getCertificateAuthority() *security.CertificateAuthority {
	return globalCA
}
