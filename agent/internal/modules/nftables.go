package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
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
	return fmt.Errorf("nftables automated port opening is not implemented")
}

func (m *NftablesModule) DenyPort(port int, protocol string) error {
	return fmt.Errorf("nftables automated port closing is not implemented")
}

func (m *NftablesModule) ListRules() ([]map[string]string, error) {
	return []map[string]string{}, nil
}

func (m *NftablesModule) DeleteRule(ruleID string) error {
	return fmt.Errorf("deleting nftables rules by ID is not natively supported yet")
}

func (m *NftablesModule) SetDefaultPolicy(policy, direction string) error {
	return fmt.Errorf("setting default policy on nftables is not implemented")
}
