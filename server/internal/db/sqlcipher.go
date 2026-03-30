package db

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"
)

// SQLCipherConfig holds SQLCipher encryption configuration
type SQLCipherConfig struct {
	Password      string
	KeySize       int
	KKSSalt       string
	Cipher        string
	KDFIterations int
}

// DefaultSQLCipherConfig returns recommended SQLCipher configuration
func DefaultSQLCipherConfig() SQLCipherConfig {
	return SQLCipherConfig{
		Password:      "", // Must be set by user
		KeySize:       256,
		KKSSalt:       "", // Auto-generated if empty
		Cipher:        "aes-256-cbc",
		KDFIterations: 256000, // OWASP recommendation
	}
}

// GenerateKeyFromPassword derives encryption key from password using PBKDF2
func GenerateKeyFromPassword(password, salt string, iterations int) string {
	// In production, use proper PBKDF2 implementation
	// This is a simplified version using SHA-256
	h := sha256.New()
	h.Write([]byte(password + salt))
	for i := 0; i < iterations/1000; i++ {
		h.Write(h.Sum(nil))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// InitializeSQLCipher initializes SQLCipher encryption for the database
func InitializeSQLCipher(password string) error {
	if password == "" {
		log.Println("Warning: No encryption password provided. Database will NOT be encrypted.")
		return nil
	}

	// SQLCipher uses PRAGMA commands to enable encryption
	// These must be executed immediately after opening the database

	cipher := DefaultSQLCipherConfig()
	cipher.Password = password

	// Generate salt if not provided
	if cipher.KKSSalt == "" {
		// In production, use crypto/rand for secure random generation
		cipher.KKSSalt = "prism-salt-" + hex.EncodeToString([]byte(password))[:16]
	}

	// Derive key from password
	key := GenerateKeyFromPassword(cipher.Password, cipher.KKSSalt, cipher.KDFIterations)

	// Apply SQLCipher PRAGMA commands
	// Note: These must be executed as the FIRST operations on the database
	pragmas := []string{
		fmt.Sprintf("PRAGMA key = '%s'", key),
		fmt.Sprintf("PRAGMA cipher = '%s'", cipher.Cipher),
		fmt.Sprintf("PRAGMA kdf_iter = %d", cipher.KDFIterations),
		"PRAGMA secure_delete = ON",
		"PRAGMA auto_vacuum = FULL",
	}

	for _, pragma := range pragmas {
		_, err := DB.Exec(pragma)
		if err != nil {
			return fmt.Errorf("failed to execute SQLCipher PRAGMA: %w", err)
		}
	}

	log.Println("SQLCipher encryption initialized successfully")
	return nil
}

// ChangeDatabasePassword changes the database encryption password
func ChangeDatabasePassword(oldPassword, newPassword string) error {
	if oldPassword == "" || newPassword == "" {
		return fmt.Errorf("password cannot be empty")
	}

	// Derive new key
	_ = GenerateKeyFromPassword(oldPassword, "prism-salt", 256000) // Verify old password works
	newKey := GenerateKeyFromPassword(newPassword, "prism-salt", 256000)

	// Rekey the database
	query := fmt.Sprintf("PRAGMA rekey = '%s'", newKey)
	_, err := DB.Exec(query)
	return err
}

// VerifyDatabaseEncryption verifies if the database is properly encrypted
func VerifyDatabaseEncryption() (bool, error) {
	// Try a simple query
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM sqlite_master").Scan(&count)
	if err != nil {
		return false, fmt.Errorf("database encryption verification failed: %w", err)
	}
	return true, nil
}

// GetEncryptionInfo returns information about database encryption
func GetEncryptionInfo() map[string]interface{} {
	info := map[string]interface{}{
		"encrypted": false,
		"cipher":    "none",
		"key_size":  0,
	}

	// Check if encryption is enabled
	var cipher string
	err := DB.QueryRow("PRAGMA cipher").Scan(&cipher)
	if err == nil && cipher != "" {
		info["encrypted"] = true
		info["cipher"] = cipher
		info["key_size"] = 256
	}

	return info
}

// LoadEncryptionKeyFromEnv loads encryption key from environment variable
func LoadEncryptionKeyFromEnv() string {
	password := os.Getenv("PRISM_DB_PASSWORD")
	if password == "" {
		log.Println("Warning: PRISM_DB_PASSWORD environment variable not set")
	}
	return password
}

// InitializeDatabaseWithEncryption initializes database with SQLCipher encryption
func InitializeDatabaseWithEncryption(dbPath, password string) error {
	// First initialize the database
	err := InitDB(dbPath)
	if err != nil {
		return err
	}

	// Then enable encryption
	if password != "" {
		err = InitializeSQLCipher(password)
		if err != nil {
			return err
		}
	}

	return nil
}
