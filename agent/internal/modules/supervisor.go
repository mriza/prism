package modules

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"prism-agent/internal/core"
)

type SupervisorModule struct{}

func NewSupervisorModule() *SupervisorModule {
	return &SupervisorModule{}
}

func (m *SupervisorModule) Name() string {
	return "supervisor"
}

func (m *SupervisorModule) Install() error {
	_, err := exec.LookPath("supervisorctl")
	return err
}

func (m *SupervisorModule) Start() error {
	return exec.Command("systemctl", "start", "supervisor").Run()
}

func (m *SupervisorModule) Stop() error {
	return exec.Command("systemctl", "stop", "supervisor").Run()
}

func (m *SupervisorModule) Restart() error {
	return exec.Command("systemctl", "restart", "supervisor").Run()
}

func (m *SupervisorModule) Status() (core.Status, error) {
	if err := exec.Command("supervisorctl", "status").Run(); err != nil {
		return core.StatusStopped, nil
	}
	return core.StatusRunning, nil
}

func (m *SupervisorModule) GetFacts() (map[string]string, error) {
	facts := map[string]string{"type": "supervisor", "manager": "process-manager"}
	out, err := exec.Command("supervisorctl", "status").Output()
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		facts["process_count"] = fmt.Sprintf("%d", len(lines))
	}
	return facts, nil
}

func (m *SupervisorModule) Configure(config map[string]interface{}) error {
	return nil
}

func (m *SupervisorModule) ListProcesses() ([]core.ProcessInfo, error) {
	out, err := exec.Command("supervisorctl", "status").Output()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	procs := make([]core.ProcessInfo, 0, len(lines))
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		procs = append(procs, core.ProcessInfo{
			ID:     fields[0],
			Name:   fields[0],
			Status: strings.ToLower(fields[1]),
		})
	}
	return procs, nil
}

func (m *SupervisorModule) StartProcess(id string) error {
	return exec.Command("supervisorctl", "start", id).Run()
}

func (m *SupervisorModule) StopProcess(id string) error {
	return exec.Command("supervisorctl", "stop", id).Run()
}

func (m *SupervisorModule) RestartProcess(id string) error {
	return exec.Command("supervisorctl", "restart", id).Run()
}

// --- ServiceSettings Implementation ---

func (m *SupervisorModule) getConfigPath() string {
	candidates := []string{
		"/etc/supervisor/supervisord.conf",
		"/etc/supervisord.conf",
		"/usr/local/etc/supervisord.conf",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "/etc/supervisor/supervisord.conf"
}

func (m *SupervisorModule) GetSettings() (map[string]interface{}, error) {
	defaults := map[string]interface{}{
		"logfile":          "/var/log/supervisor/supervisord.log",
		"logfile_maxbytes": "50MB",
		"logfile_backups":  "10",
		"nodaemon":         "false",
		"minfds":           "1024",
	}

	content, err := os.ReadFile(m.getConfigPath())
	if err != nil {
		return defaults, nil
	}

	settings := make(map[string]interface{})
	inSupervisord := false
	for _, line := range strings.Split(string(content), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "[supervisord]" {
			inSupervisord = true
			continue
		}
		if strings.HasPrefix(trimmed, "[") {
			inSupervisord = false
			continue
		}
		if !inSupervisord || strings.HasPrefix(trimmed, ";") || trimmed == "" {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		switch key {
		case "logfile", "logfile_maxbytes", "logfile_backups", "nodaemon", "minfds":
			settings[key] = val
		}
	}

	// Fill missing keys with defaults
	for k, v := range defaults {
		if _, ok := settings[k]; !ok {
			settings[k] = v
		}
	}
	return settings, nil
}

func (m *SupervisorModule) UpdateSettings(settings map[string]interface{}) error {
	configPath := m.getConfigPath()
	content, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	inSupervisord := false
	updated := map[string]bool{}

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "[supervisord]" {
			inSupervisord = true
			continue
		}
		if strings.HasPrefix(trimmed, "[") {
			inSupervisord = false
			continue
		}
		if !inSupervisord {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		if val, ok := settings[key].(string); ok && val != "" {
			lines[i] = fmt.Sprintf("%s = %s", key, val)
			updated[key] = true
		}
	}

	// Append any new keys into [supervisord] section
	if len(updated) < len(settings) {
		for i, line := range lines {
			if strings.TrimSpace(line) == "[supervisord]" {
				insertAt := i + 1
				for key, val := range settings {
					if !updated[key] {
						newLine := fmt.Sprintf("%s = %v", key, val)
						lines = append(lines[:insertAt], append([]string{newLine}, lines[insertAt:]...)...)
						insertAt++
					}
				}
				break
			}
		}
	}

	if err := os.WriteFile(configPath, []byte(strings.Join(lines, "\n")), 0644); err != nil {
		return err
	}
	return m.Restart()
}
