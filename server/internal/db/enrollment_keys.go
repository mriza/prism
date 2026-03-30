package db

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"prism-server/internal/models"
	"time"
)

// CreateEnrollmentKey creates a new one-time enrollment key
func CreateEnrollmentKey(createdBy string, validity time.Duration) (string, *models.EnrollmentKey, error) {
	// Generate random PSK
	psk := generateRandomPSK()

	// Hash the PSK
	hash := hashPSK(psk)

	key := models.EnrollmentKey{
		CreatedBy: createdBy,
		ExpiresAt: time.Now().Add(validity),
	}

	query := `INSERT INTO enrollment_keys (id, key_hash, created_by, expires_at, used_at, used_by_server_id)
	VALUES (?, ?, ?, ?, ?, ?)`

	_, err := DB.Exec(query, key.ID, hash, key.CreatedBy, key.ExpiresAt, nil, nil)
	if err != nil {
		return "", nil, err
	}

	log.Printf("Created enrollment key (hash: %s...) for user %s", hash[:16], createdBy)

	// Return the plain PSK (only time it's available)
	return psk, &key, nil
}

// VerifyEnrollmentKey verifies and uses an enrollment key
func VerifyEnrollmentKey(psk string, serverID string) (*models.EnrollmentKey, error) {
	// Hash the PSK
	hash := hashPSK(psk)

	// Find the key
	query := `SELECT id, key_hash, created_by, expires_at, used_at, used_by_server_id
	FROM enrollment_keys WHERE key_hash = ?`

	row := DB.QueryRow(query, hash)

	var key models.EnrollmentKey
	var usedAt sql.NullTime
	var usedByServerID sql.NullString

	err := row.Scan(&key.ID, &key.KeyHash, &key.CreatedBy, &key.ExpiresAt, &usedAt, &usedByServerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invalid enrollment key")
		}
		return nil, err
	}

	// Check if already used
	if usedAt.Valid {
		return nil, fmt.Errorf("enrollment key already used")
	}

	// Check if expired
	if time.Now().UTC().After(key.ExpiresAt) {
		return nil, fmt.Errorf("enrollment key expired")
	}

	// Mark as used
	err = UseEnrollmentKey(key.ID, serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to mark key as used: %w", err)
	}

	log.Printf("Enrollment key used for server %s", serverID)

	return &key, nil
}

// UseEnrollmentKey marks an enrollment key as used
func UseEnrollmentKey(id string, serverID string) error {
	now := time.Now().UTC()
	query := `UPDATE enrollment_keys SET used_at = ?, used_by_server_id = ? WHERE id = ?`
	_, err := DB.Exec(query, now, serverID, id)
	return err
}

// GetEnrollmentKeys returns all enrollment keys
func GetEnrollmentKeys(includeUsed bool) ([]models.EnrollmentKey, error) {
	var query string

	if includeUsed {
		query = `SELECT id, key_hash, created_by, expires_at, used_at, used_by_server_id
		FROM enrollment_keys ORDER BY created_at DESC`
	} else {
		query = `SELECT id, key_hash, created_by, expires_at, used_at, used_by_server_id
		FROM enrollment_keys WHERE used_at IS NULL ORDER BY created_at DESC`
	}

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []models.EnrollmentKey
	for rows.Next() {
		var key models.EnrollmentKey
		var usedAt sql.NullTime
		var usedByServerID sql.NullString

		err := rows.Scan(&key.ID, &key.KeyHash, &key.CreatedBy, &key.ExpiresAt, &usedAt, &usedByServerID)
		if err != nil {
			return nil, err
		}

		if usedAt.Valid {
			key.UsedAt = &usedAt.Time
		}
		if usedByServerID.Valid {
			key.UsedByServerID = &usedByServerID.String
		}

		keys = append(keys, key)
	}

	return keys, nil
}

