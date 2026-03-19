package modules

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

type ValkeyModule struct {
	*SystemdModule
}

func NewValkeyModule() *ValkeyModule {
	return &ValkeyModule{
		SystemdModule: NewSystemdModule("valkey", "valkey-server", false),
	}
}

func (m *ValkeyModule) Install() error {
	// Check if valkey-server binary exists
	if _, err := exec.LookPath("valkey-server"); err == nil {
		return nil // Already installed
	}

	// Try to install via apt (Ubuntu/Debian)
	if err := exec.Command("apt-get", "update").Run(); err != nil {
		return fmt.Errorf("failed to update package list: %w", err)
	}

	if err := exec.Command("apt-get", "install", "-y", "valkey-server").Run(); err != nil {
		return fmt.Errorf("failed to install valkey-server: %w", err)
	}

	return m.Start()
}

// ValkeyInfo contains Valkey server information
type ValkeyInfo struct {
	Version        string `json:"version"`
	Uptime         int    `json:"uptime_seconds"`
	ConnectedClients int  `json:"connected_clients"`
	UsedMemory     int    `json:"used_memory"`
	UsedMemoryPeak int    `json:"used_memory_peak"`
	TotalKeys      int    `json:"total_keys"`
	OpsPerSec      float64 `json:"ops_per_sec"`
}

// ValkeyKey represents a key in Valkey
type ValkeyKey struct {
	Key      string `json:"key"`
	Type     string `json:"type"`
	TTL      int64  `json:"ttl"`
	Size     int    `json:"size,omitempty"`
	Value    string `json:"value,omitempty"`
	Members  []string `json:"members,omitempty"`
	Fields   map[string]string `json:"fields,omitempty"`
}

// ValkeyClient represents a connected client
type ValkeyClient struct {
	ID   string `json:"id"`
	Addr string `json:"addr"`
	Age  int    `json:"age"`
	Idle int    `json:"idle"`
}

// ValkeyConfig represents Valkey configuration
type ValkeyConfig struct {
	Port            int    `json:"port"`
	Bind            string `json:"bind"`
	MaxMemory       string `json:"maxmemory"`
	MaxMemoryPolicy string `json:"maxmemory_policy"`
	AppendOnly      string `json:"appendonly"`
	AppendFsync     string `json:"appendfsync"`
	Dir             string `json:"dir"`
	Save            string `json:"save"`
}

// --- ValkeyModule Implementation ---

func (m *ValkeyModule) runValkeyCommand(args ...string) (string, error) {
	cmd := exec.Command("valkey-cli", args...)
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return "", fmt.Errorf("valkey-cli error: %s", string(exitErr.Stderr))
		}
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func (m *ValkeyModule) GetInfo() (*ValkeyInfo, error) {
	output, err := m.runValkeyCommand("INFO", "all")
	if err != nil {
		return nil, err
	}

	info := &ValkeyInfo{}
	scanner := bufio.NewScanner(strings.NewReader(output))
	
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		
		parts := strings.Split(line, ":")
		if len(parts) != 2 {
			continue
		}
		
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		
		switch key {
		case "redis_version":
			info.Version = value
		case "uptime_in_seconds":
			info.Uptime, _ = strconv.Atoi(value)
		case "connected_clients":
			info.ConnectedClients, _ = strconv.Atoi(value)
		case "used_memory":
			info.UsedMemory, _ = strconv.Atoi(value)
		case "used_memory_peak":
			info.UsedMemoryPeak, _ = strconv.Atoi(value)
		case "instantaneous_ops_per_sec":
			info.OpsPerSec, _ = strconv.ParseFloat(value, 64)
		}
	}
	
	// Get total keys
	dbInfo, err := m.runValkeyCommand("INFO", "keyspace")
	if err == nil {
		scanner := bufio.NewScanner(strings.NewReader(dbInfo))
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if strings.Contains(line, "keys=") {
				parts := strings.Split(line, ",")
				for _, p := range parts {
					if strings.Contains(p, "keys=") {
						kv := strings.Split(p, "=")
						if len(kv) == 2 {
							count, _ := strconv.Atoi(kv[1])
							info.TotalKeys += count
						}
					}
				}
			}
		}
	}
	
	return info, nil
}

