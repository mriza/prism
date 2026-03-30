package discovery

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// commandExists checks if a command is available in PATH
func commandExists(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

// runCommand executes a command and returns error if any
func runCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	return cmd.Run()
}

// runCommandOutput executes a command and returns stdout
func runCommandOutput(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	return out.String(), err
}

// PM2Process represents a PM2-managed process
type PM2Process struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Version    string `json:"version"`
	Mode       string `json:"mode"` // fork or cluster
	Instances  int    `json:"instances"`
	Status     string `json:"status"` // online, stopped, errored
	CPU        string `json:"cpu"`
	Mem        string `json:"mem"`
	Uptime     string `json:"uptime"`
	Restarts   int    `json:"restarts"`
	Script     string `json:"script"`
	Cwd        string `json:"cwd"`
	ExecInterp string `json:"exec_interpreter"`
	LogPath    string `json:"log_path"`
	ErrLogPath string `json:"err_log_path"`
	Port       int    `json:"port,omitempty"`
	PID        int    `json:"pid,omitempty"`
}

// SupervisorProgram represents a Supervisor-managed program
type SupervisorProgram struct {
	Name       string `json:"name"`
	Group      string `json:"group"`
	Status     string `json:"status"` // RUNNING, STOPPED, FATAL
	PID        int    `json:"pid"`
	Uptime     string `json:"uptime"`
	ExitStatus int    `json:"exit_status"`
	LogFile    string `json:"log_file"`
	StdoutLog  string `json:"stdout_log"`
	StderrLog  string `json:"stderr_log"`
	AutoStart  bool   `json:"auto_start"`
	Enabled    bool   `json:"enabled"`
}

// SystemdUserUnit represents a systemd user service
type SystemdUserUnit struct {
	Unit        string `json:"unit"`
	Load        string `json:"load"`   // loaded, not-found
	Active      string `json:"active"` // active, inactive, failed
	Sub         string `json:"sub"`    // running, exited, dead
	Description string `json:"description"`
	User        string `json:"user"`
	Enabled     bool   `json:"enabled"`
	PID         int    `json:"pid"`
	Memory      string `json:"memory"`
}

// PM2Info represents PM2 daemon information
type PM2Info struct {
	Version   string `json:"version"`
	Home      string `json:"home"`
	Processes int    `json:"processes"`
	Running   int    `json:"running"`
	Stopped   int    `json:"stopped"`
	Errored   int    `json:"errored"`
}

// DetectPM2 detects PM2 processes
func DetectPM2() (*PM2Info, []PM2Process, error) {
	// Check if PM2 is available
	if !commandExists("pm2") {
		return nil, nil, fmt.Errorf("pm2 command not found")
	}

	// Check if PM2 daemon is running
	if err := runCommand("pm2", "ping"); err != nil {
		return nil, nil, fmt.Errorf("pm2 daemon not running")
	}

	// Get PM2 version
	version, _ := runCommandOutput("pm2", "-v")
	version = strings.TrimSpace(version)

	// Get process list
	processes, err := getPM2Processes()
	if err != nil {
		return nil, nil, err
	}

	// Count by status
	running := 0
	stopped := 0
	errored := 0
	for _, p := range processes {
		switch p.Status {
		case "online":
			running++
		case "stopped":
			stopped++
		case "errored", "launching":
			errored++
		}
	}

	info := &PM2Info{
		Version:   version,
		Processes: len(processes),
		Running:   running,
		Stopped:   stopped,
		Errored:   errored,
	}

	log.Printf("Detected PM2: %d processes (%d running)", len(processes), running)
	return info, processes, nil
}

// DetectSupervisor detects Supervisor processes
func DetectSupervisor() ([]SupervisorProgram, error) {
	// Check if supervisorctl is available
	if !commandExists("supervisorctl") {
		return nil, fmt.Errorf("supervisorctl command not found")
	}

	// Get program list
	output, err := runCommandOutput("supervisorctl", "status")
	if err != nil {
		return nil, err
	}

	programs := parseSupervisorStatus(output)
	log.Printf("Detected Supervisor: %d programs", len(programs))
	return programs, nil
}

// DetectSystemdUserServices detects systemd user services for specified users
func DetectSystemdUserServices(users []string) ([]SystemdUserUnit, error) {
	var allUnits []SystemdUserUnit

	for _, username := range users {
		units, err := getUserSystemdUnits(username)
		if err != nil {
			log.Printf("Warning: failed to get systemd units for user %s: %v", username, err)
			continue
		}
		allUnits = append(allUnits, units...)
	}

	log.Printf("Detected systemd user services: %d units", len(allUnits))
	return allUnits, nil
}

