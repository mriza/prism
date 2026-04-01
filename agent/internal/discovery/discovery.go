package discovery

import (
	"prism-agent/internal/config"
	"prism-agent/internal/core"
	"prism-agent/internal/modules"
	"os/exec"
)

// Standard services to check for
var standardServices = []struct {
	Name        string
	ServiceName string
	Type        string
}{
	// Web Servers
	{"nginx", "nginx", "systemd"},
	{"caddy", "caddy", "systemd"},
	
	// Databases
	{"mysql", "mysql", "systemd"},
	{"mariadb", "mariadb", "systemd"},
	{"postgresql", "postgresql", "systemd"},
	{"mongodb", "mongod", "systemd"},
	
	// Message Queues
	{"rabbitmq", "rabbitmq-server", "systemd"},
	{"mosquitto", "mosquitto", "systemd"},
	
	// Storage (S3)
	{"minio", "minio", "systemd"},
	{"garage", "garage", "systemd"},
	
	// FTP/SFTP
	{"vsftpd", "vsftpd", "systemd"},
	{"sftpgo", "sftpgo", "systemd"},
	
	// Cache/Database
	{"valkey", "valkey-server", "systemd"},
	{"redis", "redis-server", "systemd"},
	
	// Process Managers
	{"pm2", "pm2", "pm2"},
	{"supervisor", "supervisor", "supervisor"},
	
	// Security
	{"crowdsec", "crowdsec", "crowdsec"},
	
	// Others
	{"seaweedfs", "seaweedfs", "systemd"},
}

func Discover(registry *core.Registry, activeFirewall string) {
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
		} else if svc.Type == "crowdsec" {
			m := modules.NewCrowdSecModule()
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

	// Discover All Firewalls
	installedFirewalls := []core.ServiceModule{}

	if fwd := modules.NewFirewalldModule(); fwd.Install() == nil {
		installedFirewalls = append(installedFirewalls, fwd)
	}
	if ufw := modules.NewUFWModule(); ufw.Install() == nil {
		installedFirewalls = append(installedFirewalls, ufw)
	}
	if nft := modules.NewNftablesModule(); nft.Install() == nil {
		installedFirewalls = append(installedFirewalls, nft)
	}
	if ipt := modules.NewIptablesModule(); ipt.Install() == nil {
		installedFirewalls = append(installedFirewalls, ipt)
	}

	// Register them all
	var activeModule core.FirewallModule
	for _, hw := range installedFirewalls {
		// Only register if it wasn't somehow manually registered
		if _, err := registry.Get(hw.Name()); err != nil {
			registry.Register(hw)
		}
		
		// Determine which one should be active
		fwMod, _ := hw.(core.FirewallModule)
		if fwMod != nil {
			if activeFirewall != "" {
				if hw.Name() == activeFirewall {
					activeModule = fwMod
				}
			} else if activeModule == nil {
				// No config set, make the first discovered (highest priority based on order above) the active one
				activeModule = fwMod
			}
		}
	}

	// Apply Active state
	if activeModule != nil {
		for _, hw := range installedFirewalls {
			fwMod, _ := hw.(core.FirewallModule)
			if fwMod != nil {
				fwMod.SetActive(fwMod.TargetName() == activeModule.TargetName())
			}
		}
	}

	// Register specialized modules for databases, proxies, etc. (replacing generic systemd)
	// These provide the specialized interfaces for database management, web proxies, etc.
	// Only upgrade if currently registered as a generic SystemdModule.
	upgrades := map[string]func() core.ServiceModule{
		"caddy":      func() core.ServiceModule { return modules.NewCaddyModule() },
		"nginx":      func() core.ServiceModule { return modules.NewNginxModule() },
		"mysql":      func() core.ServiceModule { return modules.NewMySQLModule() },
		"mariadb":    func() core.ServiceModule { return modules.NewMySQLModule() },
		"postgresql": func() core.ServiceModule { return modules.NewPostgresModule() },
		"mongodb":    func() core.ServiceModule { return modules.NewMongoDBModule() },
		"rabbitmq":   func() core.ServiceModule { return modules.NewRabbitMQModule() },
		"mosquitto":  func() core.ServiceModule { return modules.NewMosquittoModule() },
		"minio":      func() core.ServiceModule { return modules.NewMinIOModule() },
		"garage":     func() core.ServiceModule { return modules.NewGarageModule() },
		"vsftpd":     func() core.ServiceModule { return modules.NewVsftpdModule() },
		"valkey":     func() core.ServiceModule { return modules.NewValkeyModule() },
	}

	for name, constructor := range upgrades {
		if mod, err := registry.Get(name); err == nil {
			if _, ok := mod.(*modules.SystemdModule); ok {
				registry.Unregister(name)
				registry.Register(constructor())
			}
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

// ExportConfig takes a registry of discovered modules and translates them
// into a slice of ServiceConfig for writing to TOML.
func ExportConfig(registry *core.Registry) []config.ServiceConfig {
	var services []config.ServiceConfig

	for _, name := range registry.List() {
		mod, err := registry.Get(name)
		if err != nil {
			continue
		}

		svcCfg := config.ServiceConfig{
			Name: mod.Name(),
		}

		// Try to identify the underlying module type to recreate its config
		switch m := mod.(type) {
		case *modules.SystemdModule:
			svcCfg.Type = "systemd"
			// SystemdModule inherently implements Name() interface differently
			// Let's use standard pattern matching to deduce service_name
			svcCfg.ServiceName = m.Name() // fallback
			for _, std := range standardServices {
				if std.Name == m.Name() {
					svcCfg.ServiceName = std.ServiceName
					break
				}
			}
		case *modules.CaddyModule:
			svcCfg.Type = "systemd"
			svcCfg.ServiceName = "caddy"
		case *modules.NginxModule:
			svcCfg.Type = "systemd"
			svcCfg.ServiceName = "nginx"
		case *modules.MySQLModule:
			svcCfg.Type = "systemd"
			svcCfg.ServiceName = "mysql"
		case *modules.RabbitMQModule:
			svcCfg.Type = "systemd"
			// Can be rabbitmq-server
			svcCfg.ServiceName = "rabbitmq-server"
		case *modules.MinIOModule:
			svcCfg.Type = "systemd"
			svcCfg.ServiceName = "minio"
		case *modules.GarageModule:
			svcCfg.Type = "systemd"
			svcCfg.ServiceName = "garage"
		case *modules.PM2Module:
			svcCfg.Type = "pm2"
		case *modules.UFWModule:
			svcCfg.Type = "ufw"
			svcCfg.ServiceName = "ufw"
		case *modules.FirewalldModule:
			svcCfg.Type = "firewalld"
		case *modules.IptablesModule:
			svcCfg.Type = "iptables"
		case *modules.NftablesModule:
			svcCfg.Type = "nftables"
		case *modules.AnsibleModule:
			svcCfg.Type = "ansible"
		default:
			svcCfg.Type = "unknown"
		}

		services = append(services, svcCfg)
	}

	return services
}
