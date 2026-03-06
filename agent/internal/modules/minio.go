package modules

import (
	"encoding/json"
	"fitz-agent/internal/core"
	"os/exec"
	"strings"
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
		if strings.TrimSpace(line) == "" { continue }
		var entry struct {
			Key string `json:"key"`
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
		if strings.TrimSpace(line) == "" { continue }
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
		// MinIO requires password. Generate one?
		// For now simple default or error?
		// Let's generate a simple random one?
		// "minio123" involves security risk.
		// Use `openssl rand -hex 8`?
		out, _ := exec.Command("openssl", "rand", "-hex", "8").Output()
		secretKey = strings.TrimSpace(string(out))
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