// Helper functions

func getPM2Processes() ([]PM2Process, error) {
	// Get JSON output from PM2
	output, err := runCommandOutput("pm2", "jlist")
	if err != nil {
		return nil, err
	}

	var rawProcesses []map[string]interface{}
	if err := json.Unmarshal([]byte(output), &rawProcesses); err != nil {
		return nil, err
	}

	var processes []PM2Process
	for _, raw := range rawProcesses {
		process := PM2Process{}

		if id, ok := raw["pm_id"].(float64); ok {
			process.ID = int(id)
		}
		if name, ok := raw["name"].(string); ok {
			process.Name = name
		}
		if version, ok := raw["version"].(string); ok {
			process.Version = version
		}
		if mode, ok := raw["exec_mode"].(string); ok {
			process.Mode = mode
		}
		if instances, ok := raw["instances"].(float64); ok {
			process.Instances = int(instances)
		}
		if status, ok := raw["pm_status"].(string); ok {
			process.Status = status
		}
		if cpu, ok := raw["monit"].(map[string]interface{}); ok {
			if cpuVal, ok := cpu["cpu"].(float64); ok {
				process.CPU = fmt.Sprintf("%.1f%%", cpuVal)
			}
			if mem, ok := cpu["memory"].(float64); ok {
				process.Mem = formatBytes(uint64(mem))
			}
		}
		if pidInfo, ok := raw["pid"].(map[string]interface{}); ok {
			if pids, ok := pidInfo["pids"].([]interface{}); ok && len(pids) > 0 {
				// Get first PID
				if pid, ok := pids[0].(float64); ok {
					process.PID = int(pid)
				}
			}
		}
		if restarts, ok := raw["pm_uptime"].(map[string]interface{}); ok {
			if r, ok := restarts["restart_time"].(float64); ok {
				process.Restarts = int(r)
			}
		}
		if pmExecConf, ok := raw["pm_exec_path"].(string); ok {
			process.Script = pmExecConf
		}
		if pmCwd, ok := raw["pm_cwd"].(string); ok {
			process.Cwd = pmCwd
		}
		if execInterp, ok := raw["exec_interpreter"].(string); ok {
			process.ExecInterp = execInterp
		}

		// Get port from env
		if env, ok := raw["pm2_env"].(map[string]interface{}); ok {
			if port, ok := env["PORT"].(string); ok {
				process.Port, _ = strconv.Atoi(port)
			}
		}

		processes = append(processes, process)
	}

	return processes, nil
}

func parseSupervisorStatus(output string) []SupervisorProgram {
	var programs []SupervisorProgram
	scanner := bufio.NewScanner(strings.NewReader(output))

	// Pattern: program_name                     RUNNING   pid 12345, uptime 0:01:23
	statusPattern := regexp.MustCompile(`^(\S+)\s+(\S+)?\s+(\w+)\s+(.*)$`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "No config") {
			continue
		}

		matches := statusPattern.FindStringSubmatch(line)
		if len(matches) < 5 {
			continue
		}

		program := SupervisorProgram{
			Name:   matches[1],
			Status: matches[3],
		}

		// Parse group if present
		if matches[2] != "" && matches[2] != ":" {
			program.Group = matches[2]
		}

		// Parse additional info
		extra := matches[4]
		if strings.Contains(extra, "pid") {
			pidMatch := regexp.MustCompile(`pid (\d+)`).FindStringSubmatch(extra)
			if len(pidMatch) > 1 {
				program.PID, _ = strconv.Atoi(pidMatch[1])
			}
		}
		if strings.Contains(extra, "uptime") {
			uptimeMatch := regexp.MustCompile(`uptime (.+)$`).FindStringSubmatch(extra)
			if len(uptimeMatch) > 1 {
				program.Uptime = strings.TrimSpace(uptimeMatch[1])
			}
		}
		if strings.Contains(extra, "exit") {
			exitMatch := regexp.MustCompile(`exit (\d+)`).FindStringSubmatch(extra)
			if len(exitMatch) > 1 {
				program.ExitStatus, _ = strconv.Atoi(exitMatch[1])
			}
		}

		programs = append(programs, program)
	}

	return programs
}

func getUserSystemdUnits(username string) ([]SystemdUserUnit, error) {
	// Check if user has systemd running
	// Use machinectl or sudo to access user session
	var output string
	var err error

	// Try with machinectl first
	if commandExists("machinectl") {
		output, err = runCommandOutput("machinectl", "shell", username, "--",
			"systemctl", "--user", "list-units", "--type=service", "--all", "--no-pager")
	} else if commandExists("sudo") {
		// Fallback to sudo
		output, err = runCommandOutput("sudo", "-u", username,
			"systemctl", "--user", "list-units", "--type=service", "--all", "--no-pager")
	} else {
		return nil, fmt.Errorf("neither machinectl nor sudo available")
	}

	if err != nil {
		return nil, err
	}

	return parseSystemdUnits(output, username)
}

