package discovery

import (
	"fitz-agent/internal/core"
	"fitz-agent/internal/modules"
	"os/exec"
)

// Standard services to check for
var standardServices = []struct {
	Name        string
	ServiceName string
	Type        string
}{
	{"nginx", "nginx", "systemd"},
	{"caddy", "caddy", "systemd"},
	{"mysql", "mysql", "systemd"},
	{"postgresql", "postgresql", "systemd"},
	{"mongodb", "mongod", "systemd"},
	{"rabbitmq", "rabbitmq-server", "systemd"},
	{"minio", "minio", "systemd"},
	{"garage", "garage", "systemd"},
	{"sftpgo", "sftpgo", "systemd"},
	{"seaweedfs", "seaweedfs", "systemd"},
	{"ufw", "ufw", "ufw"}, // Special type
}

func Discover(registry *core.Registry) {
	// Check standard systemd services
	for _, svc := range standardServices {
		// Don't overwrite if already registered (from config)
		if _, err := registry.Get(svc.Name); err == nil {
			continue
		}

		if svc.Type == "systemd" {
			// Check if unit file exists
			if err := exec.Command("systemctl", "list-unit-files", svc.ServiceName+".service").Run(); err == nil {
				// Installed! Register it.
				m := modules.NewSystemdModule(svc.Name, svc.ServiceName, false)
				registry.Register(m)
			}
		} else if svc.Type == "ufw" {
			m := modules.NewUFWModule()
			if err := m.Install(); err == nil {
				registry.Register(m)
			}
		}
	}

	// Discover PM2 (not a systemd service)
	if _, err := registry.Get("pm2"); err != nil {
		m := modules.NewPM2Module()
		if err := m.Install(); err == nil {
			registry.Register(m)
		}
	}

	// Register specialized modules for Caddy/Nginx (replacing generic systemd)
	// These provide the ProxyModule interface for reverse proxy management.
	// Only upgrade if currently registered as a generic SystemdModule.
	if mod, err := registry.Get("caddy"); err == nil {
		if _, ok := mod.(*modules.CaddyModule); !ok {
			registry.Unregister("caddy")
			registry.Register(modules.NewCaddyModule())
		}
	}
	if mod, err := registry.Get("nginx"); err == nil {
		if _, ok := mod.(*modules.NginxModule); !ok {
			registry.Unregister("nginx")
			registry.Register(modules.NewNginxModule())
		}
	}
}

// DetectProxy checks the registry for a module that implements ProxyModule
// and returns its type ("caddy", "nginx") or "none" if no proxy is found.
func DetectProxy(registry *core.Registry) string {
	for _, name := range []string{"caddy", "nginx"} {
		if mod, err := registry.Get(name); err == nil {
			if pm, ok := mod.(core.ProxyModule); ok {
				return pm.GetProxyType()
			}
		}
	}
	return "none"
}

// GetProxyModule returns the ProxyModule if one is detected, or nil.
func GetProxyModule(registry *core.Registry) core.ProxyModule {
	for _, name := range []string{"caddy", "nginx"} {
		if mod, err := registry.Get(name); err == nil {
			if pm, ok := mod.(core.ProxyModule); ok {
				return pm
			}
		}
	}
	return nil
}
