package db

import (
	"context"
	"database/sql"
	"log"
	"prism-server/internal/models"
	"time"
)

// CreateAgentCertificate stores agent certificate in database
func CreateAgentCertificate(cert models.AgentCertificate) (models.AgentCertificate, error) {
	query := `INSERT INTO agent_certificates (id, server_id, fingerprint, issued_at, expires_at, revoked_at, revocation_reason)
	VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query,
		cert.ID,
		cert.ServerID,
		cert.Fingerprint,
		cert.IssuedAt,
		cert.ExpiresAt,
		cert.RevokedAt,
		cert.RevocationReason,
	)
	if err != nil {
		return cert, err
	}

	log.Printf("Created certificate for server %s (fingerprint: %s)", cert.ServerID, cert.Fingerprint[:16])
	return cert, nil
}

// GetAgentCertificateByServerID retrieves certificate for a server
func GetAgentCertificateByServerID(serverID string) (*models.AgentCertificate, error) {
	query := `SELECT id, server_id, fingerprint, issued_at, expires_at, revoked_at, revocation_reason
	FROM agent_certificates WHERE server_id = ? AND revoked_at IS NULL`

	row := DB.QueryRow(query, serverID)

	var cert models.AgentCertificate
	var revokedAt sql.NullTime
	var revocationReason sql.NullString

	err := row.Scan(&cert.ID, &cert.ServerID, &cert.Fingerprint, &cert.IssuedAt, &cert.ExpiresAt, &revokedAt, &revocationReason)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if revokedAt.Valid {
		cert.RevokedAt = &revokedAt.Time
	}
	if revocationReason.Valid {
		cert.RevocationReason = revocationReason.String
	}

	return &cert, nil
}

// GetAgentCertificateByID retrieves certificate by ID
func GetAgentCertificateByID(certID string) (*models.AgentCertificate, error) {
	query := `SELECT id, server_id, fingerprint, issued_at, expires_at, revoked_at, revocation_reason
	FROM agent_certificates WHERE id = ?`

	row := DB.QueryRow(query, certID)

	var cert models.AgentCertificate
	var revokedAt sql.NullTime
	var revocationReason sql.NullString

	err := row.Scan(&cert.ID, &cert.ServerID, &cert.Fingerprint, &cert.IssuedAt, &cert.ExpiresAt, &revokedAt, &revocationReason)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if revokedAt.Valid {
		cert.RevokedAt = &revokedAt.Time
	}
	if revocationReason.Valid {
		cert.RevocationReason = revocationReason.String
	}

	return &cert, nil
}

// RevokeAgentCertificate revokes a certificate
func RevokeAgentCertificate(certID string, reason string) error {
	now := time.Now().UTC()
	query := `UPDATE agent_certificates SET revoked_at = ?, revocation_reason = ? WHERE id = ?`

	_, err := DB.Exec(query, now, reason, certID)
	if err != nil {
		return err
	}

	log.Printf("Revoked certificate %s: %s", certID, reason)

	// Publish revocation event
	if PubSub != nil {
		cert, _ := GetAgentCertificateByID(certID)
		if cert != nil {
			PubSub.PublishAlert(context.Background(), "certificate.revoked", map[string]interface{}{
				"certificate_id": certID,
				"server_id":      cert.ServerID,
				"fingerprint":    cert.Fingerprint,
				"reason":         reason,
			})
		}
	}

	return nil
}

// GetExpiringCertificates returns certificates expiring within threshold
func GetExpiringCertificates(threshold time.Duration) ([]models.AgentCertificate, error) {
	query := `SELECT id, server_id, fingerprint, issued_at, expires_at, revoked_at, revocation_reason
	FROM agent_certificates 
	WHERE revoked_at IS NULL AND expires_at <= ?
	ORDER BY expires_at ASC`

	rows, err := DB.Query(query, time.Now().UTC().Add(threshold))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var certificates []models.AgentCertificate
	for rows.Next() {
		var cert models.AgentCertificate
		var revokedAt sql.NullTime
		var revocationReason sql.NullString

		err := rows.Scan(&cert.ID, &cert.ServerID, &cert.Fingerprint, &cert.IssuedAt, &cert.ExpiresAt, &revokedAt, &revocationReason)
		if err != nil {
			return nil, err
		}

		if revokedAt.Valid {
			cert.RevokedAt = &revokedAt.Time
		}
		if revocationReason.Valid {
			cert.RevocationReason = revocationReason.String
		}

		certificates = append(certificates, cert)
	}

	return certificates, nil
}

// GetCertificatesByStatus returns certificates by status (active/revoked)
func GetCertificatesByStatus(status string) ([]models.AgentCertificate, error) {
	var query string
	var args []interface{}

	if status == "revoked" {
		query = `SELECT id, server_id, fingerprint, issued_at, expires_at, revoked_at, revocation_reason
		FROM agent_certificates WHERE revoked_at IS NOT NULL ORDER BY revoked_at DESC`
	} else {
		query = `SELECT id, server_id, fingerprint, issued_at, expires_at, revoked_at, revocation_reason
		FROM agent_certificates WHERE revoked_at IS NULL ORDER BY expires_at ASC`
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var certificates []models.AgentCertificate
	for rows.Next() {
		var cert models.AgentCertificate
		var revokedAt sql.NullTime
		var revocationReason sql.NullString

		err := rows.Scan(&cert.ID, &cert.ServerID, &cert.Fingerprint, &cert.IssuedAt, &cert.ExpiresAt, &revokedAt, &revocationReason)
		if err != nil {
			return nil, err
		}

		if revokedAt.Valid {
			cert.RevokedAt = &revokedAt.Time
		}
		if revocationReason.Valid {
			cert.RevocationReason = revocationReason.String
		}

		certificates = append(certificates, cert)
	}

	return certificates, nil
}

// UpdateAgentCertificateFingerprint updates certificate fingerprint
func UpdateAgentCertificateFingerprint(certID string, fingerprint string) error {
	query := `UPDATE agent_certificates SET fingerprint = ? WHERE id = ?`
	_, err := DB.Exec(query, fingerprint, certID)
	return err
}

// DeleteAgentCertificate deletes a certificate (use RevokeAgentCertificate instead)
func DeleteAgentCertificate(certID string) error {
	query := `DELETE FROM agent_certificates WHERE id = ?`
	_, err := DB.Exec(query, certID)
	if err == nil {
		log.Printf("Deleted certificate %s", certID)
	}
	return err
}

// GetCertificateStats returns certificate statistics
func GetCertificateStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total certificates
	var total int
	err := DB.QueryRow(`SELECT COUNT(*) FROM agent_certificates`).Scan(&total)
	if err != nil {
		return nil, err
	}
	stats["total"] = total

	// Active certificates
	var active int
	err = DB.QueryRow(`SELECT COUNT(*) FROM agent_certificates WHERE revoked_at IS NULL`).Scan(&active)
	if err != nil {
		return nil, err
	}
	stats["active"] = active

	// Revoked certificates
	var revoked int
	err = DB.QueryRow(`SELECT COUNT(*) FROM agent_certificates WHERE revoked_at IS NOT NULL`).Scan(&revoked)
	if err != nil {
		return nil, err
	}
	stats["revoked"] = revoked

	// Expiring soon (30 days)
	var expiringSoon int
	err = DB.QueryRow(`SELECT COUNT(*) FROM agent_certificates 
		WHERE revoked_at IS NULL AND expires_at <= ?`, time.Now().UTC().Add(30*24*time.Hour)).Scan(&expiringSoon)
	if err != nil {
		return nil, err
	}
	stats["expiring_soon"] = expiringSoon

	// Expired
	var expired int
	err = DB.QueryRow(`SELECT COUNT(*) FROM agent_certificates 
		WHERE revoked_at IS NULL AND expires_at < ?`, time.Now().UTC()).Scan(&expired)
	if err != nil {
		return nil, err
	}
	stats["expired"] = expired

	return stats, nil
}

// CleanupExpiredCertificates marks expired certificates as revoked
func CleanupExpiredCertificates() (int, error) {
	query := `UPDATE agent_certificates 
	SET revoked_at = ?, revocation_reason = ? 
	WHERE revoked_at IS NULL AND expires_at < ?`

	result, err := DB.Exec(query, time.Now().UTC(), "expired", time.Now().UTC())
	if err != nil {
		return 0, err
	}

	count, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	if count > 0 {
		log.Printf("Cleaned up %d expired certificates", count)
	}

	return int(count), nil
}