// GetEnrollmentKeyByID retrieves a key by ID
func GetEnrollmentKeyByID(id string) (*models.EnrollmentKey, error) {
	query := `SELECT id, key_hash, created_by, expires_at, used_at, used_by_server_id
	FROM enrollment_keys WHERE id = ?`

	row := DB.QueryRow(query, id)

	var key models.EnrollmentKey
	var usedAt sql.NullTime
	var usedByServerID sql.NullString

	err := row.Scan(&key.ID, &key.KeyHash, &key.CreatedBy, &key.ExpiresAt, &usedAt, &usedByServerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if usedAt.Valid {
		key.UsedAt = &usedAt.Time
	}
	if usedByServerID.Valid {
		key.UsedByServerID = &usedByServerID.String
	}

	return &key, nil
}

// DeleteEnrollmentKey deletes an enrollment key
func DeleteEnrollmentKey(id string) error {
	query := `DELETE FROM enrollment_keys WHERE id = ?`
	_, err := DB.Exec(query, id)
	if err == nil {
		log.Printf("Deleted enrollment key %s", id)
	}
	return err
}

// CleanupExpiredEnrollmentKeys removes expired keys
func CleanupExpiredEnrollmentKeys() (int, error) {
	query := `DELETE FROM enrollment_keys WHERE expires_at < ? AND (used_at IS NOT NULL OR expires_at < ?)`

	result, err := DB.Exec(query, time.Now().UTC(), time.Now().UTC())
	if err != nil {
		return 0, err
	}

	count, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	if count > 0 {
		log.Printf("Cleaned up %d expired enrollment keys", count)
	}

	return int(count), nil
}

// GetEnrollmentKeyStats returns enrollment key statistics
func GetEnrollmentKeyStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total keys
	var total int
	err := DB.QueryRow(`SELECT COUNT(*) FROM enrollment_keys`).Scan(&total)
	if err != nil {
		return nil, err
	}
	stats["total"] = total

	// Unused keys
	var unused int
	err = DB.QueryRow(`SELECT COUNT(*) FROM enrollment_keys WHERE used_at IS NULL`).Scan(&unused)
	if err != nil {
		return nil, err
	}
	stats["unused"] = unused

	// Used keys
	var used int
	err = DB.QueryRow(`SELECT COUNT(*) FROM enrollment_keys WHERE used_at IS NOT NULL`).Scan(&used)
	if err != nil {
		return nil, err
	}
	stats["used"] = used

	// Expired keys
	var expired int
	err = DB.QueryRow(`SELECT COUNT(*) FROM enrollment_keys WHERE expires_at < ?`, time.Now().UTC()).Scan(&expired)
	if err != nil {
		return nil, err
	}
	stats["expired"] = expired

	return stats, nil
}

// generateRandomPSK generates a random pre-shared key
func generateRandomPSK() string {
	// In real implementation, use crypto/rand
	// This is a simplified version
	return fmt.Sprintf("psk_%d", time.Now().UnixNano())
}

// hashPSK hashes a PSK using SHA-256
func hashPSK(psk string) string {
	hash := sha256.Sum256([]byte(psk))
	return hex.EncodeToString(hash[:])
}

// ValidatePSKFormat validates PSK format
func ValidatePSKFormat(psk string) bool {
	// PSK should be at least 32 characters
	if len(psk) < 32 {
		return false
	}

	// PSK should contain only alphanumeric and special characters
	for _, c := range psk {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-') {
			return false
		}
	}

	return true
}

// GenerateEnrollmentKeyWithCallback creates a key and publishes event
func GenerateEnrollmentKeyWithCallback(ctx context.Context, createdBy string, validity time.Duration) (string, *models.EnrollmentKey, error) {
	psk, key, err := CreateEnrollmentKey(createdBy, validity)
	if err != nil {
		return "", nil, err
	}

	// Publish event
	if PubSub != nil {
		PubSub.PublishAlert(ctx, "enrollment_key.created", map[string]interface{}{
			"key_id":     key.ID,
			"created_by": createdBy,
			"expires_at": key.ExpiresAt,
			"validity":   validity.String(),
		})
	}

	return psk, key, nil
}
