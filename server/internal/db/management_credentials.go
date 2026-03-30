package db

import (
	"database/sql"
	"fmt"
	"log"
	"prism-server/internal/models"
	"prism-server/internal/security"
	"time"

	"github.com/google/uuid"
)

// CredentialEncryptor is the global encryptor for management credentials
// Initialized from environment variable PRISM_ENCRYPTION_KEY (base64-encoded)
var CredentialEncryptor *security.Encryptor

// InitCredentialEncryptor initializes the credential encryptor
// If keyBase64 is empty, it generates a new key (NOT recommended for production)
func InitCredentialEncryptor(keyBase64 string) error {
	var key []byte
	var err error

	if keyBase64 == "" {
		// Generate new key (warning: not persistent across restarts)
		log.Println("Warning: No encryption key provided. Generating temporary key.")
		key, err = security.GenerateKey()
		if err != nil {
			return err
		}
		log.Println("Generated temporary encryption key. Set PRISM_ENCRYPTION_KEY for persistence.")
	} else {
		// Decode base64 key
		key, err = security.DecodeKey(keyBase64)
		if err != nil {
			return err
		}
	}

	CredentialEncryptor, err = security.NewEncryptor(key)
	if err != nil {
		return err
	}

	log.Println("Credential encryptor initialized with AES-256-GCM")
	return nil
}

