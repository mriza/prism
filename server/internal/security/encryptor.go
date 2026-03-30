package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// EncryptionKeySize for AES-256-GCM
const EncryptionKeySize = 32 // 256 bits

// Encryptor handles AES-256-GCM encryption/decryption
type Encryptor struct {
	key []byte
}

// NewEncryptor creates a new encryptor with the given key
// Key must be 32 bytes for AES-256
func NewEncryptor(key []byte) (*Encryptor, error) {
	if len(key) != EncryptionKeySize {
		return nil, errors.New("encryption key must be 32 bytes (256 bits)")
	}
	return &Encryptor{key: key}, nil
}

// GenerateKey generates a new 256-bit encryption key
func GenerateKey() ([]byte, error) {
	key := make([]byte, EncryptionKeySize)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	return key, nil
}

// GenerateKeyBase64 generates a new key and returns it as base64 string
func GenerateKeyBase64() (string, error) {
	key, err := GenerateKey()
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(key), nil
}

// DecodeKey decodes a base64-encoded encryption key
func DecodeKey(keyBase64 string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(keyBase64)
	if err != nil {
		return nil, err
	}
	if len(key) != EncryptionKeySize {
		return nil, errors.New("encryption key must be 32 bytes (256 bits)")
	}
	return key, nil
}

// Encrypt encrypts plaintext using AES-256-GCM
// Returns base64-encoded ciphertext (nonce + encrypted data)
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// EncryptBytes encrypts byte slice using AES-256-GCM
// Returns base64-encoded ciphertext (nonce + encrypted data)
func (e *Encryptor) EncryptBytes(plaintext []byte) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64-encoded ciphertext using AES-256-GCM
func (e *Encryptor) Decrypt(ciphertextBase64 string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// DecryptBytes decrypts base64-encoded ciphertext to byte slice
func (e *Encryptor) DecryptBytes(ciphertextBase64 string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// MaskString masks a string showing only first and last N characters
func MaskString(s string, showChars int) string {
	if len(s) <= showChars*2 {
		return "****"
	}
	return s[:showChars] + "****" + s[len(s)-showChars:]
}

// MaskUsername masks username showing only last 4 characters
func MaskUsername(username string) string {
	if len(username) <= 4 {
		return "****"
	}
	return "****" + username[len(username)-4:]
}
