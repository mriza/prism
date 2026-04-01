package modules

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"prism-agent/internal/core"
)

const (
	appsBaseDir = "/opt/prism/apps"
)

// DeploymentModule handles application deployment via Git release artifacts.
// It is NOT a traditional ServiceModule (no install/start/stop of the module itself);
// instead it is registered as "deployment" and only responds to deploy_app commands.
type DeploymentModule struct{}

func NewDeploymentModule() *DeploymentModule {
	return &DeploymentModule{}
}

func (m *DeploymentModule) Name() string                                 { return "deployment" }
func (m *DeploymentModule) Install() error                               { return nil }
func (m *DeploymentModule) Start() error                                 { return nil }
func (m *DeploymentModule) Stop() error                                  { return nil }
func (m *DeploymentModule) Restart() error                               { return nil }
func (m *DeploymentModule) Status() (core.Status, error)                 { return core.StatusRunning, nil }
func (m *DeploymentModule) GetFacts() (map[string]string, error)         { return map[string]string{"type": "deployment"}, nil }
func (m *DeploymentModule) Configure(config map[string]interface{}) error { return nil }

// DeployConfig contains everything needed to deploy an application.
type DeployConfig struct {
	Name           string            `json:"name"`
	SourceURL      string            `json:"source_url"`
	SourceToken    string            `json:"source_token,omitempty"`
	Runtime        string            `json:"runtime"`         // nodejs, python, php, go, binary
	RuntimeVersion string            `json:"runtime_version"` // e.g. 18.x
	ProcessManager string            `json:"process_manager"` // pm2, systemd, supervisor
	StartCommand   string            `json:"start_command"`
	EnvVars        map[string]string `json:"env_vars,omitempty"`
	DomainName     string            `json:"domain_name,omitempty"`
	InternalPort   int               `json:"internal_port,omitempty"`
	ProxyType      string            `json:"proxy_type,omitempty"` // caddy, nginx, none
}

// DeployResult is returned to the Hub after a deployment completes.
type DeployResult struct {
	Success  bool   `json:"success"`
	Version  string `json:"version"`
	AppDir   string `json:"app_dir"`
	Message  string `json:"message"`
	Error    string `json:"error,omitempty"`
}

// DeployApp orchestrates the full deployment pipeline:
//  1. Fetch latest release info from GitHub/GitLab
//  2. Download the release tarball/zip
//  3. Extract to /opt/prism/apps/<name>/releases/<tag>/
//  4. Update symlink /opt/prism/apps/<name>/current → latest release
//  5. Configure and start/restart the process manager
func (m *DeploymentModule) DeployApp(cfg DeployConfig) DeployResult {
	log.Printf("[deployment] Starting deployment for %s from %s", cfg.Name, cfg.SourceURL)

	// 1. Resolve repo info and fetch latest release
	releaseTag, archiveURL, err := resolveLatestRelease(cfg.SourceURL, cfg.SourceToken)
	if err != nil {
		return DeployResult{Error: fmt.Sprintf("failed to resolve release: %v", err)}
	}
	log.Printf("[deployment] Latest release: %s, archive: %s", releaseTag, archiveURL)

	// 2. Prepare directories
	appDir := filepath.Join(appsBaseDir, cfg.Name)
	releaseDir := filepath.Join(appDir, "releases", releaseTag)
	currentLink := filepath.Join(appDir, "current")

	if err := os.MkdirAll(releaseDir, 0755); err != nil {
		return DeployResult{Error: fmt.Sprintf("failed to create release dir: %v", err)}
	}

	// 3. Download archive
	archivePath := filepath.Join(appDir, "release-"+releaseTag+".tar.gz")
	if err := downloadFile(archiveURL, archivePath, cfg.SourceToken); err != nil {
		// Try .zip
		archiveURL = strings.TrimSuffix(archiveURL, ".tar.gz") + ".zip"
		archivePath = filepath.Join(appDir, "release-"+releaseTag+".zip")
		if err2 := downloadFile(archiveURL, archivePath, cfg.SourceToken); err2 != nil {
			return DeployResult{Error: fmt.Sprintf("failed to download release: %v (tar: %v)", err2, err)}
		}
	}
	defer os.Remove(archivePath) // Cleanup archive after extraction

	// 4. Extract
	if strings.HasSuffix(archivePath, ".zip") {
		err = extractZip(archivePath, releaseDir)
	} else {
		err = extractTarGz(archivePath, releaseDir)
	}
	if err != nil {
		return DeployResult{Error: fmt.Sprintf("failed to extract release: %v", err)}
	}

	// 5. Update symlink
	os.Remove(currentLink)
	if err := os.Symlink(releaseDir, currentLink); err != nil {
		return DeployResult{Error: fmt.Sprintf("failed to create symlink: %v", err)}
	}

	// 6. Write env file
	if len(cfg.EnvVars) > 0 {
		envFile := filepath.Join(currentLink, ".env")
		var lines []string
		for k, v := range cfg.EnvVars {
			lines = append(lines, fmt.Sprintf("%s=%s", k, v))
		}
		if err := os.WriteFile(envFile, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
			log.Printf("[deployment] Warning: failed to write .env: %v", err)
		}
	}

	// 7. Configure process manager
	if err := configureProcess(cfg, currentLink); err != nil {
		return DeployResult{Error: fmt.Sprintf("process manager setup failed: %v", err)}
	}

	log.Printf("[deployment] Successfully deployed %s@%s to %s", cfg.Name, releaseTag, currentLink)

	return DeployResult{
		Success: true,
		Version: releaseTag,
		AppDir:  currentLink,
		Message: fmt.Sprintf("Deployed %s@%s successfully", cfg.Name, releaseTag),
	}
}

