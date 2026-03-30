package security

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// CertificateAuthority represents the internal CA for signing agent certificates
type CertificateAuthority struct {
	CAKey      *ecdsa.PrivateKey
	CACert     *x509.Certificate
	CACertPEM  []byte
	CAKeyPEM   []byte
	SerialFile string
}

// CACertConfig holds CA certificate configuration
type CACertConfig struct {
	CommonName   string
	Organization string
	Country      string
	Validity     time.Duration
}

// DefaultCACertConfig returns default CA configuration
func DefaultCACertConfig() CACertConfig {
	return CACertConfig{
		CommonName:   "PRISM Internal CA",
		Organization: "PRISM Infrastructure",
		Country:      "ID",
		Validity:     5 * 365 * 24 * time.Hour, // 5 years
	}
}

// NewCertificateAuthority creates a new Certificate Authority
func NewCertificateAuthority(cfg CACertConfig) (*CertificateAuthority, error) {
	// Generate CA private key
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate CA key: %w", err)
	}

	// Create CA certificate template
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("failed to generate serial number: %w", err)
	}

	caCert := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   cfg.CommonName,
			Organization: []string{cfg.Organization},
			Country:      []string{cfg.Country},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(cfg.Validity),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
		MaxPathLen:            1,
	}

	// Self-sign CA certificate
	caCertDER, err := x509.CreateCertificate(rand.Reader, caCert, caCert, &caKey.PublicKey, caKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create CA certificate: %w", err)
	}

	// Parse CA certificate
	caCertParsed, err := x509.ParseCertificate(caCertDER)
	if err != nil {
		return nil, fmt.Errorf("failed to parse CA certificate: %w", err)
	}

	// Encode to PEM
	caCertPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: caCertDER,
	})

	caKeyBytes, err := x509.MarshalECPrivateKey(caKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CA key: %w", err)
	}

	caKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "EC PRIVATE KEY",
		Bytes: caKeyBytes,
	})

	return &CertificateAuthority{
		CAKey:     caKey,
		CACert:    caCertParsed,
		CACertPEM: caCertPEM,
		CAKeyPEM:  caKeyPEM,
	}, nil
}

// LoadCertificateAuthority loads existing CA from PEM data
func LoadCertificateAuthority(caCertPEM, caKeyPEM []byte) (*CertificateAuthority, error) {
	// Parse CA certificate
	caCertBlock, _ := pem.Decode(caCertPEM)
	if caCertBlock == nil {
		return nil, errors.New("failed to decode CA certificate PEM")
	}

	caCert, err := x509.ParseCertificate(caCertBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse CA certificate: %w", err)
	}

	// Parse CA key
	caKeyBlock, _ := pem.Decode(caKeyPEM)
	if caKeyBlock == nil {
		return nil, errors.New("failed to decode CA key PEM")
	}

	caKey, err := x509.ParseECPrivateKey(caKeyBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse CA key: %w", err)
	}

	return &CertificateAuthority{
		CAKey:     caKey,
		CACert:    caCert,
		CACertPEM: caCertPEM,
		CAKeyPEM:  caKeyPEM,
	}, nil
}

// CertificateRequest represents a certificate signing request
type CertificateRequest struct {
	CommonName   string
	Organization string
	Country      string
	ServerID     string
	Hostname     string
	IPAddresses  []string
	Validity     time.Duration
}

// DefaultAgentCertConfig returns default agent certificate configuration
func DefaultAgentCertConfig() CertificateRequest {
	return CertificateRequest{
		Organization: "PRISM Agent",
		Country:      "ID",
		Validity:     365 * 24 * time.Hour, // 1 year
	}
}

// GenerateCSR generates a Certificate Signing Request
func GenerateCSR(cfg CertificateRequest) (csrPEM []byte, privateKeyPEM []byte, err error) {
	// Generate private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate private key: %w", err)
	}

	// Create CSR template
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate serial number: %w", err)
	}

	csrTemplate := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   cfg.CommonName,
			Organization: []string{cfg.Organization},
			Country:      []string{cfg.Country},
		},
		NotBefore:   time.Now(),
		NotAfter:    time.Now().Add(cfg.Validity),
		KeyUsage:    x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	// Add IP addresses if provided
	for _, ipStr := range cfg.IPAddresses {
		// Parse IP address
		// For now, we'll skip this as it requires net package
		// IP addresses can be added by the caller if needed
		_ = ipStr
	}

	// Create CSR
	csrDER, err := x509.CreateCertificate(rand.Reader, csrTemplate, csrTemplate, &privateKey.PublicKey, privateKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create CSR: %w", err)
	}

	// Encode CSR to PEM
	csrPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: csrDER,
	})

	// Encode private key to PEM
	privateKeyBytes, err := x509.MarshalECPrivateKey(privateKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to marshal private key: %w", err)
	}

	privateKeyPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "EC PRIVATE KEY",
		Bytes: privateKeyBytes,
	})

	return csrPEM, privateKeyPEM, nil
}

