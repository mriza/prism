package modules

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"fitz-agent/internal/core"
)

// PM2App represents a process managed by PM2.
type PM2App struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	PID    int    `json:"pid"`
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
}

type pm2ProcessInfo struct {
	Name   string `json:"name"`
	Pm2Env struct {
		Status string `json:"status"`
	} `json:"pm2_env"`
	Pid   int `json:"pid"`
	Monit struct {
		CPU    float64 `json:"cpu"`
		Memory int64   `json:"memory"`
	} `json:"monit"`
}

type PM2Module struct{}

func NewPM2Module() *PM2Module {
	return &PM2Module{}
}

func (m *PM2Module) Name() string {
	return "pm2"
}

func (m *PM2Module) Install() error {
	_, err := exec.LookPath("pm2")
	if err != nil {
		return fmt.Errorf("pm2 not found")
	}
	return nil
}

func (m *PM2Module) Start() error {
	return exec.Command("pm2", "ping").Run()
}

func (m *PM2Module) Stop() error {
	return exec.Command("pm2", "kill").Run()
}

func (m *PM2Module) Restart() error {
	return exec.Command("pm2", "restart", "all").Run()
}

func (m *PM2Module) Status() (core.Status, error) {
	if err := exec.Command("pm2", "ping").Run(); err != nil {
		return core.StatusStopped, nil
	}
	return core.StatusRunning, nil
}

func (m *PM2Module) GetFacts() (map[string]string, error) {
	facts := map[string]string{"type": "pm2", "manager": "process-manager"}
	if out, err := exec.Command("pm2", "--version").Output(); err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	if apps, err := m.GetApps(); err == nil {
		facts["app_count"] = fmt.Sprintf("%d", len(apps))
	}
	return facts, nil
}

func (m *PM2Module) Configure(config map[string]interface{}) error {
	return nil
}

// GetApps returns the list of PM2-managed processes with status, PID and resource usage.
func (m *PM2Module) GetApps() ([]PM2App, error) {
	out, err := exec.Command("pm2", "jlist").Output()
	if err != nil {
		return nil, fmt.Errorf("pm2 jlist failed: %w", err)
	}

	var procs []pm2ProcessInfo
	if err := json.Unmarshal(out, &procs); err != nil {
		return nil, fmt.Errorf("pm2 jlist parse: %w", err)
	}

	apps := make([]PM2App, 0, len(procs))
	for _, p := range procs {
		apps = append(apps, PM2App{
			Name:   p.Name,
			Status: p.Pm2Env.Status,
			PID:    p.Pid,
			CPU:    fmt.Sprintf("%.1f%%", p.Monit.CPU),
			Memory: fmt.Sprintf("%d KB", p.Monit.Memory/1024),
		})
	}
	return apps, nil
}

// GetListenPort attempts to detect the TCP LISTEN port for a given PID via /proc/net/tcp*.
func GetListenPort(pid int) (int, error) {
	inodes, err := socketInodesForPID(pid)
	if err != nil || len(inodes) == 0 {
		return 0, fmt.Errorf("no sockets found for pid %d", pid)
	}
	for _, netFile := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		if port, err := findListenPortInFile(netFile, inodes); err == nil && port > 0 {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no listen port found for pid %d", pid)
}

func socketInodesForPID(pid int) (map[string]bool, error) {
	out, err := exec.Command("ls", "-la", fmt.Sprintf("/proc/%d/fd", pid)).Output()
	if err != nil {
		return nil, err
	}
	inodes := make(map[string]bool)
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		line := scanner.Text()
		if start := strings.Index(line, "socket:["); start >= 0 {
			if end := strings.Index(line[start:], "]"); end > 0 {
				inodes[line[start+8:start+end]] = true
			}
		}
	}
	return inodes, nil
}

func findListenPortInFile(netFile string, inodes map[string]bool) (int, error) {
	out, err := exec.Command("cat", netFile).Output()
	if err != nil {
		return 0, err
	}
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	scanner.Scan() // skip header
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 10 {
			continue
		}
		// state == 0A means TCP_LISTEN
		if fields[3] != "0A" || !inodes[fields[9]] {
			continue
		}
		parts := strings.Split(fields[1], ":")
		if len(parts) < 2 {
			continue
		}
		var port int
		fmt.Sscanf(parts[1], "%X", &port)
		if port > 0 {
			return port, nil
		}
	}
	return 0, fmt.Errorf("not found")
}
