package discovery

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strconv"
	"strings"
)

// DockerContainer represents a detected Docker container
type DockerContainer struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Image      string            `json:"image"`
	Status     string            `json:"status"`
	Ports      []string          `json:"ports"`
	Labels     map[string]string `json:"labels"`
	Created    string            `json:"created"`
	Networks   []string          `json:"networks"`
	Mounts     []string          `json:"mounts"`
	CPUPercent float64           `json:"cpu_percent"`
	MemUsage   string            `json:"mem_usage"`
	MemPercent float64           `json:"mem_percent"`
}

// PodmanContainer represents a detected Podman container
type PodmanContainer struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Image      string            `json:"image"`
	Status     string            `json:"status"`
	Ports      []string          `json:"ports"`
	Labels     map[string]string `json:"labels"`
	Created    string            `json:"created"`
	Networks   []string          `json:"networks"`
	Mounts     []string          `json:"mounts"`
	CPUPercent float64           `json:"cpu_percent"`
	MemUsage   string            `json:"mem_usage"`
	MemPercent float64           `json:"mem_percent"`
	Pod        string            `json:"pod,omitempty"`
}

// DockerInfo represents Docker daemon information
type DockerInfo struct {
	ID                string `json:"id"`
	Containers        int    `json:"containers"`
	ContainersRunning int    `json:"containers_running"`
	ContainersPaused  int    `json:"containers_paused"`
	ContainersStopped int    `json:"containers_stopped"`
	Images            int    `json:"images"`
	Driver            string `json:"driver"`
	ServerVersion     string `json:"server_version"`
	OperatingSystem   string `json:"operating_system"`
	OSType            string `json:"os_type"`
	Architecture      string `json:"architecture"`
}