func parseSystemdUnits(output, username string) ([]SystemdUserUnit, error) {
	var units []SystemdUserUnit
	scanner := bufio.NewScanner(strings.NewReader(output))

	// Pattern: unit.service loaded active running Description
	unitPattern := regexp.MustCompile(`^(\S+)\s+(loaded|not-found)\s+(active|inactive|failed)\s+(\S+)\s+(.*)$`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "UNIT") || strings.Contains(line, "loaded units") {
			continue
		}

		matches := unitPattern.FindStringSubmatch(line)
		if len(matches) < 6 {
			continue
		}

		unit := SystemdUserUnit{
			Unit:        matches[1],
			Load:        matches[2],
			Active:      matches[3],
			Sub:         matches[4],
			Description: strings.TrimSpace(matches[5]),
			User:        username,
		}

		// Get PID if running
		if unit.Active == "active" && unit.Sub == "running" {
			pid, _ := getSystemdUnitPID(username, unit.Unit)
			unit.PID = pid
		}

		units = append(units, unit)
	}

	return units, nil
}

func getSystemdUnitPID(username, unit string) (int, error) {
	var output string
	var err error

	if commandExists("machinectl") {
		output, err = runCommandOutput("machinectl", "shell", username, "--",
			"systemctl", "--user", "show", unit, "--property=MainPID")
	} else {
		output, err = runCommandOutput("sudo", "-u", username,
			"systemctl", "--user", "show", unit, "--property=MainPID")
	}

	if err != nil {
		return 0, err
	}

	// Parse MainPID=12345
	parts := strings.Split(strings.TrimSpace(output), "=")
	if len(parts) == 2 {
		pid, _ := strconv.Atoi(parts[1])
		return pid, nil
	}

	return 0, fmt.Errorf("could not parse PID")
}

func formatBytes(bytes uint64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := uint64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// IsPM2Available checks if PM2 is available and running
func IsPM2Available() bool {
	if !commandExists("pm2") {
		return false
	}
	return runCommand("pm2", "ping") == nil
}

// IsSupervisorAvailable checks if Supervisor is available
func IsSupervisorAvailable() bool {
	return commandExists("supervisorctl")
}

// GetPM2ProcessByName finds PM2 process by name
func GetPM2ProcessByName(name string) (*PM2Process, error) {
	_, processes, err := DetectPM2()
	if err != nil {
		return nil, err
	}

	for _, p := range processes {
		if p.Name == name {
			return &p, nil
		}
	}

	return nil, fmt.Errorf("no PM2 process found with name %s", name)
}

// GetSupervisorProgramByName finds Supervisor program by name
func GetSupervisorProgramByName(name string) (*SupervisorProgram, error) {
	programs, err := DetectSupervisor()
	if err != nil {
		return nil, err
	}

	for _, p := range programs {
		if p.Name == name {
			return &p, nil
		}
	}

	return nil, fmt.Errorf("no Supervisor program found with name %s", name)
}

// ExtractProjectFromPM2Name extracts project name from PM2 process name
func ExtractProjectFromPM2Name(name string) string {
	// Common patterns: project-api, project-worker, @scope/project-name
	parts := strings.Split(name, "-")
	if len(parts) > 1 {
		return parts[0]
	}

	// Check for scoped package
	if strings.HasPrefix(name, "@") {
		parts := strings.SplitN(name, "/", 2)
		if len(parts) == 2 {
			scopeParts := strings.Split(parts[0], "-")
			if len(scopeParts) > 1 {
				return scopeParts[0][1:] // Remove @ prefix
			}
		}
	}

	return ""
}

// ListPM2Users finds all users with PM2 installed
func ListPM2Users() ([]string, error) {
	var users []string

	// Check common PM2 home locations
	homeDir, _ := os.UserHomeDir()
	pm2Homes := []string{
		filepath.Join(homeDir, ".pm2"),
		"/root/.pm2",
	}

	for _, pm2Home := range pm2Homes {
		if _, err := os.Stat(pm2Home); err == nil {
			// Extract username from path
			parts := strings.Split(pm2Home, "/")
			for i, part := range parts {
				if part == "home" && i+1 < len(parts) {
					users = append(users, parts[i+1])
				} else if part == "root" {
					users = append(users, "root")
				}
			}
		}
	}

	return users, nil
}
