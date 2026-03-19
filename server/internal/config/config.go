package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"prism-server/internal/security"
)

type Config struct {
	Server   ServerConfig    `toml:"server"`
	Auth     AuthConfig      `toml:"auth"`
	Database DatabaseConfig  `toml:"database"`
	Valkey   ValkeyConfig    `toml:"valkey"`
	Services []ServiceConfig `toml:"services"`
}

type ValkeyConfig struct {
	Addr     string `toml:"addr"`
	Password string `toml:"password"`
	DB       int    `toml:"db"`
}

type AuthConfig struct {
	Token     string `toml:"token"`
	JwtSecret string `toml:"jwt_secret"`
}

type ServerConfig struct {
	Host       string `toml:"host"`
	Port       int    `toml:"port"`
	Domain     string `toml:"domain"`
	TLSEnabled bool   `toml:"tls_enabled"`
	TLSCert    string `toml:"tls_cert"`
	TLSKey     string `toml:"tls_key"`
}

type DatabaseConfig struct {
	Path string `toml:"path"`
}

type ServiceConfig struct {
	Name        string `toml:"name"`
	Type        string `toml:"type"`
	ServiceName string `toml:"service_name"`
	UserScope   bool   `toml:"user_scope"`
}

// Validate checks if the configuration is valid and generates missing secrets
func (c *Config) Validate(configPath string) error {
	var needsSave bool

	// Validate and generate JWT secret if missing or default
	if c.Auth.JwtSecret == "" || c.Auth.JwtSecret == "PRISM_SUPER_SECRET_KEY_CHANGE_ME_IN_PROD" {
		log.Println("Generating secure JWT secret...")
		secret, err := security.GenerateJWTSecret()
		if err != nil {
			return fmt.Errorf("failed to generate JWT secret: %w", err)
		}
		c.Auth.JwtSecret = secret
		needsSave = true
	}

	// Validate and generate auth token if missing
	if c.Auth.Token == "" || c.Auth.Token == "prism-secure-token-2026" {
		log.Println("Generating secure auth token...")
		token, err := security.GenerateSecureToken(32)
		if err != nil {
			return fmt.Errorf("failed to generate auth token: %w", err)
		}
		c.Auth.Token = token
		needsSave = true
	}

	// Validate server port
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		c.Server.Port = 65432
	}

	// Validate server host
	if c.Server.Host == "" {
		c.Server.Host = "0.0.0.0"
	}

	// Validate database path
	if c.Database.Path == "" {
		c.Database.Path = "./prism.db"
	}

	// Save config if we generated new secrets
	if needsSave {
		if err := Save(c, configPath); err != nil {
			log.Printf("Warning: failed to save updated config: %v", err)
		} else {
			log.Println("Configuration updated with secure defaults")
		}
	}

	return nil
}

func Load(mainPath string) (*Config, error) {
	// 1. Load Main Config
	data, err := os.ReadFile(mainPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read main config %s: %w", mainPath, err)
	}

	var cfg Config
	err = toml.Unmarshal(data, &cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to parse main config %s: %w", mainPath, err)
	}

	// 2. Scan conf.d directory
	confDir := filepath.Join(filepath.Dir(mainPath), "conf.d")
	entries, err := os.ReadDir(confDir)
	if err != nil {
		// It's okay if conf.d doesn't exist, just return what we have
		if os.IsNotExist(err) {
			return &cfg, nil
		}
		return nil, fmt.Errorf("failed to read conf.d directory: %w", err)
	}

	// 3. Load each .conf file in conf.d
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !strings.HasSuffix(entry.Name(), ".conf") && !strings.HasSuffix(entry.Name(), ".toml") {
			continue
		}

		fullPath := filepath.Join(confDir, entry.Name())
		subData, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read sub-config %s: %w", fullPath, err)
		}

		var subCfg Config
		err = toml.Unmarshal(subData, &subCfg)
		if err != nil {
			return nil, fmt.Errorf("failed to parse sub-config %s: %w", fullPath, err)
		}

		// Merge Services
		cfg.Services = append(cfg.Services, subCfg.Services...)
	}

	return &cfg, nil
}

// Save saves the configuration to a file
func Save(cfg *Config, path string) error {
	data, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Write with secure permissions (owner read/write only)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}