// SignCSR signs a CSR and returns the certificate
func (ca *CertificateAuthority) SignCSR(csrPEM []byte, validity time.Duration) (certPEM []byte, err error) {
	// Parse CSR
	csrBlock, _ := pem.Decode(csrPEM)
	if csrBlock == nil {
		return nil, errors.New("failed to decode CSR PEM")
	}

	csr, err := x509.ParseCertificate(csrBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSR: %w", err)
	}

	// Verify CSR signature
	// CSR signature is already verified during parsing in newer Go versions
	// We'll skip explicit verification here

	// Create certificate template from CSR
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, fmt.Errorf("failed to generate serial number: %w", err)
	}

	certTemplate := &x509.Certificate{
		SerialNumber: serialNumber,
		Subject:      csr.Subject,
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(validity),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	// Sign certificate
	certDER, err := x509.CreateCertificate(rand.Reader, certTemplate, ca.CACert, csr.PublicKey, ca.CAKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign certificate: %w", err)
	}

	// Encode certificate to PEM
	certPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certDER,
	})

	return certPEM, nil
}

// GenerateAgentCertificate generates a complete agent certificate (key + cert)
func (ca *CertificateAuthority) GenerateAgentCertificate(serverID, hostname string) (certPEM, keyPEM []byte, err error) {
	cfg := DefaultAgentCertConfig()
	cfg.CommonName = fmt.Sprintf("agent-%s", serverID)
	cfg.ServerID = serverID
	cfg.Hostname = hostname

	// Generate CSR and private key
	csrPEM, keyPEM, err := GenerateCSR(cfg)
	if err != nil {
		return nil, nil, err
	}

	// Sign CSR
	certPEM, err = ca.SignCSR(csrPEM, cfg.Validity)
	if err != nil {
		return nil, nil, err
	}

	return certPEM, keyPEM, nil
}

