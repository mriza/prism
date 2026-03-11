package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type CaddyModule struct {
	*SystemdModule
	ConfigDir string
}

func NewCaddyModule() *CaddyModule {
	return &CaddyModule{
		SystemdModule: NewSystemdModule("caddy", "caddy", false),
		ConfigDir:     "/etc/caddy/conf.d",
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*CaddyModule)(nil)
var _ core.WebServerModule = (*CaddyModule)(nil)
var _ core.ProxyModule = (*CaddyModule)(nil)

func (m *CaddyModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("caddy", "version").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

// --- WebServerModule Implementation ---

func (m *CaddyModule) ListSites() ([]string, error) {
	// Ensure config dir exists
	if _, err := os.Stat(m.ConfigDir); os.IsNotExist(err) {
		return []string{}, nil
	}

	files, err := os.ReadDir(m.ConfigDir)
	if err != nil {
		return nil, err
	}

	var sites []string
	for _, f := range files {
		if !f.IsDir() {
			name := f.Name()
			if strings.HasSuffix(name, ".caddy") {
				sites = append(sites, strings.TrimSuffix(name, ".caddy")+" (enabled)")
			} else if strings.HasSuffix(name, ".disabled") {
				sites = append(sites, strings.TrimSuffix(name, ".disabled")+" (disabled)")
			}
		}
	}
	return sites, nil
}

func (m *CaddyModule) CreateSite(name, content string) error {
	// Ensure config dir exists
	if _, err := os.Stat(m.ConfigDir); os.IsNotExist(err) {
		if err := os.MkdirAll(m.ConfigDir, 0755); err != nil {
			return err
		}
	}

	filename := filepath.Join(m.ConfigDir, name+".caddy")
	if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
		return err
	}

	return m.Reload()
}

func (m *CaddyModule) DeleteSite(name string) error {
	// Try deleting enabled and disabled versions
	enabledPath := filepath.Join(m.ConfigDir, name+".caddy")
	disabledPath := filepath.Join(m.ConfigDir, name+".disabled")

	os.Remove(enabledPath)
	os.Remove(disabledPath)

	return m.Reload()
}

func (m *CaddyModule) EnableSite(name string) error {
	disabledPath := filepath.Join(m.ConfigDir, name+".disabled")
	enabledPath := filepath.Join(m.ConfigDir, name+".caddy")

	if _, err := os.Stat(disabledPath); err == nil {
		if err := os.Rename(disabledPath, enabledPath); err != nil {
			return err
		}
		return m.Reload()
	}
	return fmt.Errorf("site not found or already enabled")
}

func (m *CaddyModule) DisableSite(name string) error {
	enabledPath := filepath.Join(m.ConfigDir, name+".caddy")
	disabledPath := filepath.Join(m.ConfigDir, name+".disabled")

	if _, err := os.Stat(enabledPath); err == nil {
		if err := os.Rename(enabledPath, disabledPath); err != nil {
			return err
		}
		return m.Reload()
	}
	return fmt.Errorf("site not found or already disabled")
}

func (m *CaddyModule) Reload() error {
	return exec.Command("systemctl", "reload", "caddy").Run()
}

// --- ProxyModule Implementation ---

func (m *CaddyModule) GetProxyType() string {
	return "caddy"
}

func (m *CaddyModule) ListReverseProxies() ([]core.ProxyInfo, error) {
	if _, err := os.Stat(m.ConfigDir); os.IsNotExist(err) {
		return []core.ProxyInfo{}, nil
	}
	files, err := os.ReadDir(m.ConfigDir)
	if err != nil {
		return nil, err
	}
	var proxies []core.ProxyInfo
	for _, f := range files {
		if f.IsDir() {
			continue
		}
		name := f.Name()
		enabled := strings.HasSuffix(name, ".caddy")
		if !enabled && !strings.HasSuffix(name, ".disabled") {
			continue
		}
		content, err := os.ReadFile(filepath.Join(m.ConfigDir, name))
		if err != nil {
			continue
		}
		// Basic parse: first non-blank line is domain, look for reverse_proxy
		lines := strings.Split(string(content), "\n")
		domain := ""
		upstream := ""
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if domain == "" {
				domain = strings.TrimSuffix(line, " {")
				domain = strings.TrimSpace(domain)
				continue
			}
			if strings.HasPrefix(line, "reverse_proxy") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					upstream = parts[1]
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

func (m *CaddyModule) CreateReverseProxy(domain string, port int) error {
	if _, err := os.Stat(m.ConfigDir); os.IsNotExist(err) {
		if err := os.MkdirAll(m.ConfigDir, 0755); err != nil {
			return err
		}
	}
	content := fmt.Sprintf("%s {\n  reverse_proxy localhost:%d\n}\n", domain, port)
	filename := filepath.Join(m.ConfigDir, domain+".caddy")
	if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
		return err
	}
	return m.Reload()
}

func (m *CaddyModule) DeleteReverseProxy(domain string) error {
	for _, ext := range []string{".caddy", ".disabled"} {
		os.Remove(filepath.Join(m.ConfigDir, domain+ext))
	}
	return m.Reload()
}

// --- ConfigurableModule Implementation ---

func (m *CaddyModule) GetConfigPath() string {
	return "/etc/caddy/Caddyfile"
}

func (m *CaddyModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *CaddyModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}
