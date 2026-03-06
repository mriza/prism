package modules

import (
	"fitz-agent/internal/core"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type NginxModule struct {
	*SystemdModule
	AvailableDir string
	EnabledDir   string
}

func NewNginxModule() *NginxModule {
	return &NginxModule{
		SystemdModule: NewSystemdModule("nginx", "nginx", false),
		AvailableDir:  "/etc/nginx/sites-available",
		EnabledDir:    "/etc/nginx/sites-enabled",
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*NginxModule)(nil)
var _ core.WebServerModule = (*NginxModule)(nil)
var _ core.ProxyModule = (*NginxModule)(nil)

func (m *NginxModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("nginx", "-v").CombinedOutput() // nginx -v goes to stderr sometimes
	if err == nil {
		// Output format: "nginx version: nginx/1.18.0 (Ubuntu)"
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

// --- WebServerModule Implementation ---

func (m *NginxModule) ListSites() ([]string, error) {
	if _, err := os.Stat(m.AvailableDir); os.IsNotExist(err) {
		return []string{}, nil
	}

	files, err := os.ReadDir(m.AvailableDir)
	if err != nil {
		return nil, err
	}

	var sites []string
	for _, f := range files {
		if !f.IsDir() {
			name := f.Name()
			status := "disabled"

			// Check if enabled (symlinked)
			enabledPath := filepath.Join(m.EnabledDir, name)
			if _, err := os.Lstat(enabledPath); err == nil {
				status = "enabled"
			}

			sites = append(sites, fmt.Sprintf("%s (%s)", name, status))
		}
	}
	return sites, nil
}

func (m *NginxModule) CreateSite(name, content string) error {
	// Ensure dirs exist
	os.MkdirAll(m.AvailableDir, 0755)
	os.MkdirAll(m.EnabledDir, 0755)

	filename := filepath.Join(m.AvailableDir, name)
	if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
		return err
	}

	// Default to enabled? Or let user enable explicitly?
	// Let's enable by default for convenience, or follow EnableSite logic.
	// For now, just create. Let user enable in UI.
	return nil
}

func (m *NginxModule) DeleteSite(name string) error {
	m.DisableSite(name) // Remove symlink first
	return os.Remove(filepath.Join(m.AvailableDir, name))
}

func (m *NginxModule) EnableSite(name string) error {
	src := filepath.Join(m.AvailableDir, name)
	dst := filepath.Join(m.EnabledDir, name)

	if _, err := os.Stat(src); os.IsNotExist(err) {
		return fmt.Errorf("site configuration not found")
	}

	if err := os.Symlink(src, dst); err != nil {
		if os.IsExist(err) {
			return nil // Already enabled
		}
		return err
	}

	return m.Reload()
}

func (m *NginxModule) DisableSite(name string) error {
	dst := filepath.Join(m.EnabledDir, name)
	if err := os.Remove(dst); err != nil && !os.IsNotExist(err) {
		return err
	}
	return m.Reload()
}

func (m *NginxModule) Reload() error {
	// Validate configuration before reloading
	out, err := exec.Command("nginx", "-t").CombinedOutput()
	if err != nil {
		return fmt.Errorf("nginx config validation failed: %s", string(out))
	}
	return exec.Command("systemctl", "reload", "nginx").Run()
}

// --- ProxyModule Implementation ---

func (m *NginxModule) GetProxyType() string {
	return "nginx"
}

func (m *NginxModule) ListReverseProxies() ([]core.ProxyInfo, error) {
	if _, err := os.Stat(m.AvailableDir); os.IsNotExist(err) {
		return []core.ProxyInfo{}, nil
	}
	files, err := os.ReadDir(m.AvailableDir)
	if err != nil {
		return nil, err
	}
	var proxies []core.ProxyInfo
	for _, f := range files {
		if f.IsDir() {
			continue
		}
		name := f.Name()
		content, err := os.ReadFile(filepath.Join(m.AvailableDir, name))
		if err != nil {
			continue
		}
		// Check if enabled (has symlink in sites-enabled)
		_, symlinkErr := os.Lstat(filepath.Join(m.EnabledDir, name))
		enabled := symlinkErr == nil

		// Basic parse: look for server_name and proxy_pass
		lines := strings.Split(string(content), "\n")
		domain := ""
		upstream := ""
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "server_name") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					domain = strings.TrimSuffix(parts[1], ";")
				}
			}
			if strings.HasPrefix(line, "proxy_pass") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					upstream = strings.TrimSuffix(parts[1], ";")
				}
			}
		}
		if domain != "" {
			proxies = append(proxies, core.ProxyInfo{
				Domain:   domain,
				Upstream: upstream,
				Enabled:  enabled,
			})
		}
	}
	return proxies, nil
}

func (m *NginxModule) CreateReverseProxy(domain string, port int) error {
	os.MkdirAll(m.AvailableDir, 0755)
	os.MkdirAll(m.EnabledDir, 0755)

	content := fmt.Sprintf(`server {
    listen 80;
    server_name %s;

    location / {
        proxy_pass http://localhost:%d;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`, domain, port)

	sitePath := filepath.Join(m.AvailableDir, domain)
	if err := os.WriteFile(sitePath, []byte(content), 0644); err != nil {
		return err
	}
	// Enable by default (EnableSite already calls Reload internally)
	return m.EnableSite(domain)
}

func (m *NginxModule) DeleteReverseProxy(domain string) error {
	m.DisableSite(domain)
	os.Remove(filepath.Join(m.AvailableDir, domain))
	return m.Reload()
}
