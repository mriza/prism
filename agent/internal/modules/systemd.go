package modules

import (
	"fitz-agent/internal/core"
	"fmt"
	"os/exec"
)

type SystemdModule struct {
	name        string
	serviceName string
	userScope   bool
}

func NewSystemdModule(name, serviceName string, userScope bool) *SystemdModule {
	return &SystemdModule{
		name:        name,
		serviceName: serviceName,
		userScope:   userScope,
	}
}

func (m *SystemdModule) systemctlCmd(args ...string) *exec.Cmd {
	if m.userScope {
		// Insert --user after "systemctl"
		newArgs := append([]string{"--user"}, args...)
		return exec.Command("systemctl", newArgs...)
	}
	return exec.Command("systemctl", args...)
}

func (m *SystemdModule) Name() string {
	return m.name
}

func (m *SystemdModule) Install() error {
	// Simple check if service unit exists
	cmd := m.systemctlCmd("list-unit-files", m.serviceName+".service")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("service %s not found", m.serviceName)
	}
	return nil
}

func (m *SystemdModule) Start() error {
	cmd := m.systemctlCmd("start", m.serviceName)
	return cmd.Run()
}

func (m *SystemdModule) Stop() error {
	cmd := m.systemctlCmd("stop", m.serviceName)
	return cmd.Run()
}

func (m *SystemdModule) Restart() error {
	cmd := m.systemctlCmd("restart", m.serviceName)
	return cmd.Run()
}

func (m *SystemdModule) Status() (core.Status, error) {
	cmd := m.systemctlCmd("is-active", m.serviceName)
	if err := cmd.Run(); err != nil {
		return core.StatusStopped, nil
	}
	return core.StatusRunning, nil
}

func (m *SystemdModule) GetFacts() (map[string]string, error) {
	facts := make(map[string]string)
	
	// Get Uptime
	out, err := m.systemctlCmd("show", m.serviceName, "--property=ActiveEnterTimestamp").Output()
	if err == nil {
		facts["uptime_start"] = string(out)
	}

	// Get Memory Usage (approx)
	out, err = m.systemctlCmd("show", m.serviceName, "--property=MemoryCurrent").Output()
	if err == nil {
		facts["memory_usage"] = string(out)
	}

	return facts, nil
}

func (m *SystemdModule) Configure(config map[string]interface{}) error {
	return nil
}
