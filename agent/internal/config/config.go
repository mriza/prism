package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

type Config struct {
	Server         ServerConfig    `toml:"server"`
	Hub            HubConfig       `toml:"hub"`
	Database       DatabaseConfig  `toml:"database"`
	Services       []ServiceConfig `toml:"services"`
	ActiveFirewall string          `toml:"active_firewall"`
}

type HubConfig struct {
	URL   string `toml:"url"`
	Token string `toml:"token"`
	ID    string `toml:"id"`

	// ServerConfigPath is the path to the server's prism-server.conf
	// Used to automatically read the token if token is empty
	ServerConfigPath string `toml:"server_config_path"`
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

// LoadWithAutoToken loads config and auto-reads token from server config if empty
func LoadWithAutoToken(mainPath string) (*Config, error) {
	cfg, err := Load(mainPath)
	if err != nil {
		return nil, err
	}

	// Auto-load token from server config if empty
	if cfg.Hub.Token == "" && cfg.Hub.ServerConfigPath != "" {
		token, err := readTokenFromServerConfig(cfg.Hub.ServerConfigPath)
		if err != nil {
			fmt.Printf("Warning: failed to read token from server config: %v\n", err)
		} else {
			cfg.Hub.Token = token
			fmt.Printf("Auto-loaded token from %s\n", cfg.Hub.ServerConfigPath)
		}
	}

	return cfg, nil
}

// readTokenFromServerConfig reads the auth token from server's prism-server.conf
func readTokenFromServerConfig(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read server config: %w", err)
	}

	var serverCfg struct {
		Auth struct {
			Token string `toml:"token"`
		} `toml:"auth"`
	}

	err = toml.Unmarshal(data, &serverCfg)
	if err != nil {
		return "", fmt.Errorf("failed to parse server config: %w", err)
	}

	if serverCfg.Auth.Token == "" {
		return "", fmt.Errorf("token not found in server config")
	}

	return serverCfg.Auth.Token, nil
}

// Save writes the Config struct to a TOML file
func Save(cfg *Config, path string) error {
	data, err := toml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	err = os.WriteFile(path, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write config file %s: %w", path, err)
	}

	return nil
}