// resolveLatestRelease fetches the latest release info from GitHub API.
// Returns (tag, tarball_url, error).
func resolveLatestRelease(repoURL, token string) (string, string, error) {
	// Parse owner/repo from URL
	// Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
	repoURL = strings.TrimSuffix(repoURL, ".git")
	repoURL = strings.TrimSuffix(repoURL, "/")

	var apiURL string
	if strings.Contains(repoURL, "github.com") {
		parts := strings.Split(repoURL, "github.com/")
		if len(parts) < 2 {
			return "", "", fmt.Errorf("invalid GitHub URL: %s", repoURL)
		}
		apiURL = fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", parts[1])
	} else if strings.Contains(repoURL, "gitlab.com") {
		parts := strings.Split(repoURL, "gitlab.com/")
		if len(parts) < 2 {
			return "", "", fmt.Errorf("invalid GitLab URL: %s", repoURL)
		}
		// GitLab API uses URL-encoded project path
		projectPath := strings.ReplaceAll(parts[1], "/", "%2F")
		apiURL = fmt.Sprintf("https://gitlab.com/api/v4/projects/%s/releases/permalink/latest", projectPath)
	} else {
		return "", "", fmt.Errorf("unsupported git host: %s (only GitHub and GitLab are supported)", repoURL)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Accept", "application/json")
	if token != "" {
		if strings.Contains(repoURL, "github.com") {
			req.Header.Set("Authorization", "Bearer "+token)
		} else {
			req.Header.Set("PRIVATE-TOKEN", token)
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("API request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("API returned %d: %s", resp.StatusCode, string(body))
	}

	var release map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", "", fmt.Errorf("failed to parse release response: %v", err)
	}

	// GitHub
	if tag, ok := release["tag_name"].(string); ok {
		if tarball, ok := release["tarball_url"].(string); ok {
			return tag, tarball, nil
		}
		// Fallback: construct tarball URL
		parts := strings.Split(repoURL, "github.com/")
		if len(parts) >= 2 {
			return tag, fmt.Sprintf("https://api.github.com/repos/%s/tarball/%s", parts[1], tag), nil
		}
	}

	// GitLab
	if tag, ok := release["tag_name"].(string); ok {
		if sources, ok := release["assets"].(map[string]interface{}); ok {
			if sourcesList, ok := sources["sources"].([]interface{}); ok {
				for _, src := range sourcesList {
					if srcMap, ok := src.(map[string]interface{}); ok {
						if format, ok := srcMap["format"].(string); ok && format == "tar.gz" {
							if url, ok := srcMap["url"].(string); ok {
								return tag, url, nil
							}
						}
					}
				}
			}
		}
		// Fallback GitLab tarball URL
		parts := strings.Split(repoURL, "gitlab.com/")
		if len(parts) >= 2 {
			return tag, fmt.Sprintf("https://gitlab.com/%s/-/archive/%s/%s.tar.gz", parts[1], tag, tag), nil
		}
	}

	return "", "", fmt.Errorf("could not determine release tag or archive URL")
}

// downloadFile downloads a URL to a local file path.
func downloadFile(url, dest, token string) error {
	client := &http.Client{Timeout: 5 * time.Minute}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	if token != "" {
		if strings.Contains(url, "github.com") || strings.Contains(url, "githubusercontent.com") {
			req.Header.Set("Authorization", "Bearer "+token)
		} else {
			req.Header.Set("PRIVATE-TOKEN", token)
		}
	}
	req.Header.Set("Accept", "application/octet-stream")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

// extractTarGz extracts a .tar.gz archive to dest, flattening single-directory roots.
func extractTarGz(archivePath, dest string) error {
	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	prefix := ""
	firstEntry := true

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		// Detect and strip single root directory (common in GitHub tarballs: owner-repo-hash/)
		if firstEntry && header.Typeflag == tar.TypeDir {
			prefix = header.Name
			firstEntry = false
			continue
		}
		firstEntry = false

		name := header.Name
		if prefix != "" && strings.HasPrefix(name, prefix) {
			name = strings.TrimPrefix(name, prefix)
		}
		if name == "" {
			continue
		}

		target := filepath.Join(dest, name)

		// Security: prevent path traversal
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)) {
			continue
		}

		switch header.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0755)
			out, err := os.Create(target)
			if err != nil {
				return err
			}
			io.Copy(out, tr)
			out.Close()
			os.Chmod(target, os.FileMode(header.Mode))
		}
	}
	return nil
}

