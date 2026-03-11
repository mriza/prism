package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
	"strings"
)

type IptablesModule struct {
	name     string
	isActive bool
}

func NewIptablesModule() *IptablesModule {
	return &IptablesModule{
		name: "iptables",
	}
}

func (m *IptablesModule) Name() string {
	return m.name
}

func (m *IptablesModule) TargetName() string {
	return m.name
}

func (m *IptablesModule) IsActive() bool {
	return m.isActive
}

func (m *IptablesModule) SetActive(active bool) {
	m.isActive = active
}

func (m *IptablesModule) Install() error {
	_, err := exec.LookPath("iptables")
	if err != nil {
		return fmt.Errorf("iptables is not installed")
	}
	return nil
}

// Iptables doesn't typically run as a standard systemd service itself (usually iptables-persistent or netfilter-persistent). 
// For Status(), we assume running if rules can be listed and iptables exists.
func (m *IptablesModule) Start() error {
	return nil
}

func (m *IptablesModule) Stop() error {
	return nil
}

func (m *IptablesModule) Restart() error {
	return nil
}

func (m *IptablesModule) Status() (core.Status, error) {
	err := exec.Command("iptables", "-L").Run()
	if err == nil {
		return core.StatusRunning, nil
	}
	return core.StatusStopped, nil
}

func (m *IptablesModule) GetFacts() (map[string]string, error) {
	return map[string]string{"type": "firewall", "tool": "iptables"}, nil
}

func (m *IptablesModule) Configure(config map[string]interface{}) error {
	return nil
}

func (m *IptablesModule) AllowPort(port int, protocol string) error {
	portStr := fmt.Sprintf("%d", port)
	return exec.Command("iptables", "-I", "INPUT", "-p", protocol, "--dport", portStr, "-j", "ACCEPT").Run()
}

func (m *IptablesModule) DenyPort(port int, protocol string) error {
	portStr := fmt.Sprintf("%d", port)
	return exec.Command("iptables", "-I", "INPUT", "-p", protocol, "--dport", portStr, "-j", "DROP").Run()
}

func (m *IptablesModule) ListRules() ([]map[string]string, error) {
	out, err := exec.Command("iptables", "-S", "INPUT").Output()
	var rules []map[string]string
	if err != nil {
		return []map[string]string{}, nil
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for i, line := range lines {
		if strings.HasPrefix(line, "-P") || line == "" { // Skip defaults
			continue
		}
		rules = append(rules, map[string]string{
			"id":          fmt.Sprintf("%d", i),
			"description": line,
		})
	}
	if rules == nil {
		rules = []map[string]string{}
	}
	return rules, nil
}

func (m *IptablesModule) DeleteRule(ruleID string) error {
	// Iptables deletion by raw rule ID is difficult to sync cleanly; usually we'd delete by line number in a chain.
	// For now, this is a stub as iptables management is complex.
	return fmt.Errorf("deleting iptables rules by ID is not natively supported yet in this basic implementation")
}

func (m *IptablesModule) SetDefaultPolicy(policy, direction string) error {
	chain := "INPUT"
	if direction == "outgoing" {
		chain = "OUTPUT"
	}
	pol := "DROP"
	if policy == "allow" {
		pol = "ACCEPT"
	}
	return exec.Command("iptables", "-P", chain, pol).Run()
}
