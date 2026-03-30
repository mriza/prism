package modules

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"prism-agent/internal/core"
)

type MinIOModule struct {
	*SystemdModule
	Alias string
}

func NewMinIOModule() *MinIOModule {
	return &MinIOModule{
		SystemdModule: NewSystemdModule("minio", "minio", false),
		Alias:         "local", // Default alias
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*MinIOModule)(nil)
var _ core.StorageModule = (*MinIOModule)(nil)
var _ core.ServiceSettings = (*MinIOModule)(nil)

func (m *MinIOModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("mc", "--version").Output()
	if err == nil {
		facts["cli_version"] = strings.TrimSpace(string(out))
	}
	// Try to get server info?
	// exec.Command("mc", "admin", "info", m.Alias, "--json")
	return facts, nil
}

// --- StorageModule Implementation ---

func (m *MinIOModule) ListBuckets() ([]string, error) {
	// mc ls local/ --json
	out, err := exec.Command("mc", "ls", m.Alias+"/", "--json").Output()
	if err != nil {
		return nil, err
	}

	var buckets []string
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var entry struct {
			Key  string `json:"key"`
			Type string `json:"type"` // "folder" for buckets usually in ls root
		}
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			if entry.Type == "folder" {
				name := strings.TrimSuffix(entry.Key, "/")
				buckets = append(buckets, name)
			}
		}
	}
	return buckets, nil
}

func (m *MinIOModule) CreateBucket(name string) error {
	// Check if already exists
	check := exec.Command("mc", "ls", m.Alias+"/"+name)
	if err := check.Run(); err == nil {
		return nil // Already exists
	}
	return exec.Command("mc", "mb", m.Alias+"/"+name).Run()
}

func (m *MinIOModule) DeleteBucket(name string) error {
	return exec.Command("mc", "rb", m.Alias+"/"+name).Run()
}

func (m *MinIOModule) ListUsers() ([]core.StorageUser, error) {
	// mc admin user list local/ --json
	out, err := exec.Command("mc", "admin", "user", "list", m.Alias, "--json").Output()
	if err != nil {
		return nil, err
	}

	var users []core.StorageUser
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var entry struct {
			AccessKey string `json:"accessKey"`
			Status    string `json:"userStatus"`
		}
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			users = append(users, core.StorageUser{
				AccessKey: entry.AccessKey,
				// SecretKey is hidden
			})
		}
	}
	return users, nil
}

func (m *MinIOModule) CreateUser(accessKey, secretKey string) (core.StorageUser, error) {
	if secretKey == "" {
		// Generate a secure 32-character base64 secret key
		bytes := make([]byte, 24)
		if _, err := rand.Read(bytes); err != nil {
			return core.StorageUser{}, fmt.Errorf("failed to generate secure secret key: %w", err)
		}
		secretKey = base64.RawURLEncoding.EncodeToString(bytes)
	}

	cmd := exec.Command("mc", "admin", "user", "add", m.Alias, accessKey, secretKey)
	if err := cmd.Run(); err != nil {
		return core.StorageUser{}, err
	}

	return core.StorageUser{AccessKey: accessKey, SecretKey: secretKey}, nil
}

func (m *MinIOModule) DeleteUser(accessKey string) error {
	return exec.Command("mc", "admin", "user", "remove", m.Alias, accessKey).Run()
}

// --- ServiceSettings Implementation ---

func (m *MinIOModule) GetSettings() (map[string]interface{}, error) {
	settings := map[string]interface{}{
		"endpoint": "http://localhost:9000",
	}

	// Try mc alias ls (newer mc) then mc config host list (older mc)
	for _, args := range [][]string{
		{"alias", "ls", m.Alias, "--json"},
		{"config", "host", "list", m.Alias, "--json"},
	} {
		out, err := exec.Command("mc", args...).Output()
		if err != nil {
			continue
		}
		// mc may return one JSON object or a JSON array
		raw := strings.TrimSpace(string(out))
		// Try single object
		var entry struct {
			URL       string `json:"url"`
			AccessKey string `json:"accessKey"`
			Alias     string `json:"alias"`
		}
		if err := json.Unmarshal([]byte(raw), &entry); err == nil && entry.URL != "" {
			settings["endpoint"] = entry.URL
			if entry.AccessKey != "" {
				settings["access_key"] = entry.AccessKey
			}
			return settings, nil
		}
		// Try NDJSON (one JSON per line)
		for _, line := range strings.Split(raw, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if err := json.Unmarshal([]byte(line), &entry); err == nil && entry.URL != "" {
				settings["endpoint"] = entry.URL
				if entry.AccessKey != "" {
					settings["access_key"] = entry.AccessKey
				}
				return settings, nil
			}
		}
		break
	}

	// Fallback: read from MinIO environment file
	for _, envFile := range []string{"/etc/default/minio", "/etc/minio/config.env", "/opt/minio/config.env"} {
		data, err := os.ReadFile(envFile)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "MINIO_ROOT_USER=") || strings.HasPrefix(line, "MINIO_ACCESS_KEY=") {
				settings["access_key"] = strings.Trim(strings.SplitN(line, "=", 2)[1], `"' `)
			}
			if strings.HasPrefix(line, "MINIO_VOLUMES=") || strings.HasPrefix(line, "MINIO_OPTS=") {
				// Extract port if present
				val := strings.Trim(strings.SplitN(line, "=", 2)[1], `"' `)
				if strings.Contains(val, "--address") {
					// parse --address :9000 or --address 0.0.0.0:9000
					parts := strings.Fields(val)
					for i, p := range parts {
						if p == "--address" && i+1 < len(parts) {
							addr := parts[i+1]
							if !strings.HasPrefix(addr, "http") {
								addr = "http://" + addr
							}
							settings["endpoint"] = addr
						}
					}
				}
			}
		}
		break
	}

	return settings, nil
}

func (m *MinIOModule) UpdateSettings(settings map[string]interface{}) error {
	endpoint, _ := settings["endpoint"].(string)
	accessKey, _ := settings["access_key"].(string)
	secretKey, _ := settings["secret_key"].(string)

	if endpoint == "" {
		endpoint = "http://localhost:9000"
	}

	// mc config host add <alias> <endpoint> <accessKey> <secretKey>
	return exec.Command("mc", "config", "host", "add", m.Alias, endpoint, accessKey, secretKey).Run()
}