// extractZip extracts a .zip archive to dest, flattening single-directory roots.
func extractZip(archivePath, dest string) error {
	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer r.Close()

	// Detect common root prefix
	prefix := ""
	if len(r.File) > 0 {
		first := r.File[0].Name
		if strings.HasSuffix(first, "/") {
			allMatch := true
			for _, f := range r.File[1:] {
				if !strings.HasPrefix(f.Name, first) {
					allMatch = false
					break
				}
			}
			if allMatch {
				prefix = first
			}
		}
	}

	for _, f := range r.File {
		name := f.Name
		if prefix != "" {
			name = strings.TrimPrefix(name, prefix)
		}
		if name == "" || name == "." {
			continue
		}

		target := filepath.Join(dest, name)
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)) {
			continue
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(target, 0755)
			continue
		}

		os.MkdirAll(filepath.Dir(target), 0755)
		out, err := os.Create(target)
		if err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			out.Close()
			return err
		}
		io.Copy(out, rc)
		rc.Close()
		out.Close()
		os.Chmod(target, f.Mode())
	}
	return nil
}

// configureProcess sets up the process manager (PM2, systemd, or supervisor).
func configureProcess(cfg DeployConfig, appDir string) error {
	switch cfg.ProcessManager {
	case "pm2":
		return configurePM2(cfg, appDir)
	case "systemd":
		return configureSystemd(cfg, appDir)
	case "supervisor":
		return configureSupervisor(cfg, appDir)
	default:
		return fmt.Errorf("unsupported process manager: %s", cfg.ProcessManager)
	}
}

func configurePM2(cfg DeployConfig, appDir string) error {
	// Build PM2 ecosystem config
	ecosystem := map[string]interface{}{
		"apps": []map[string]interface{}{
			{
				"name":   cfg.Name,
				"cwd":    appDir,
				"script": cfg.StartCommand,
			},
		},
	}

	// Set interpreter based on runtime
	app := ecosystem["apps"].([]map[string]interface{})[0]
	switch cfg.Runtime {
	case "nodejs":
		app["interpreter"] = "node"
		// If start command is like "npm start", use npm as script
		if strings.HasPrefix(cfg.StartCommand, "npm ") || strings.HasPrefix(cfg.StartCommand, "yarn ") {
			parts := strings.SplitN(cfg.StartCommand, " ", 2)
			app["script"] = parts[0]
			if len(parts) > 1 {
				app["args"] = parts[1]
			}
			app["interpreter"] = "none"
		}
	case "python":
		app["interpreter"] = "python3"
	case "php":
		app["interpreter"] = "php"
	case "go", "binary":
		app["interpreter"] = "none"
	}

	if cfg.InternalPort > 0 {
		if app["env"] == nil {
			app["env"] = map[string]interface{}{}
		}
		app["env"].(map[string]interface{})["PORT"] = cfg.InternalPort
	}

	// Merge env vars
	if len(cfg.EnvVars) > 0 {
		if app["env"] == nil {
			app["env"] = map[string]interface{}{}
		}
		envMap := app["env"].(map[string]interface{})
		for k, v := range cfg.EnvVars {
			envMap[k] = v
		}
	}

	// Write ecosystem file
	ecoJSON, _ := json.MarshalIndent(ecosystem, "", "  ")
	ecoPath := filepath.Join(appDir, "ecosystem.config.json")
	if err := os.WriteFile(ecoPath, ecoJSON, 0644); err != nil {
		return fmt.Errorf("failed to write ecosystem config: %v", err)
	}

	// Delete existing PM2 process (ignore error if not exists) then start
	exec.Command("pm2", "delete", cfg.Name).Run()
	out, err := exec.Command("pm2", "start", ecoPath).CombinedOutput()
	if err != nil {
		return fmt.Errorf("pm2 start failed: %v, output: %s", err, string(out))
	}

	// Save PM2 process list
	exec.Command("pm2", "save").Run()
	return nil
}