// PodmanInfo represents Podman information
type PodmanInfo struct {
	Version   string `json:"version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	Kernel    string `json:"kernel"`
	BuildTime string `json:"build_time"`
	Rootless  bool   `json:"rootless"`
}

// DetectDocker detects Docker containers and daemon info
func DetectDocker() (*DockerInfo, []DockerContainer, error) {
	// Check if Docker is available
	if !commandExists("docker") {
		return nil, nil, fmt.Errorf("docker command not found")
	}

	// Check if Docker daemon is running
	if err := runCommand("docker", "info"); err != nil {
		return nil, nil, fmt.Errorf("docker daemon not running")
	}

	// Get Docker info
	dockerInfo, err := getDockerInfo()
	if err != nil {
		return nil, nil, err
	}

	// Get containers
	containers, err := getDockerContainers()
	if err != nil {
		return nil, nil, err
	}

	log.Printf("Detected Docker: %d containers (%d running)",
		dockerInfo.Containers, dockerInfo.ContainersRunning)

	return dockerInfo, containers, nil
}

// DetectPodman detects Podman containers and info
func DetectPodman() (*PodmanInfo, []PodmanContainer, error) {
	// Check if Podman is available
	if !commandExists("podman") {
		return nil, nil, fmt.Errorf("podman command not found")
	}

	// Get Podman info
	podmanInfo, err := getPodmanInfo()
	if err != nil {
		return nil, nil, err
	}

	// Get containers
	containers, err := getPodmanContainers()
	if err != nil {
		return nil, nil, err
	}

	log.Printf("Detected Podman: %d containers (rootless: %v)",
		len(containers), podmanInfo.Rootless)

	return podmanInfo, containers, nil
}

// Helper functions

func getDockerInfo() (*DockerInfo, error) {
	output, err := runCommandOutput("docker", "info", "--format", "{{json .}}")
	if err != nil {
		return nil, err
	}

	var info DockerInfo
	if err := json.Unmarshal([]byte(strings.TrimSpace(output)), &info); err != nil {
		return nil, err
	}

	return &info, nil
}

func getDockerContainers() ([]DockerContainer, error) {
	// Get container list with all details
	output, err := runCommandOutput("docker", "ps", "-a", "--format",
		"{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}")
	if err != nil {
		return nil, err
	}

	var containers []DockerContainer
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, "\t")
		if len(parts) < 6 {
			continue
		}

		container := DockerContainer{
			ID:     parts[0],
			Name:   parts[1],
			Image:  parts[2],
			Status: parseDockerStatus(parts[3]),
			Ports:  parsePorts(parts[4]),
			Labels: parseLabels(parts[5]),
		}

		// Get additional details
		getContainerDetails(&container)
		containers = append(containers, container)
	}

	return containers, nil
}

func getPodmanInfo() (*PodmanInfo, error) {
	output, err := runCommandOutput("podman", "info", "--format", "{{json .}}")
	if err != nil {
		return nil, err
	}

	// Podman info structure is different, parse manually
	var rawInfo map[string]interface{}
	if err := json.Unmarshal([]byte(strings.TrimSpace(output)), &rawInfo); err != nil {
		return nil, err
	}

	info := &PodmanInfo{}

	if version, ok := rawInfo["Version"].(map[string]interface{}); ok {
		if v, ok := version["Version"].(string); ok {
			info.Version = v
		}
	}

	if host, ok := rawInfo["Host"].(map[string]interface{}); ok {
		if dist, ok := host["Distribution"].(map[string]interface{}); ok {
			if d, ok := dist["Distribution"].(string); ok {
				info.OS = d
			}
		}
		if kernel, ok := host["Kernel"].(string); ok {
			info.Kernel = kernel
		}
	}

	// Check if rootless
	if security, ok := rawInfo["Security"].(map[string]interface{}); ok {
		info.Rootless = security["Rootless"] == true
	}

	return info, nil
}

func getPodmanContainers() ([]PodmanContainer, error) {
	output, err := runCommandOutput("podman", "ps", "-a", "--format",
		"{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}\t{{.Pod}}")
	if err != nil {
		return nil, err
	}

	var containers []PodmanContainer
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, "\t")
		if len(parts) < 7 {
			continue
		}

		container := PodmanContainer{
			ID:     parts[0],
			Name:   parts[1],
			Image:  parts[2],
			Status: parseDockerStatus(parts[3]),
			Ports:  parsePorts(parts[4]),
			Labels: parseLabels(parts[5]),
			Pod:    parts[6],
		}

		// Get additional details
		getPodmanContainerDetails(&container)
		containers = append(containers, container)
	}

	return containers, nil
}

func getContainerDetails(container *DockerContainer) {
	// Get stats
	if stats, err := runCommandOutput("docker", "stats", "--no-stream", "--format",
		"{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}", container.ID); err == nil {
		parts := strings.Split(strings.TrimSpace(stats), "\t")
		if len(parts) >= 3 {
			container.CPUPercent, _ = strconv.ParseFloat(strings.TrimSuffix(parts[0], "%"), 64)
			container.MemUsage = parts[1]
			container.MemPercent, _ = strconv.ParseFloat(strings.TrimSuffix(parts[2], "%"), 64)
		}
	}

	// Get networks
	if networks, err := runCommandOutput("docker", "inspect", "--format",
		"{{range $key, $value := .NetworkSettings.Networks}}{{$key}} {{end}}", container.ID); err == nil {
		container.Networks = strings.Fields(strings.TrimSpace(networks))
	}

	// Get mounts
	if mounts, err := runCommandOutput("docker", "inspect", "--format",
		"{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}", container.ID); err == nil {
		container.Mounts = strings.Fields(strings.TrimSpace(mounts))
	}

	// Get created time
	if inspect, err := runCommandOutput("docker", "inspect", "--format",
		"{{.Created}}", container.ID); err == nil {
		container.Created = strings.TrimSpace(inspect)
	}
}

func getPodmanContainerDetails(container *PodmanContainer) {
	// Get stats
	if stats, err := runCommandOutput("podman", "stats", "--no-stream", "--format",
		"{{.CPU}}\t{{.MemUsage}}\t{{.MemPerc}}", container.ID); err == nil {
		parts := strings.Split(strings.TrimSpace(stats), "\t")
		if len(parts) >= 3 {
			container.CPUPercent, _ = strconv.ParseFloat(strings.TrimSuffix(parts[0], "%"), 64)
			container.MemUsage = parts[1]
			container.MemPercent, _ = strconv.ParseFloat(strings.TrimSuffix(parts[2], "%"), 64)
		}
	}

	// Get networks
	if networks, err := runCommandOutput("podman", "inspect", "--format",
		"{{range $key, $value := .NetworkSettings.Networks}}{{$key}} {{end}}", container.ID); err == nil {
		container.Networks = strings.Fields(strings.TrimSpace(networks))
	}

	// Get mounts
	if mounts, err := runCommandOutput("podman", "inspect", "--format",
		"{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}", container.ID); err == nil {
		container.Mounts = strings.Fields(strings.TrimSpace(mounts))
	}
}

func parseDockerStatus(status string) string {
	// Extract running/stopped/exited status
	status = strings.ToLower(status)
	if strings.Contains(status, "running") {
		return "running"
	} else if strings.Contains(status, "paused") {
		return "paused"
	} else if strings.Contains(status, "exited") || strings.Contains(status, "dead") {
		return "stopped"
	}
	return "unknown"
}

func parsePorts(portsStr string) []string {
	if portsStr == "" {
		return nil
	}

	// Split by comma and clean up
	portList := strings.Split(portsStr, ", ")
	var ports []string
	for _, p := range portList {
		p = strings.TrimSpace(p)
		if p != "" {
			ports = append(ports, p)
		}
	}
	return ports
}

func parseLabels(labelsStr string) map[string]string {
	labels := make(map[string]string)
	if labelsStr == "" {
		return labels
	}

	// Labels format: key1=value1,key2=value2
	pairs := strings.Split(labelsStr, ",")
	for _, pair := range pairs {
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) == 2 {
			labels[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return labels
}

// IsDockerAvailable checks if Docker daemon is accessible
func IsDockerAvailable() bool {
	cmd := exec.Command("docker", "info")
	return cmd.Run() == nil
}

// IsPodmanAvailable checks if Podman is available
func IsPodmanAvailable() bool {
	return commandExists("podman")
}

// GetContainerByPort finds container by port mapping
func GetContainerByPort(port int) (*DockerContainer, error) {
	containers, err := getDockerContainers()
	if err != nil {
		return nil, err
	}

	portStr := fmt.Sprintf(":%d/", port)
	for _, c := range containers {
		for _, p := range c.Ports {
			if strings.Contains(p, portStr) {
				return &c, nil
			}
		}
	}

	return nil, fmt.Errorf("no container found with port %d", port)
}

// GetContainerByName finds container by name
func GetContainerByName(name string) (*DockerContainer, error) {
	containers, err := getDockerContainers()
	if err != nil {
		return nil, err
	}

	for _, c := range containers {
		if c.Name == name {
			return &c, nil
		}
	}

	return nil, fmt.Errorf("no container found with name %s", name)
}

// GetPodmanContainerByName finds Podman container by name
func GetPodmanContainerByName(name string) (*PodmanContainer, error) {
	containers, err := getPodmanContainers()
	if err != nil {
		return nil, err
	}

	for _, c := range containers {
		if c.Name == name {
			return &c, nil
		}
	}

	return nil, fmt.Errorf("no Podman container found with name %s", name)
}

// ExtractProjectFromLabels extracts project name from container labels
func ExtractProjectFromLabels(labels map[string]string) string {
	// Check common project labels
	projectLabels := []string{
		"com.docker.compose.project",
		"app.kubernetes.io/part-of",
		"project",
		"prism.project",
	}

	for _, label := range projectLabels {
		if value, ok := labels[label]; ok {
			return value
		}
	}

	return ""
}
