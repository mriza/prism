package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

type AnsibleModule struct {
	// core.ServiceModule could be embedded if we want generic Start/Stop,
	// but Ansible is more of a task runner.
	// For consistency, we can implement a dummy or basic ServiceModule interface.
	name string
}

func NewAnsibleModule() *AnsibleModule {
	return &AnsibleModule{
		name: "ansible",
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*AnsibleModule)(nil)

func (m *AnsibleModule) Name() string   { return m.name }
func (m *AnsibleModule) Install() error { return nil }
func (m *AnsibleModule) Start() error   { return nil }
func (m *AnsibleModule) Stop() error    { return nil }
func (m *AnsibleModule) Restart() error { return nil }
func (m *AnsibleModule) RunPlaybook(playbookPath, inventory, extraVars string) (string, error) {
	// Sanitize playbookPath to prevent path injection/traversal
	cleanPath := filepath.Clean(playbookPath)
	if strings.Contains(cleanPath, "..") {
		return "", fmt.Errorf("invalid playbook path: path traversal detected")
	}
	if !strings.HasSuffix(cleanPath, ".yml") && !strings.HasSuffix(cleanPath, ".yaml") {
		return "", fmt.Errorf("invalid playbook path: must be a .yml or .yaml file")
	}

	args := []string{cleanPath}
	if inventory != "" {
		args = append(args, "-i", inventory)
	}
	if extraVars != "" {
		args = append(args, "--extra-vars", extraVars)
	}

	cmd := exec.Command("ansible-playbook", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

func (m *AnsibleModule) Status() (core.Status, error) {
	// Check if ansible-playbook binary exists
	_, err := exec.LookPath("ansible-playbook")
	if err != nil {
		return core.StatusStopped, err
	}
	return core.StatusRunning, nil
}

func (m *AnsibleModule) Configure(config map[string]interface{}) error {
	return nil
}

func (m *AnsibleModule) GetFacts() (map[string]string, error) {
	facts := make(map[string]string)
	out, err := exec.Command("ansible-playbook", "--version").Output()
	if err == nil {
		facts["version"] = string(out)
	}
	return facts, nil
}
