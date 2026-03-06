package modules

import (
	"fitz-agent/internal/core"
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