func (m *ValkeyModule) ListKeys(pattern string) ([]ValkeyKey, error) {
	if pattern == "" {
		pattern = "*"
	}
	
	output, err := m.runValkeyCommand("KEYS", pattern)
	if err != nil {
		return nil, err
	}
	
	if output == "" {
		return []ValkeyKey{}, nil
	}
	
	keys := strings.Split(output, "\n")
	result := make([]ValkeyKey, 0, len(keys))
	
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		
		valkeyKey := ValkeyKey{Key: key}
		
		// Get type
		keyType, _ := m.runValkeyCommand("TYPE", key)
		valkeyKey.Type = keyType
		
		// Get TTL
		ttl, _ := m.runValkeyCommand("TTL", key)
		if ttl != "" {
			valkeyKey.TTL, _ = strconv.ParseInt(ttl, 10, 64)
		}
		
		// Get value based on type
		switch keyType {
		case "string":
			valkeyKey.Value, _ = m.runValkeyCommand("GET", key)
		case "list":
			members, _ := m.runValkeyCommand("LRANGE", key, "0", "-1")
			if members != "" {
				valkeyKey.Members = strings.Split(members, "\n")
			}
		case "set":
			members, _ := m.runValkeyCommand("SMEMBERS", key)
			if members != "" {
				valkeyKey.Members = strings.Split(members, "\n")
			}
		case "zset":
			members, _ := m.runValkeyCommand("ZRANGE", key, "0", "-1")
			if members != "" {
				valkeyKey.Members = strings.Split(members, "\n")
			}
		case "hash":
			fields, _ := m.runValkeyCommand("HGETALL", key)
			if fields != "" {
				valkeyKey.Fields = make(map[string]string)
				lines := strings.Split(fields, "\n")
				for i := 0; i < len(lines)-1; i += 2 {
					valkeyKey.Fields[lines[i]] = lines[i+1]
				}
			}
		}
		
		result = append(result, valkeyKey)
	}
	
	return result, nil
}

func (m *ValkeyModule) GetKey(key string) (*ValkeyKey, error) {
	keys, err := m.ListKeys(key)
	if err != nil {
		return nil, err
	}
	if len(keys) == 0 {
		return nil, fmt.Errorf("key not found")
	}
	return &keys[0], nil
}

func (m *ValkeyModule) SetKey(key, value string, ttl int) error {
	if ttl > 0 {
		_, err := m.runValkeyCommand("SETEX", key, strconv.Itoa(ttl), value)
		return err
	}
	_, err := m.runValkeyCommand("SET", key, value)
	return err
}

func (m *ValkeyModule) DeleteKey(key string) error {
	_, err := m.runValkeyCommand("DEL", key)
	return err
}

func (m *ValkeyModule) ListClients() ([]ValkeyClient, error) {
	output, err := m.runValkeyCommand("CLIENT", "LIST")
	if err != nil {
		return nil, err
	}
	
	if output == "" {
		return []ValkeyClient{}, nil
	}
	
	clients := make([]ValkeyClient, 0)
	lines := strings.Split(output, "\n")
	
	for _, line := range lines {
		if line == "" {
			continue
		}
		
		client := ValkeyClient{}
		fields := strings.Fields(line)
		
		for _, field := range fields {
			parts := strings.Split(field, "=")
			if len(parts) != 2 {
				continue
			}
			
			switch parts[0] {
			case "id":
				client.ID = parts[1]
			case "addr":
				client.Addr = parts[1]
			case "age":
				client.Age, _ = strconv.Atoi(parts[1])
			case "idle":
				client.Idle, _ = strconv.Atoi(parts[1])
			}
		}
		
		clients = append(clients, client)
	}
	
	return clients, nil
}

func (m *ValkeyModule) KillClient(addr string) error {
	_, err := m.runValkeyCommand("CLIENT", "KILL", addr)
	return err
}

func (m *ValkeyModule) GetConfig() (*ValkeyConfig, error) {
	output, err := m.runValkeyCommand("CONFIG", "GET", "*")
	if err != nil {
		return nil, err
	}
	
	config := &ValkeyConfig{}
	lines := strings.Split(output, "\n")
	
	for i := 0; i < len(lines)-1; i += 2 {
		key := strings.TrimSpace(lines[i])
		value := strings.TrimSpace(lines[i+1])
		
		switch key {
		case "port":
			config.Port, _ = strconv.Atoi(value)
		case "bind":
			config.Bind = value
		case "maxmemory":
			config.MaxMemory = value
		case "maxmemory-policy":
			config.MaxMemoryPolicy = value
		case "appendonly":
			config.AppendOnly = value
		case "appendfsync":
			config.AppendFsync = value
		case "dir":
			config.Dir = value
		case "save":
			config.Save = value
		}
	}
	
	return config, nil
}

func (m *ValkeyModule) UpdateConfig(key, value string) error {
	_, err := m.runValkeyCommand("CONFIG", "SET", key, value)
	return err
}

func (m *ValkeyModule) FlushDB() error {
	_, err := m.runValkeyCommand("FLUSHDB")
	return err
}

func (m *ValkeyModule) FlushAll() error {
	_, err := m.runValkeyCommand("FLUSHALL")
	return err
}

func (m *ValkeyModule) Save() error {
	_, err := m.runValkeyCommand("SAVE")
	return err
}

func (m *ValkeyModule) BGSave() error {
	_, err := m.runValkeyCommand("BGSAVE")
	return err
}

func (m *ValkeyModule) ConfigRewrite() error {
	_, err := m.runValkeyCommand("CONFIG", "REWRITE")
	return err
}

// --- Interface Implementations ---