func configureSystemd(cfg DeployConfig, appDir string) error {
	// Build env string
	var envLines []string
	for k, v := range cfg.EnvVars {
		envLines = append(envLines, fmt.Sprintf("Environment=%s=%s", k, v))
	}
	if cfg.InternalPort > 0 {
		envLines = append(envLines, fmt.Sprintf("Environment=PORT=%d", cfg.InternalPort))
	}

	// Determine ExecStart based on runtime
	execStart := cfg.StartCommand
	switch cfg.Runtime {
	case "nodejs":
		if strings.HasPrefix(execStart, "npm ") || strings.HasPrefix(execStart, "node ") {
			execStart = "/usr/bin/env " + execStart
		}
	case "python":
		if !strings.HasPrefix(execStart, "/") {
			execStart = "/usr/bin/env python3 " + execStart
		}
	case "php":
		if !strings.HasPrefix(execStart, "/") {
			execStart = "/usr/bin/env php " + execStart
		}
	}

	unit := fmt.Sprintf(`[Unit]
Description=PRISM App: %s
After=network.target

[Service]
Type=simple
WorkingDirectory=%s
ExecStart=%s
Restart=always
RestartSec=5
%s

[Install]
WantedBy=multi-user.target
`, cfg.Name, appDir, execStart, strings.Join(envLines, "\n"))

	unitName := fmt.Sprintf("prism-app-%s.service", cfg.Name)
	unitPath := filepath.Join("/etc/systemd/system", unitName)

	if err := os.WriteFile(unitPath, []byte(unit), 0644); err != nil {
		return fmt.Errorf("failed to write systemd unit: %v", err)
	}

	// Reload and restart
	if out, err := exec.Command("systemctl", "daemon-reload").CombinedOutput(); err != nil {
		return fmt.Errorf("daemon-reload failed: %v, %s", err, string(out))
	}
	if out, err := exec.Command("systemctl", "enable", unitName).CombinedOutput(); err != nil {
		return fmt.Errorf("enable failed: %v, %s", err, string(out))
	}
	if out, err := exec.Command("systemctl", "restart", unitName).CombinedOutput(); err != nil {
		return fmt.Errorf("restart failed: %v, %s", err, string(out))
	}
	return nil
}

func configureSupervisor(cfg DeployConfig, appDir string) error {
	var envLine string
	envParts := []string{}
	for k, v := range cfg.EnvVars {
		envParts = append(envParts, fmt.Sprintf("%s=\"%s\"", k, v))
	}
	if cfg.InternalPort > 0 {
		envParts = append(envParts, fmt.Sprintf("PORT=\"%d\"", cfg.InternalPort))
	}
	if len(envParts) > 0 {
		envLine = fmt.Sprintf("environment=%s", strings.Join(envParts, ","))
	}

	command := cfg.StartCommand
	switch cfg.Runtime {
	case "python":
		if !strings.HasPrefix(command, "/") {
			command = "python3 " + command
		}
	case "php":
		if !strings.HasPrefix(command, "/") {
			command = "php " + command
		}
	}

	conf := fmt.Sprintf(`[program:prism-%s]
command=%s
directory=%s
autostart=true
autorestart=true
startsecs=5
redirect_stderr=true
stdout_logfile=/var/log/prism-%s.log
%s
`, cfg.Name, command, appDir, cfg.Name, envLine)

	confPath := filepath.Join("/etc/supervisor/conf.d", fmt.Sprintf("prism-%s.conf", cfg.Name))
	if err := os.WriteFile(confPath, []byte(conf), 0644); err != nil {
		return fmt.Errorf("failed to write supervisor conf: %v", err)
	}

	out, err := exec.Command("supervisorctl", "reread").CombinedOutput()
	if err != nil {
		return fmt.Errorf("supervisorctl reread failed: %v, %s", err, string(out))
	}
	out, err = exec.Command("supervisorctl", "update").CombinedOutput()
	if err != nil {
		return fmt.Errorf("supervisorctl update failed: %v, %s", err, string(out))
	}
	return nil
}
