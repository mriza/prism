package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
	"strings"
)

type UFWModule struct {
	name string
}

func NewUFWModule() *UFWModule {
	return &UFWModule{
		name: "ufw",
	}
}

func (m *UFWModule) Name() string {
	return m.name
}

func (m *UFWModule) Install() error {
	_, err := exec.LookPath("ufw")
	if err != nil {
		return fmt.Errorf("ufw is not installed")
	}
	return nil
}

func (m *UFWModule) Start() error {
	return exec.Command("ufw", "enable").Run()
}

func (m *UFWModule) Stop() error {
	return exec.Command("ufw", "disable").Run()
}

func (m *UFWModule) Restart() error {
	return exec.Command("ufw", "reload").Run()
}

func (m *UFWModule) Status() (core.Status, error) {
	out, err := exec.Command("ufw", "status").Output()
	if err != nil {
		return core.StatusStopped, nil
	}
	if strings.Contains(string(out), "Status: active") {
		return core.StatusRunning, nil
	}
	return core.StatusStopped, nil
}

func (m *UFWModule) GetFacts() (map[string]string, error) {
	return map[string]string{"type": "firewall", "tool": "ufw"}, nil
}

func (m *UFWModule) Configure(config map[string]interface{}) error {
	// Example: Allow ports
	// ufw allow 80/tcp
	return nil
}

func (m *UFWModule) AllowPort(port int, protocol string) error {
	rule := fmt.Sprintf("%d/%s", port, protocol)
	return exec.Command("ufw", "allow", rule).Run()
}

func (m *UFWModule) DenyPort(port int, protocol string) error {
	rule := fmt.Sprintf("%d/%s", port, protocol)
	return exec.Command("ufw", "deny", rule).Run()
}

func (m *UFWModule) ListRules() ([]map[string]string, error) {
	out, _ := exec.Command("ufw", "status", "numbered").Output()

	var rules []map[string]string
	lines := strings.Split(string(out), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "[") {
			continue
		}

		parts := strings.SplitN(line, "]", 2)
		if len(parts) != 2 {
			continue
		}

		idStr := strings.TrimSpace(strings.TrimPrefix(parts[0], "["))
		rest := strings.TrimSpace(parts[1])

		rules = append(rules, map[string]string{
			"id":          idStr,
			"description": rest,
		})
	}

	if rules == nil {
		rules = []map[string]string{}
	}

	return rules, nil
}

func (m *UFWModule) DeleteRule(ruleID string) error {
	return exec.Command("ufw", "--force", "delete", ruleID).Run()
}

func (m *UFWModule) SetDefaultPolicy(policy, direction string) error {
	return exec.Command("ufw", "default", policy, direction).Run()
}