// CreateManagementCredential creates a new management credential with encryption
func CreateManagementCredential(mc models.ManagementCredential) (models.ManagementCredential, error) {
	// Encrypt sensitive fields if encryptor is available
	if mc.ID == "" {
		mc.ID = uuid.NewString()
	}

	var usernameEncrypted, passwordEncrypted, connParamsEncrypted []byte
	var err error

	if CredentialEncryptor != nil {
		// Encrypt username
		usernameB64, err := CredentialEncryptor.EncryptBytes(mc.UsernameEncrypted)
		if err != nil {
			return mc, err
		}
		usernameEncrypted = []byte(usernameB64)

		// Encrypt password
		passwordB64, err := CredentialEncryptor.EncryptBytes(mc.PasswordEncrypted)
		if err != nil {
			return mc, err
		}
		passwordEncrypted = []byte(passwordB64)

		// Encrypt connection params if present
		if len(mc.ConnectionParamsEncrypted) > 0 {
			connParamsB64, err := CredentialEncryptor.EncryptBytes(mc.ConnectionParamsEncrypted)
			if err != nil {
				return mc, err
			}
			connParamsEncrypted = []byte(connParamsB64)
		}
	} else {
		// Store as-is if no encryptor (not recommended)
		usernameEncrypted = mc.UsernameEncrypted
		passwordEncrypted = mc.PasswordEncrypted
		connParamsEncrypted = mc.ConnectionParamsEncrypted
	}

	now := time.Now().UTC()
	if mc.CreatedAt.IsZero() {
		mc.CreatedAt = now
	}
	if mc.UpdatedAt.IsZero() {
		mc.UpdatedAt = now
	}

	query := `INSERT INTO management_credentials (
		id, service_id, credential_type, username_encrypted, password_encrypted, 
		connection_params_encrypted, last_verified_at, status, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err = DB.Exec(query,
		mc.ID, mc.ServiceID, mc.CredentialType,
		usernameEncrypted, passwordEncrypted, connParamsEncrypted,
		mc.LastVerifiedAt, mc.Status, mc.CreatedAt, mc.UpdatedAt,
	)
	if err != nil {
		return mc, err
	}

	log.Printf("Created management credential for service %s (type: %s)", mc.ServiceID, mc.CredentialType)
	return mc, nil
}

// GetManagementCredentialByServiceID retrieves and decrypts management credential
func GetManagementCredentialByServiceID(serviceID string) (*models.ManagementCredential, error) {
	query := `SELECT id, service_id, credential_type, username_encrypted, password_encrypted, 
		connection_params_encrypted, last_verified_at, status, created_at, updated_at 
		FROM management_credentials WHERE service_id = ?`

	row := DB.QueryRow(query, serviceID)

	var mc models.ManagementCredential
	var usernameB64, passwordB64, connParamsB64 sql.NullString
	var createdAtStr, updatedAtStr, lastVerified sql.NullString

	err := row.Scan(
		&mc.ID, &mc.ServiceID, &mc.CredentialType,
		&usernameB64, &passwordB64, &connParamsB64,
		&lastVerified, &mc.Status, &createdAtStr, &updatedAtStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Decrypt if encryptor is available
	if CredentialEncryptor != nil {
		if usernameB64.Valid {
			usernameBytes, err := CredentialEncryptor.DecryptBytes(usernameB64.String)
			if err != nil {
				log.Printf("Warning: Failed to decrypt username for service %s: %v", serviceID, err)
			} else {
				mc.UsernameEncrypted = usernameBytes
			}
		}

		if passwordB64.Valid {
			passwordBytes, err := CredentialEncryptor.DecryptBytes(passwordB64.String)
			if err != nil {
				log.Printf("Warning: Failed to decrypt password for service %s: %v", serviceID, err)
			} else {
				mc.PasswordEncrypted = passwordBytes
			}
		}

		if connParamsB64.Valid {
			connParamsBytes, err := CredentialEncryptor.DecryptBytes(connParamsB64.String)
			if err != nil {
				log.Printf("Warning: Failed to decrypt connection params for service %s: %v", serviceID, err)
			} else {
				mc.ConnectionParamsEncrypted = connParamsBytes
			}
		}
	}

	// Parse timestamps
	if createdAtStr.Valid {
		mc.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr.String)
	}
	if updatedAtStr.Valid {
		mc.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr.String)
	}
	if lastVerified.Valid {
		mc.LastVerifiedAt = lastVerified.String
	}

	// Mask username for UI
	if len(mc.UsernameEncrypted) >= 4 {
		mc.UsernameMasked = "****" + string(mc.UsernameEncrypted[len(mc.UsernameEncrypted)-4:])
	} else if len(mc.UsernameEncrypted) > 0 {
		mc.UsernameMasked = "****" + string(mc.UsernameEncrypted)
	} else {
		mc.UsernameMasked = "****"
	}

	return &mc, nil
}

// GetManagementCredentialsByServiceID retrieves all credentials for a service
func GetManagementCredentialsByServiceID(serviceID string) ([]models.ManagementCredential, error) {
	query := `SELECT id, service_id, credential_type, username_encrypted, password_encrypted, 
		connection_params_encrypted, last_verified_at, status, created_at, updated_at 
		FROM management_credentials WHERE service_id = ? ORDER BY created_at DESC`

	rows, err := DB.Query(query, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var credentials []models.ManagementCredential

	for rows.Next() {
		var mc models.ManagementCredential
		var usernameB64, passwordB64, connParamsB64 sql.NullString
		var createdAtStr, updatedAtStr, lastVerified sql.NullString

		err := rows.Scan(
			&mc.ID, &mc.ServiceID, &mc.CredentialType,
			&usernameB64, &passwordB64, &connParamsB64,
			&lastVerified, &mc.Status, &createdAtStr, &updatedAtStr,
		)
		if err != nil {
			return nil, err
		}

		// Decrypt if encryptor is available
		if CredentialEncryptor != nil {
			if usernameB64.Valid {
				usernameBytes, err := CredentialEncryptor.DecryptBytes(usernameB64.String)
				if err == nil {
					mc.UsernameEncrypted = usernameBytes
				}
			}
			if passwordB64.Valid {
				passwordBytes, err := CredentialEncryptor.DecryptBytes(passwordB64.String)
				if err == nil {
					mc.PasswordEncrypted = passwordBytes
				}
			}
			if connParamsB64.Valid {
				connParamsBytes, err := CredentialEncryptor.DecryptBytes(connParamsB64.String)
				if err == nil {
					mc.ConnectionParamsEncrypted = connParamsBytes
				}
			}
		}
		credentials = append(credentials, mc)
	}
	return credentials, nil
}

// GetManagementCredentialByID retrieves a single credential by ID
func GetManagementCredentialByID(id string) (*models.ManagementCredential, error) {
	query := `SELECT id, service_id, credential_type, username_encrypted, password_encrypted, 
		connection_params_encrypted, last_verified_at, status, created_at, updated_at 
		FROM management_credentials WHERE id = ?`

	row := DB.QueryRow(query, id)

	var mc models.ManagementCredential
	var usernameB64, passwordB64, connParamsB64 sql.NullString
	var createdAtStr, updatedAtStr, lastVerified sql.NullString

	err := row.Scan(
		&mc.ID, &mc.ServiceID, &mc.CredentialType,
		&usernameB64, &passwordB64, &connParamsB64,
		&lastVerified, &mc.Status, &createdAtStr, &updatedAtStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Decrypt if encryptor is available
	if CredentialEncryptor != nil {
		if usernameB64.Valid {
			usernameBytes, err := CredentialEncryptor.DecryptBytes(usernameB64.String)
			if err == nil {
				mc.UsernameEncrypted = usernameBytes
			}
		}
		if passwordB64.Valid {
			passwordBytes, err := CredentialEncryptor.DecryptBytes(passwordB64.String)
			if err == nil {
				mc.PasswordEncrypted = passwordBytes
			}
		}
		if connParamsB64.Valid {
			connParamsBytes, err := CredentialEncryptor.DecryptBytes(connParamsB64.String)
			if err == nil {
				mc.ConnectionParamsEncrypted = connParamsBytes
			}
		}
	}
	return &mc, nil
}

// UpdateManagementCredential updates and re-encrypts management credential
func UpdateManagementCredential(mc models.ManagementCredential) error {
	// First, fetch the existing credential to prevent overwriting missing fields
	existing, err := GetManagementCredentialByID(mc.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("credential not found")
	}

	// Merge fields. If mc string is empty, keep existing (already decrypted)
	if len(mc.UsernameEncrypted) == 0 {
		mc.UsernameEncrypted = existing.UsernameEncrypted
	}
	if len(mc.PasswordEncrypted) == 0 {
		mc.PasswordEncrypted = existing.PasswordEncrypted
	}
	if len(mc.ConnectionParamsEncrypted) == 0 {
		mc.ConnectionParamsEncrypted = existing.ConnectionParamsEncrypted
	}
	if mc.Status == "" {
		mc.Status = existing.Status
	}
	if mc.CredentialType == "" {
		mc.CredentialType = existing.CredentialType
	}

	// Encrypt sensitive fields
	var usernameEncrypted, passwordEncrypted, connParamsEncrypted []byte

	if CredentialEncryptor != nil {
		if len(mc.UsernameEncrypted) > 0 {
			usernameB64, err := CredentialEncryptor.EncryptBytes(mc.UsernameEncrypted)
			if err != nil {
				return err
			}
			usernameEncrypted = []byte(usernameB64)
		}

		if len(mc.PasswordEncrypted) > 0 {
			passwordB64, err := CredentialEncryptor.EncryptBytes(mc.PasswordEncrypted)
			if err != nil {
				return err
			}
			passwordEncrypted = []byte(passwordB64)
		}

		if len(mc.ConnectionParamsEncrypted) > 0 {
			connParamsB64, err := CredentialEncryptor.EncryptBytes(mc.ConnectionParamsEncrypted)
			if err != nil {
				return err
			}
			connParamsEncrypted = []byte(connParamsB64)
		}
	} else {
		usernameEncrypted = mc.UsernameEncrypted
		passwordEncrypted = mc.PasswordEncrypted
		connParamsEncrypted = mc.ConnectionParamsEncrypted
	}

	query := `UPDATE management_credentials SET 
		credential_type = ?, username_encrypted = ?, password_encrypted = ?, connection_params_encrypted = ?, 
		last_verified_at = ?, status = ?, updated_at = ? 
	WHERE id = ?`

	_, err = DB.Exec(query,
		mc.CredentialType, usernameEncrypted, passwordEncrypted, connParamsEncrypted,
		mc.LastVerifiedAt, mc.Status, time.Now().UTC().Format(time.RFC3339), mc.ID,
	)

	if err == nil {
		log.Printf("Updated management credential %s", mc.ID)
	}

	return err
}

// DeleteManagementCredential deletes a management credential
func DeleteManagementCredential(id string) error {
	query := `DELETE FROM management_credentials WHERE id = ?`
	_, err := DB.Exec(query, id)
	if err == nil {
		log.Printf("Deleted management credential %s", id)
	}
	return err
}

// VerifyManagementCredential marks a credential as verified
func VerifyManagementCredential(id string) error {
	query := `UPDATE management_credentials SET last_verified_at = ?, status = ? WHERE id = ?`
	_, err := DB.Exec(query, time.Now().UTC().Format(time.RFC3339), "active", id)
	return err
}

// GetManagementCredentialsByStatus retrieves credentials by status
func GetManagementCredentialsByStatus(status string) ([]models.ManagementCredential, error) {
	query := `SELECT id, service_id, credential_type, username_encrypted, password_encrypted, 
		connection_params_encrypted, last_verified_at, status, created_at, updated_at 
		FROM management_credentials WHERE status = ? ORDER BY service_id`

	rows, err := DB.Query(query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var credentials []models.ManagementCredential
	for rows.Next() {
		var mc models.ManagementCredential
		var usernameB64, passwordB64, connParamsB64 sql.NullString
		var createdAtStr, updatedAtStr, lastVerified sql.NullString

		err := rows.Scan(
			&mc.ID, &mc.ServiceID, &mc.CredentialType,
			&usernameB64, &passwordB64, &connParamsB64,
			&lastVerified, &mc.Status, &createdAtStr, &updatedAtStr,
		)
		if err != nil {
			return nil, err
		}

		if CredentialEncryptor != nil && usernameB64.Valid {
			if usernameBytes, err := CredentialEncryptor.DecryptBytes(usernameB64.String); err == nil {
				mc.UsernameEncrypted = usernameBytes
			}
		}

		// Mask username for UI
		if len(mc.UsernameEncrypted) >= 4 {
			mc.UsernameMasked = "****" + string(mc.UsernameEncrypted[len(mc.UsernameEncrypted)-4:])
		} else if len(mc.UsernameEncrypted) > 0 {
			mc.UsernameMasked = "****" + string(mc.UsernameEncrypted)
		} else {
			mc.UsernameMasked = "****"
		}

		if createdAtStr.Valid {
			mc.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr.String)
		}
		if updatedAtStr.Valid {
			mc.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr.String)
		}
		if lastVerified.Valid {
			mc.LastVerifiedAt = lastVerified.String
		}

		credentials = append(credentials, mc)
	}

	return credentials, nil
}

// GetAllManagementCredentials retrieves all management credentials (masked)
func GetAllManagementCredentials() ([]models.ManagementCredential, error) {
	query := `SELECT id, service_id, credential_type, username_encrypted, last_verified_at, status, created_at, updated_at 
		FROM management_credentials ORDER BY service_id, credential_type`

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var credentials []models.ManagementCredential
	for rows.Next() {
		var mc models.ManagementCredential
		var lastVerified, createdAtStr, updatedAtStr, usernameB64 sql.NullString

		err := rows.Scan(
			&mc.ID, &mc.ServiceID, &mc.CredentialType, &usernameB64,
			&lastVerified, &mc.Status, &createdAtStr, &updatedAtStr,
		)
		if err != nil {
			return nil, err
		}

		if CredentialEncryptor != nil && usernameB64.Valid {
			if usernameBytes, err := CredentialEncryptor.DecryptBytes(usernameB64.String); err == nil {
				mc.UsernameEncrypted = usernameBytes
			}
		}

		if len(mc.UsernameEncrypted) >= 4 {
			mc.UsernameMasked = "****" + string(mc.UsernameEncrypted[len(mc.UsernameEncrypted)-4:])
		} else if len(mc.UsernameEncrypted) > 0 {
			mc.UsernameMasked = "****" + string(mc.UsernameEncrypted)
		} else {
			mc.UsernameMasked = "****"
		}

		if createdAtStr.Valid {
			mc.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr.String)
		}
		if updatedAtStr.Valid {
			mc.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr.String)
		}
		if lastVerified.Valid {
			mc.LastVerifiedAt = lastVerified.String
		}

		credentials = append(credentials, mc)
	}

	return credentials, nil
}
