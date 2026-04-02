package modules

import (
	"fmt"
	"os/exec"
	"prism-agent/internal/core"
)

type NftablesModule struct {
	name     string
	isActive bool
}

func NewNftablesModule() *NftablesModule {
	return &NftablesModule{
		name: "nftables",
	}
}

func (m *NftablesModule) Name() string {
	return m.name
}

func (m *NftablesModule) TargetName() string {
	return m.name
}

func (m *NftablesModule) IsActive() bool {
	return m.isActive
}

func (m *NftablesModule) SetActive(active bool) {
	m.isActive = active
}

func (m *NftablesModule) Install() error {
	_, err := exec.LookPath("nft")
	if err != nil {
		return fmt.Errorf("nftables (nft) is not installed")
	}
	return nil
}

func (m *NftablesModule) Start() error {
	return exec.Command("systemctl", "start", "nftables").Run()
}

func (m *NftablesModule) Stop() error {
	return exec.Command("systemctl", "stop", "nftables").Run()
}

func (m *NftablesModule) Restart() error {
	return exec.Command("systemctl", "restart", "nftables").Run()
}

func (m *NftablesModule) Status() (core.Status, error) {
	err := exec.Command("systemctl", "is-active", "nftables").Run()
	if err != nil { // Could also be disabled/running without systemd
		err = exec.Command("nft", "list", "ruleset").Run()
		if err == nil {
			return core.StatusRunning, nil
		}
		return core.StatusStopped, nil
	}
	return core.StatusRunning, nil
}

func (m *NftablesModule) GetFacts() (map[string]string, error) {
	return map[string]string{"type": "firewall", "tool": "nftables"}, nil
}

func (m *NftablesModule) Configure(config map[string]interface{}) error {
	return nil
}

func (m *NftablesModule) AllowPort(port int, protocol string) error {
	// Validate protocol
	if protocol != "tcp" && protocol != "udp" {
		return fmt.Errorf("unsupported protocol: %s (must be tcp or udp)", protocol)
	}

	// Add rule to allow incoming connections on specified port
	cmd := exec.Command("nft", "add", "rule", "inet", "filter", "input",
		fmt.Sprintf("%s", protocol), "dport", fmt.Sprintf("%d", port), "accept")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to add nftables rule for port %d/%s: %w - %s", port, protocol, err, string(output))
	}
	return nil
}

func (m *NftablesModule) DenyPort(port int, protocol string) error {
	// Validate protocol
	if protocol != "tcp" && protocol != "udp" {
		return fmt.Errorf("unsupported protocol: %s (must be tcp or udp)", protocol)
	}

	// Add rule to deny incoming connections on specified port
	cmd := exec.Command("nft", "add", "rule", "inet", "filter", "input",
		fmt.Sprintf("%s", protocol), "dport", fmt.Sprintf("%d", port), "drop")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to add nftables deny rule for port %d/%s: %w - %s", port, protocol, err, string(output))
	}
	return nil
}

func (m *NftablesModule) ListRules() ([]map[string]string, error) {
	// List all rules in the inet filter input chain
	cmd := exec.Command("nft", "list", "chain", "inet", "filter", "input")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list nftables rules: %w", err)
	}

	// Parse output into rules (simplified - just return raw output)
	rules := []map[string]string{
		{"raw": string(output)},
	}
	return rules, nil
}

func (m *NftablesModule) DeleteRule(ruleID string) error {
	// Delete rule by handle ID
	// Rule ID format should be: inet/filter/input@handle
	cmd := exec.Command("nft", "delete", "rule", ruleID)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to delete nftables rule %s: %w - %s", ruleID, err, string(output))
	}
	return nil
}

func (m *NftablesModule) SetDefaultPolicy(policy, direction string) error {
	// Validate policy
	if policy != "accept" && policy != "drop" {
		return fmt.Errorf("unsupported policy: %s (must be accept or drop)", policy)
	}

	// Validate direction
	if direction != "input" && direction != "forward" && direction != "output" {
		return fmt.Errorf("unsupported direction: %s (must be input, forward, or output)", direction)
	}

	// Set the default policy for the chain
	cmd := exec.Command("nft", "flush", "chain", "inet", "filter", direction)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to flush nftables chain %s: %w - %s", direction, err, string(output))
	}

	// Add default policy rule
	cmd = exec.Command("nft", "add", "rule", "inet", "filter", direction, policy)
	output, err = cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to set default policy %s for chain %s: %w - %s", policy, direction, err, string(output))
	}
	return nil
}