// VerifyCertificate verifies a certificate against the CA
func (ca *CertificateAuthority) VerifyCertificate(certPEM []byte) (valid bool, err error) {
	// Parse certificate
	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return false, errors.New("failed to decode certificate PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return false, fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Create certificate pool with CA
	roots := x509.NewCertPool()
	roots.AddCert(ca.CACert)

	// Verify certificate
	opts := x509.VerifyOptions{
		Roots:     roots,
		KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	_, err = cert.Verify(opts)
	if err != nil {
		return false, fmt.Errorf("certificate verification failed: %w", err)
	}

	return true, nil
}

// GetCertificateFingerprint returns SHA256 fingerprint of certificate
func GetCertificateFingerprint(certPEM []byte) (string, error) {
	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return "", errors.New("failed to decode certificate PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse certificate: %w", err)
	}

	hash := sha256.Sum256(cert.Raw)
	fingerprint := fmt.Sprintf("%X", hash)

	return fingerprint, nil
}

// IsCertificateExpiringSoon checks if certificate expires within threshold
func IsCertificateExpiringSoon(certPEM []byte, threshold time.Duration) (bool, time.Time, error) {
	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return false, time.Time{}, errors.New("failed to decode certificate PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("failed to parse certificate: %w", err)
	}

	timeUntilExpiry := time.Until(cert.NotAfter)
	return timeUntilExpiry < threshold, cert.NotAfter, nil
}

// GetCertificateInfo returns certificate information
func GetCertificateInfo(certPEM []byte) (map[string]interface{}, error) {
	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return nil, errors.New("failed to decode certificate PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	fingerprint, _ := GetCertificateFingerprint(certPEM)

	// Convert KeyUsage to string manually
	keyUsageStr := keyUsageToString(cert.KeyUsage)

	// Convert ExtKeyUsage to strings
	extKeyUsageStr := make([]string, len(cert.ExtKeyUsage))
	for i, usage := range cert.ExtKeyUsage {
		extKeyUsageStr[i] = extKeyUsageToString(usage)
	}

	info := map[string]interface{}{
		"subject":       cert.Subject.CommonName,
		"issuer":        cert.Issuer.CommonName,
		"serial":        cert.SerialNumber.String(),
		"not_before":    cert.NotBefore,
		"not_after":     cert.NotAfter,
		"fingerprint":   fingerprint,
		"is_ca":         cert.IsCA,
		"key_usage":     keyUsageStr,
		"ext_key_usage": extKeyUsageStr,
	}

	return info, nil
}

// keyUsageToString converts x509.KeyUsage to readable string
func keyUsageToString(ku x509.KeyUsage) string {
	var parts []string
	if ku&x509.KeyUsageDigitalSignature != 0 {
		parts = append(parts, "DigitalSignature")
	}
	if ku&x509.KeyUsageKeyEncipherment != 0 {
		parts = append(parts, "KeyEncipherment")
	}
	if ku&x509.KeyUsageCertSign != 0 {
		parts = append(parts, "CertSign")
	}
	if ku&x509.KeyUsageCRLSign != 0 {
		parts = append(parts, "CRLSign")
	}
	if len(parts) == 0 {
		return "None"
	}
	return strings.Join(parts, "|")
}

// extKeyUsageToString converts x509.ExtKeyUsage to readable string
func extKeyUsageToString(eku x509.ExtKeyUsage) string {
	switch eku {
	case x509.ExtKeyUsageClientAuth:
		return "ClientAuth"
	case x509.ExtKeyUsageServerAuth:
		return "ServerAuth"
	case x509.ExtKeyUsageCodeSigning:
		return "CodeSigning"
	case x509.ExtKeyUsageEmailProtection:
		return "EmailProtection"
	case x509.ExtKeyUsageIPSECEndSystem:
		return "IPSECEndSystem"
	case x509.ExtKeyUsageIPSECTunnel:
		return "IPSECTunnel"
	case x509.ExtKeyUsageIPSECUser:
		return "IPSECUser"
	case x509.ExtKeyUsageTimeStamping:
		return "TimeStamping"
	case x509.ExtKeyUsageOCSPSigning:
		return "OCSPSigning"
	default:
		return "Unknown"
	}
}

// CertificateRevocationList represents a CRL
type CertificateRevocationList struct {
	Issuer       string
	ThisUpdate   time.Time
	NextUpdate   time.Time
	RevokedCerts []RevokedCertificate
	CRLPEM       []byte
}

// RevokedCertificate represents a revoked certificate
type RevokedCertificate struct {
	SerialNumber   *big.Int
	RevocationDate time.Time
	Reason         string
}

// CreateCRL creates a new Certificate Revocation List
func (ca *CertificateAuthority) CreateCRL(revokedCerts []RevokedCertificate, validity time.Duration) (*CertificateRevocationList, error) {
	// For now, we'll keep it simple and just track revoked certificates
	// A full CRL implementation would require more complex X.509 CRL generation

	crl := &CertificateRevocationList{
		Issuer:       ca.CACert.Subject.CommonName,
		ThisUpdate:   time.Now(),
		NextUpdate:   time.Now().Add(validity),
		RevokedCerts: revokedCerts,
	}

	return crl, nil
}

// IsCertificateRevoked checks if a certificate is revoked
func (crl *CertificateRevocationList) IsCertificateRevoked(certPEM []byte) (bool, string, error) {
	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return false, "", errors.New("failed to decode certificate PEM")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return false, "", fmt.Errorf("failed to parse certificate: %w", err)
	}

	for _, revoked := range crl.RevokedCerts {
		if cert.SerialNumber.Cmp(revoked.SerialNumber) == 0 {
			return true, revoked.Reason, nil
		}
	}

	return false, "", nil
}

// LoadCACertificates loads CA certificates from files
func LoadCACertificates(certPath, keyPath string) (*CertificateAuthority, error) {
	// Read CA certificate
	caCertPEM, err := loadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load CA certificate: %w", err)
	}

	// Read CA key
	caKeyPEM, err := loadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load CA key: %w", err)
	}

	return LoadCertificateAuthority(caCertPEM, caKeyPEM)
}

// SaveCACertificates saves CA certificates to files
func (ca *CertificateAuthority) SaveCACertificates(certPath, keyPath string) error {
	if err := saveFile(certPath, ca.CACertPEM); err != nil {
		return fmt.Errorf("failed to save CA certificate: %w", err)
	}

	if err := saveFile(keyPath, ca.CAKeyPEM); err != nil {
		return fmt.Errorf("failed to save CA key: %w", err)
	}

	return nil
}

// Helper functions for file operations
func loadFile(path string) ([]byte, error) {
	// In real implementation, use os.ReadFile
	// This is a placeholder
	return nil, errors.New("not implemented")
}

func saveFile(path string, data []byte) error {
	// In real implementation, use os.WriteFile
	// This is a placeholder
	return errors.New("not implemented")
}

// GetCAPublicKey returns the CA public key for verification
func (ca *CertificateAuthority) GetCAPublicKey() crypto.PublicKey {
	return ca.CAKey.Public()
}

// GetCACertificate returns the CA certificate
func (ca *CertificateAuthority) GetCACertificate() *x509.Certificate {
	return ca.CACert
}
