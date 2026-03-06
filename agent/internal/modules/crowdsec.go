package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
	"strings"
)

type CrowdSecModule struct {
	name string
}

func NewCrowdSecModule() *CrowdSecModule {
	return &CrowdSecModule{
		name: "crowdsec",
	}
}

func (m *CrowdSecModule) Name() string {
	return m.name
}

func (m *CrowdSecModule) Install() error {
	_, err := exec.LookPath("cscli")
	if err != nil {
		return fmt.Errorf("crowdsec (cscli) is not installed")
	}
	return nil
}

func (m *CrowdSecModule) Start() error {
	return exec.Command("systemctl", "start", "crowdsec").Run()
}

func (m *CrowdSecModule) Stop() error {
	return exec.Command("systemctl", "stop", "crowdsec").Run()
}

func (m *CrowdSecModule) Restart() error {
	return exec.Command("systemctl", "restart", "crowdsec").Run()
}

func (m *CrowdSecModule) Status() (core.Status, error) {
	out, err := exec.Command("systemctl", "is-active", "crowdsec").Output()
	if err != nil {
		return core.StatusStopped, nil
	}
	if strings.TrimSpace(string(out)) == "active" {
		return core.StatusRunning, nil
	}
	return core.StatusStopped, nil
}

func (m *CrowdSecModule) GetFacts() (map[string]string, error) {
	version, _ := exec.Command("cscli", "version").Output()
	return map[string]string{
		"type":    "security",
		"tool":    "crowdsec",
		"version": strings.TrimSpace(string(version)),
	}, nil
}

func (m *CrowdSecModule) Configure(config map[string]interface{}) error {
	return nil
}

// ListDecisions returns the raw JSON output from cscli decisions list.
func (m *CrowdSecModule) ListDecisions() (string, error) {
	out, err := exec.Command("cscli", "decisions", "list", "-o", "json").Output()
	if err != nil {
		// cscli returns exit code 1 when there are no decisions, but still outputs valid JSON (null)
		if len(out) > 0 {
			return string(out), nil
		}
		return "[]", nil
	}
	result := strings.TrimSpace(string(out))
	if result == "" || result == "null" {
		return "[]", nil
	}
	return result, nil
}

// AddDecision manually adds a ban/captcha decision for an IP.
func (m *CrowdSecModule) AddDecision(ip, duration, reason, decType string) error {
	if ip == "" {
		return fmt.Errorf("IP address is required")
	}
	if duration == "" {
		duration = "4h"
	}
	if reason == "" {
		reason = "manual via PRISM"
	}
	if decType == "" {
		decType = "ban"
	}

	args := []string{"decisions", "add", "--ip", ip, "--duration", duration, "--reason", reason, "--type", decType}
	return exec.Command("cscli", args...).Run()
}

// DeleteDecision removes a decision by its numeric ID.
func (m *CrowdSecModule) DeleteDecision(id string) error {
	if id == "" {
		return fmt.Errorf("decision ID is required")
	}
	return exec.Command("cscli", "decisions", "delete", "--id", id).Run()
}
