package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

type Config struct {
	Server   ServerConfig    `toml:"server"`
	Auth     AuthConfig      `toml:"auth"`
	Database DatabaseConfig  `toml:"database"`
	Services []ServiceConfig `toml:"services"`
}

type AuthConfig struct {
	Token string `toml:"token"`
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