func (m *ValkeyModule) Metrics() (map[string]float64, error) {
	info, err := m.GetInfo()
	if err != nil {
		return nil, err
	}
	
	return map[string]float64{
		"connected_clients": float64(info.ConnectedClients),
		"used_memory":       float64(info.UsedMemory),
		"total_keys":        float64(info.TotalKeys),
		"ops_per_sec":       info.OpsPerSec,
	}, nil
}

// DatabaseModule implementation
func (m *ValkeyModule) ListDatabases() ([]string, error) {
	// Valkey doesn't have named databases like MySQL, but we can list key patterns
	// For now, return logical databases
	dbs := make([]string, 0)
	output, err := m.runValkeyCommand("INFO", "keyspace")
	if err != nil {
		return dbs, nil
	}
	
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "db") {
			parts := strings.Split(line, ":")
			if len(parts) > 0 {
				dbs = append(dbs, parts[0])
			}
		}
	}
	
	return dbs, nil
}

func (m *ValkeyModule) CreateDatabase(name string) error {
	// Valkey databases are created automatically when used
	// Just select it
	_, err := m.runValkeyCommand("SELECT", strings.TrimPrefix(name, "db"))
	return err
}

func (m *ValkeyModule) ListUsers() ([]string, error) {
	output, err := m.runValkeyCommand("ACL", "LIST")
	if err != nil {
		return nil, err
	}
	
	users := make([]string, 0)
	lines := strings.Split(output, "\n")
	
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) > 0 {
			username := strings.TrimPrefix(parts[0], "user ")
			username = strings.Split(username, " ")[0]
			users = append(users, username)
		}
	}
	
	return users, nil
}

func (m *ValkeyModule) CreateUser(name, password, role, target string) error {
	// Create user with password
	cmd := []string{"ACL", "SETUSER", name}
	if password != "" {
		cmd = append(cmd, ">"+password)
	}
	
	// Set permissions based on role
	switch role {
	case "admin":
		cmd = append(cmd, "on", "+@all")
	case "read":
		cmd = append(cmd, "on", "+@read")
	case "write":
		cmd = append(cmd, "on", "+@write")
	default:
		cmd = append(cmd, "on")
	}
	
	_, err := m.runValkeyCommand(cmd...)
	return err
}

func (m *ValkeyModule) UpdatePrivileges(name, role, target string) error {
	cmd := []string{"ACL", "SETUSER", name}
	
	switch role {
	case "admin":
		cmd = append(cmd, "+@all")
	case "read":
		cmd = append(cmd, "+@read")
	case "write":
		cmd = append(cmd, "+@write")
	}
	
	_, err := m.runValkeyCommand(cmd...)
	return err
}

// ConfigurableModule implementation
func (m *ValkeyModule) GetConfigPath() string {
	paths := []string{
		"/etc/valkey/valkey.conf",
		"/etc/valkey-server.conf",
		"/usr/local/etc/valkey.conf",
	}
	
	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	
	return "/etc/valkey/valkey.conf"
}

func (m *ValkeyModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *ValkeyModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}

// ServiceSettings implementation
func (m *ValkeyModule) GetSettings() (map[string]interface{}, error) {
	settings := map[string]interface{}{
		"port":            "6379",
		"bind":            "127.0.0.1",
		"maxmemory":       "0",
		"maxmemory_policy": "noeviction",
		"appendonly":      "no",
		"appendfsync":     "everysec",
		"dir":             "/var/lib/valkey",
	}

	// Try live config via valkey-cli first
	if config, err := m.GetConfig(); err == nil {
		if config.Port > 0 {
			settings["port"] = strconv.Itoa(config.Port)
		}
		if config.Bind != "" {
			settings["bind"] = config.Bind
		}
		if config.MaxMemory != "" {
			settings["maxmemory"] = config.MaxMemory
		}
		if config.MaxMemoryPolicy != "" {
			settings["maxmemory_policy"] = config.MaxMemoryPolicy
		}
		if config.AppendOnly != "" {
			settings["appendonly"] = config.AppendOnly
		}
		if config.AppendFsync != "" {
			settings["appendfsync"] = config.AppendFsync
		}
		if config.Dir != "" {
			settings["dir"] = config.Dir
		}
		return settings, nil
	}

	// Fallback: parse config file directly
	if content, err := m.ReadConfig(); err == nil {
		for _, line := range strings.Split(content, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.Fields(line)
			if len(parts) < 2 {
				continue
			}
			key := parts[0]
			val := strings.Join(parts[1:], " ")
			switch key {
			case "port":
				settings["port"] = val
			case "bind":
				settings["bind"] = val
			case "maxmemory":
				settings["maxmemory"] = val
			case "maxmemory-policy":
				settings["maxmemory_policy"] = val
			case "appendonly":
				settings["appendonly"] = val
			case "appendfsync":
				settings["appendfsync"] = val
			case "dir":
				settings["dir"] = val
			}
		}
	}

	return settings, nil
}

func (m *ValkeyModule) UpdateSettings(settings map[string]interface{}) error {
	for key, value := range settings {
		if err := m.UpdateConfig(key, fmt.Sprintf("%v", value)); err != nil {
			return err
		}
	}
	return m.ConfigRewrite()
}
