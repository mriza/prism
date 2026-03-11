package modules

import (
	"prism-agent/internal/core"
	"os/exec"
	"strings"
)

type GarageModule struct {
	*SystemdModule
}

func NewGarageModule() *GarageModule {
	return &GarageModule{
		SystemdModule: NewSystemdModule("garage", "garage", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*GarageModule)(nil)
var _ core.StorageModule = (*GarageModule)(nil)

func (m *GarageModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("garage", "-v").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

// --- StorageModule Implementation ---

func (m *GarageModule) ListBuckets() ([]string, error) {
	// garage bucket list --json ??
	// Assuming no JSON flag for simple list easily available without checking docs.
	// Let's parse text:
	// "id | alias | global_alias"
	out, err := exec.Command("garage", "bucket", "list").Output()
	if err != nil {
		return nil, err
	}

	var buckets []string
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		// Skip header or empty
		if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "=====") || strings.Contains(line, "GLOBAL ALIAS") { continue }
		// Format usually table-like
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			// fields[1] is usually the alias (name)
			buckets = append(buckets, fields[1])
		}
	}
	return buckets, nil
}

func (m *GarageModule) CreateBucket(name string) error {
	// Check if exists in list
	buckets, _ := m.ListBuckets()
	for _, b := range buckets {
		if b == name {
			return nil
		}
	}
	return exec.Command("garage", "bucket", "create", name).Run()
}

func (m *GarageModule) DeleteBucket(name string) error {
	return exec.Command("garage", "bucket", "delete", name, "--yes").Run()
}

func (m *GarageModule) ListUsers() ([]core.StorageUser, error) {
	// garage key list
	out, err := exec.Command("garage", "key", "list").Output()
	if err != nil {
		return nil, err
	}

	var users []core.StorageUser
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" || strings.Contains(line, "ACCESS KEY ID") { continue }
		fields := strings.Fields(line)
		if len(fields) >= 1 {
			// fields[0] is Access Key ID (Name/Alias)
			// Wait, garage key list shows "Key ID" and "Name".
			// But for S3 usage, the Key ID IS the Access Key.
			users = append(users, core.StorageUser{
				AccessKey: fields[0],
			})
		}
	}
	return users, nil
}

func (m *GarageModule) CreateUser(name, secretKey string) (core.StorageUser, error) {
	// garage key create <name>
	// Creates a new key, outputs ID and Secret.
	// Ignores provided secretKey as Garage generates it.
	out, err := exec.Command("garage", "key", "create", name).Output()
	if err != nil {
		return core.StorageUser{}, err
	}

	// Parse output to find Key ID and Secret Key
	// Output format:
	// Key name: <name>
	// Key ID: <id>
	// Secret Key: <secret>
	
	var user core.StorageUser
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, "Key ID:") {
			user.AccessKey = strings.TrimSpace(strings.Split(line, ":")[1])
		}
		if strings.Contains(line, "Secret Key:") {
			user.SecretKey = strings.TrimSpace(strings.Split(line, ":")[1])
		}
	}
	return user, nil
}

func (m *GarageModule) DeleteUser(accessKey string) error {
	// Garage delete by key ID or name?
	// "garage key delete <pattern>" works on name or ID.
	return exec.Command("garage", "key", "delete", accessKey, "--yes").Run()
}
