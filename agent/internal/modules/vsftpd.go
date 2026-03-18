package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type VsftpdModule struct {
	*SystemdModule
	VirtualUsersFile string
	ConfigDir        string
}

func NewVsftpdModule() *VsftpdModule {
	return &VsftpdModule{
		SystemdModule:    NewSystemdModule("vsftpd", "vsftpd", false),
		VirtualUsersFile: "/etc/vsftpd/virtual_users.txt",
		ConfigDir:        "/etc/vsftpd/user_config",
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*VsftpdModule)(nil)
var _ core.FTPModule = (*VsftpdModule)(nil)

func (m *VsftpdModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("vsftpd", "-v").CombinedOutput()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

// --- FTPModule Implementation ---

func (m *VsftpdModule) ListUsers() ([]string, error) {
	if _, err := os.Stat(m.VirtualUsersFile); os.IsNotExist(err) {
		return []string{}, nil
	}

	content, err := os.ReadFile(m.VirtualUsersFile)
	if err != nil {
		return nil, err
	}

	var users []string
	lines := strings.Split(string(content), "\n")
	// vsftpd virtual_users.txt format is usually:
	// username
	// password
	for i := 0; i < len(lines); i += 2 {
		user := strings.TrimSpace(lines[i])
		if user != "" {
			users = append(users, user)
		}
	}
	return users, nil
}

func (m *VsftpdModule) CreateUser(username, password, rootPath string, quota int, quotaEnabled bool) error {
	// 1. Ensure system setup
	if err := m.ensureSystemSetup(); err != nil {
		return err
	}

	// 2. Update virtual_users.txt
	if err := m.updateVirtualUsersFile(username, password); err != nil {
		return err
	}

	// 3. Generate DB
	dbFile := strings.TrimSuffix(m.VirtualUsersFile, ".txt") + ".db"
	if err := exec.Command("db_load", "-T", "-t", "hash", "-f", m.VirtualUsersFile, dbFile).Run(); err != nil {
		return fmt.Errorf("failed to load virtual users db: %w", err)
	}

	// 4. Create user-specific config
	os.MkdirAll(m.ConfigDir, 0755)
	userConfigPath := filepath.Join(m.ConfigDir, username)
	
	// If rootPath is empty, use a default under /var/ftp/virtual_users
	if rootPath == "" {
		rootPath = filepath.Join("/var/ftp/virtual_users", username)
	}

	configContent := fmt.Sprintf("local_root=%s\nwrite_enable=YES\n", rootPath)
	if err := os.WriteFile(userConfigPath, []byte(configContent), 0644); err != nil {
		return err
	}

	// 5. Create Directory & Quota (Btrfs)
	if err := m.setupUserDirectory(rootPath, quota, quotaEnabled); err != nil {
		return err
	}

	return m.Restart()
}

func (m *VsftpdModule) DeleteUser(username string) error {
	// 1. Remove from txt file
	content, err := os.ReadFile(m.VirtualUsersFile)
	if err == nil {
		lines := strings.Split(string(content), "\n")
		var newLines []string
		for i := 0; i < len(lines); i += 2 {
			if i < len(lines) && strings.TrimSpace(lines[i]) != username {
				newLines = append(newLines, lines[i])
				if i+1 < len(lines) {
					newLines = append(newLines, lines[i+1])
				}
			}
		}
		os.WriteFile(m.VirtualUsersFile, []byte(strings.Join(newLines, "\n")), 0600)
		
		// Regenerate DB
		dbFile := strings.TrimSuffix(m.VirtualUsersFile, ".txt") + ".db"
		exec.Command("db_load", "-T", "-t", "hash", "-f", m.VirtualUsersFile, dbFile).Run()
	}

	// 2. Remove user configuration
	os.Remove(filepath.Join(m.ConfigDir, username))

	return m.Restart()
}

func (m *VsftpdModule) ensureSystemSetup() error {
	// Ensure vsftpd and libdb-utils are installed (handled by Install() but let's be safe)
	
	// Create ftpuser if missing
	exec.Command("useradd", "-r", "-s", "/sbin/nologin", "-d", "/var/ftp", "ftpuser").Run()
	os.MkdirAll("/var/ftp", 0755)
	exec.Command("chown", "ftpuser:ftpuser", "/var/ftp").Run()

	// Ensure PAM config
	pamFile := "/etc/pam.d/vsftpd.virtual"
	if _, err := os.Stat(pamFile); os.IsNotExist(err) {
		dbPath := strings.TrimSuffix(m.VirtualUsersFile, ".txt")
		content := fmt.Sprintf("auth required pam_userdb.so db=%s\naccount required pam_userdb.so db=%s\n", dbPath, dbPath)
		os.WriteFile(pamFile, []byte(content), 0644)
	}

	// Ensure main vsftpd.conf if it's missing or basic
	// For now, assume it's configured or Install() handles it.
	return nil
}

func (m *VsftpdModule) updateVirtualUsersFile(username, password string) error {
	os.MkdirAll(filepath.Dir(m.VirtualUsersFile), 0755)
	users, _ := m.ListUsers()
	exists := false
	for _, u := range users {
		if u == username {
			exists = true
			break
		}
	}

	if exists {
		content, _ := os.ReadFile(m.VirtualUsersFile)
		lines := strings.Split(string(content), "\n")
		for i := 0; i < len(lines); i += 2 {
			if strings.TrimSpace(lines[i]) == username {
				if i+1 < len(lines) {
					lines[i+1] = password
				}
				break
			}
		}
		return os.WriteFile(m.VirtualUsersFile, []byte(strings.Join(lines, "\n")), 0600)
	}
	
	f, err := os.OpenFile(m.VirtualUsersFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s\n%s\n", username, password)
	return err
}

func (m *VsftpdModule) setupUserDirectory(rootPath string, _ int, _ bool) error {
	if rootPath == "" {
		return nil
	}
	if err := os.MkdirAll(rootPath, 0755); err != nil {
		return fmt.Errorf("failed to create user directory %s: %w", rootPath, err)
	}
	// Set ownership to the ftpuser system account
	exec.Command("chown", "ftpuser:ftpuser", rootPath).Run()
	return nil
}

// --- ConfigurableModule Implementation ---

func (m *VsftpdModule) GetConfigPath() string {
	return "/etc/vsftpd/vsftpd.conf"
}

func (m *VsftpdModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *VsftpdModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}

// --- ServiceSettings Implementation ---

func (m *VsftpdModule) GetSettings() (map[string]interface{}, error) {
	content, err := m.ReadConfig()
	if err != nil {
		return map[string]interface{}{
			"port":             "21",
			"anonymous_enable": "NO",
			"local_enable":     "YES",
			"write_enable":     "YES",
		}, nil
	}

	settings := make(map[string]interface{})
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) >= 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			switch key {
			case "listen_port":
				settings["port"] = val
			case "anonymous_enable":
				settings["anonymous_enable"] = val
			case "local_enable":
				settings["local_enable"] = val
			case "write_enable":
				settings["write_enable"] = val
			case "chroot_local_user":
				settings["chroot_local_user"] = val
			}
		}
	}

	if _, ok := settings["port"]; !ok {
		settings["port"] = "21"
	}
	return settings, nil
}

func (m *VsftpdModule) UpdateSettings(settings map[string]interface{}) error {
	content, err := m.ReadConfig()
	var lines []string
	if err != nil {
		lines = []string{}
	} else {
		lines = strings.Split(content, "\n")
	}

	updates := map[string]string{
		"listen_port":       "port",
		"anonymous_enable":  "anonymous_enable",
		"local_enable":      "local_enable",
		"write_enable":      "write_enable",
		"chroot_local_user": "chroot_local_user",
	}

	for configKey, settingsKey := range updates {
		if val, ok := settings[settingsKey].(string); ok {
			updated := false
			for i, line := range lines {
				if strings.HasPrefix(strings.TrimSpace(line), configKey+"=") {
					lines[i] = fmt.Sprintf("%s=%s", configKey, val)
					updated = true
					break
				}
			}
			if !updated {
				lines = append(lines, fmt.Sprintf("%s=%s", configKey, val))
			}
		}
	}

	return m.WriteConfig(strings.Join(lines, "\n"))
}
