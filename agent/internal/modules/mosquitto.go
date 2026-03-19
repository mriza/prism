package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type MosquittoModule struct {
	*SystemdModule
	PasswdFile string
}

func NewMosquittoModule() *MosquittoModule {
	return &MosquittoModule{
		SystemdModule: NewSystemdModule("mosquitto", "mosquitto", false),
		PasswdFile:    "/etc/mosquitto/passwd",
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*MosquittoModule)(nil)
var _ core.MQTTModule = (*MosquittoModule)(nil)

func (m *MosquittoModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("mosquitto", "-h").CombinedOutput()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		if len(lines) > 0 {
			facts["version"] = strings.TrimSpace(lines[0])
		}
	}
	return facts, nil
}

// --- MQTTModule Implementation ---

func (m *MosquittoModule) ListUsers() ([]string, error) {
	if _, err := os.Stat(m.PasswdFile); os.IsNotExist(err) {
		return []string{}, nil
	}

	content, err := os.ReadFile(m.PasswdFile)
	if err != nil {
		return nil, err
	}

	var users []string
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Split(line, ":")
		if len(parts) >= 1 {
			users = append(users, parts[0])
		}
	}
	return users, nil
}

func (m *MosquittoModule) CreateUser(username, password string) error {
	// bash -c "mosquitto_passwd -b /etc/mosquitto/passwd username password"
	// Check if file exists, create if not
	if _, err := os.Stat(m.PasswdFile); os.IsNotExist(err) {
		os.WriteFile(m.PasswdFile, []byte(""), 0644)
	}

	cmd := exec.Command("mosquitto_passwd", "-b", m.PasswdFile, username, password)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create/update mosquitto user: %w", err)
	}

	return m.Restart()
}

func (m *MosquittoModule) DeleteUser(username string) error {
	cmd := exec.Command("mosquitto_passwd", "-D", m.PasswdFile, username)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to delete mosquitto user: %w", err)
	}
	return m.Restart()
}

// --- ConfigurableModule Implementation ---

func (m *MosquittoModule) GetConfigPath() string {
	return "/etc/mosquitto/mosquitto.conf"
}

func (m *MosquittoModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *MosquittoModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}

// --- ServiceSettings Implementation ---

func (m *MosquittoModule) GetSettings() (map[string]interface{}, error) {
	settings := map[string]interface{}{
		"port":        "1883",
		"persistence": "false",
	}

	content, err := m.ReadConfig()
	if err != nil {
		return settings, nil
	}

	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") || trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "listener ") {
			parts := strings.Fields(trimmed)
			if len(parts) >= 2 {
				settings["port"] = parts[1]
			}
			if len(parts) >= 3 {
				settings["bind_address"] = parts[2]
			}
		}
		if parts := strings.Fields(trimmed); len(parts) == 2 {
			switch parts[0] {
			case "persistence":
				settings["persistence"] = parts[1]
			case "persistence_location":
				settings["persistence_location"] = parts[1]
			}
		}
	}

	return settings, nil
}

func (m *MosquittoModule) UpdateSettings(settings map[string]interface{}) error {
	content, err := m.ReadConfig()
	var lines []string
	if err != nil {
		lines = []string{}
	} else {
		lines = strings.Split(content, "\n")
	}

	if port, ok := settings["port"].(string); ok {
		bindAddr, _ := settings["bind_address"].(string)
		updated := false
		for i, line := range lines {
			if strings.HasPrefix(strings.TrimSpace(line), "listener ") {
				if bindAddr != "" {
					lines[i] = fmt.Sprintf("listener %s %s", port, bindAddr)
				} else {
					lines[i] = fmt.Sprintf("listener %s", port)
				}
				updated = true
				break
			}
		}
		if !updated {
			if bindAddr != "" {
				lines = append(lines, fmt.Sprintf("listener %s %s", port, bindAddr))
			} else {
				lines = append(lines, fmt.Sprintf("listener %s", port))
			}
		}
	}

	return m.WriteConfig(strings.Join(lines, "\n"))
}
