package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
	"strings"
)

type FirewalldModule struct {
	name     string
	isActive bool
}

func NewFirewalldModule() *FirewalldModule {
	return &FirewalldModule{
		name: "firewalld",
	}
}

func (m *FirewalldModule) Name() string {
	return m.name
}

func (m *FirewalldModule) TargetName() string {
	return m.name
}

func (m *FirewalldModule) IsActive() bool {
	return m.isActive
}

func (m *FirewalldModule) SetActive(active bool) {
	m.isActive = active
}

func (m *FirewalldModule) Install() error {
	_, err := exec.LookPath("firewall-cmd")
	if err != nil {
		return fmt.Errorf("firewall-cmd is not installed")
	}
	return nil
}

func (m *FirewalldModule) Start() error {
	return exec.Command("systemctl", "start", "firewalld").Run()
}

func (m *FirewalldModule) Stop() error {
	return exec.Command("systemctl", "stop", "firewalld").Run()
}

func (m *FirewalldModule) Restart() error {
	return exec.Command("systemctl", "restart", "firewalld").Run()
}

func (m *FirewalldModule) Status() (core.Status, error) {
	out, err := exec.Command("systemctl", "is-active", "firewalld").Output()
	if err != nil {
		return core.StatusStopped, nil
	}
	if strings.TrimSpace(string(out)) == "active" {
		return core.StatusRunning, nil
	}
	return core.StatusStopped, nil
}

func (m *FirewalldModule) GetFacts() (map[string]string, error) {
	return map[string]string{"type": "firewall", "tool": "firewalld"}, nil
}

func (m *FirewalldModule) Configure(config map[string]interface{}) error {
	return nil
}

// AllowPort adds a port to the public zone and reloads
func (m *FirewalldModule) AllowPort(port int, protocol string) error {
	rule := fmt.Sprintf("%d/%s", port, protocol)
	err := exec.Command("firewall-cmd", "--add-port="+rule, "--permanent").Run()
	if err != nil {
		return err
	}
	return exec.Command("firewall-cmd", "--reload").Run()
}

// DenyPort removes a port from the public zone
func (m *FirewalldModule) DenyPort(port int, protocol string) error {
	rule := fmt.Sprintf("%d/%s", port, protocol)
	err := exec.Command("firewall-cmd", "--remove-port="+rule, "--permanent").Run()
	if err != nil {
		return err
	}
	return exec.Command("firewall-cmd", "--reload").Run()
}

func (m *FirewalldModule) ListRules() ([]map[string]string, error) {
	out, _ := exec.Command("firewall-cmd", "--list-ports").Output()
	var rules []map[string]string
	ports := strings.Fields(strings.TrimSpace(string(out)))

	for _, p := range ports {
		rules = append(rules, map[string]string{
			"id":          p,
			"description": "Port " + p + " allowed",
		})
	}
	if rules == nil {
		rules = []map[string]string{}
	}
	return rules, nil
}

func (m *FirewalldModule) DeleteRule(ruleID string) error {
	err := exec.Command("firewall-cmd", "--remove-port="+ruleID, "--permanent").Run()
	if err != nil {
		return err
	}
	return exec.Command("firewall-cmd", "--reload").Run()
}

func (m *FirewalldModule) SetDefaultPolicy(policy, direction string) error {
	// Not fully implemented for Firewalld in this generic interface
	return nil
}

// --- ServiceSettings Implementation ---

func (m *FirewalldModule) GetSettings() (map[string]interface{}, error) {
	status, _ := m.Status()
	return map[string]interface{}{
		"status": string(status),
	}, nil
}

func (m *FirewalldModule) UpdateSettings(settings map[string]interface{}) error {
	return nil
}
