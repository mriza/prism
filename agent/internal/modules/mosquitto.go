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
