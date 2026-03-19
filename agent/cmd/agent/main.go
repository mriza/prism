package main

import (
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/signal"
	"prism-agent/internal/config"
	"prism-agent/internal/core"
	"prism-agent/internal/discovery"
	"prism-agent/internal/modules"
	"prism-agent/internal/protocol"
	"runtime"
	"strings"
	"time"

	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", "prism-agent.conf", "Path to configuration file")
	generateConfig := flag.Bool("generate-config", false, "Auto-discover services and generate prism-agent.conf")
	flag.Parse()

	if *generateConfig {
		log.Println("Starting auto-discovery to generate config...")
		registry := core.NewRegistry()
		discovery.Discover(registry, "")

		services := discovery.ExportConfig(registry)
		cfg := config.Config{
			Server: config.ServerConfig{
				Port: 0,
			},
			Hub: config.HubConfig{
				URL:   "ws://192.168.122.230:65432/agent/connect",
				Token: "replace_with_actual_token",
			},
			Services: services,
		}

		err := config.Save(&cfg, "prism-agent.conf")
		if err != nil {
			log.Fatalf("Failed to generate config: %v", err)
		}

		log.Println("Successfully generated prism-agent.conf")
		os.Exit(0)
	}

	// Load configuration with auto-token loading
	cfg, err := config.LoadWithAutoToken(*configPath)
	if err != nil {
		log.Printf("Config not found at %s: %v", *configPath, err)
		cfg = &config.Config{} // Use empty defaults so auto-discovery still works
	}

	// Initialize Registry
	registry := core.NewRegistry()

	// Register Service Modules based on Configuration
	for _, svcCfg := range cfg.Services {
		switch svcCfg.Type {
		case "systemd":
			switch svcCfg.Name {
			// Databases
			case "mysql", "mariadb":
				registry.Register(modules.NewMySQLModule())
				log.Printf("Registered MySQL module: %s", svcCfg.Name)
			case "postgresql", "postgres":
				registry.Register(modules.NewPostgresModule())
				log.Printf("Registered PostgreSQL module: %s", svcCfg.Name)
			case "mongodb", "mongod":
				registry.Register(modules.NewMongoDBModule())
				log.Printf("Registered MongoDB module: %s", svcCfg.Name)

			// Message Queues & MQTT
			case "rabbitmq":
				registry.Register(modules.NewRabbitMQModule())
				log.Printf("Registered RabbitMQ module: %s", svcCfg.Name)
			case "mosquitto":
				registry.Register(modules.NewMosquittoModule())
				log.Printf("Registered Mosquitto module: %s", svcCfg.Name)

			// Web Servers
			case "nginx":
				registry.Register(modules.NewNginxModule())
				log.Printf("Registered Nginx module: %s", svcCfg.Name)
			case "caddy":
				registry.Register(modules.NewCaddyModule())
				log.Printf("Registered Caddy module: %s", svcCfg.Name)

			// Storage (S3)
			case "minio":
				registry.Register(modules.NewMinIOModule())
				log.Printf("Registered MinIO module: %s", svcCfg.Name)
			case "garage":
				registry.Register(modules.NewGarageModule())
				log.Printf("Registered Garage module: %s", svcCfg.Name)
			case "seaweedfs", "seaweed":
				registry.Register(modules.NewSystemdModule(svcCfg.Name, svcCfg.ServiceName, svcCfg.UserScope))
				log.Printf("Registered SeaweedFS module: %s", svcCfg.Name)

			// FTP/SFTP
			case "vsftpd":
				registry.Register(modules.NewVsftpdModule())
				log.Printf("Registered VSFTPD module: %s", svcCfg.Name)
			case "sftpgo":
				registry.Register(modules.NewSystemdModule(svcCfg.Name, svcCfg.ServiceName, svcCfg.UserScope))
				log.Printf("Registered SFTPGo module (systemd): %s", svcCfg.Name)

			// Cache/Database
			case "valkey", "valkey-server":
				registry.Register(modules.NewValkeyModule())
				log.Printf("Registered Valkey module: %s", svcCfg.Name)
			case "redis", "redis-server":
				registry.Register(modules.NewSystemdModule(svcCfg.Name, svcCfg.ServiceName, svcCfg.UserScope))
				log.Printf("Registered Redis module: %s", svcCfg.Name)

			// Default systemd service
			default:
				registry.Register(modules.NewSystemdModule(svcCfg.Name, svcCfg.ServiceName, svcCfg.UserScope))
				log.Printf("Registered systemd service (config): %s", svcCfg.Name)
			}
		case "pm2":
			registry.Register(modules.NewPM2Module())
			log.Printf("Registered pm2 module (config): %s", svcCfg.Name)
		case "supervisor":
			registry.Register(modules.NewSupervisorModule())
			log.Printf("Registered supervisor module: %s", svcCfg.Name)
		case "ansible":
			registry.Register(modules.NewAnsibleModule())
			log.Printf("Registered Ansible module: %s", svcCfg.Name)
		}
	}

	// Auto-Discovery
	discovery.Discover(registry, cfg.ActiveFirewall)

	// Log all services
	for _, s := range registry.List() {
		log.Printf("Service active: %s", s)
	}

	// Reconnection Loop
	hubURL := cfg.Hub.URL
	if hubURL == "" {
		hubURL = "ws://localhost:65432/agent/connect" // Default
	}

	u, _ := url.Parse(hubURL)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	// Ensure Agent ID exists
	if cfg.Hub.ID == "" {
		cfg.Hub.ID = uuid.NewString()
		log.Printf("Generated new Agent ID: %s", cfg.Hub.ID)
		if err := config.Save(cfg, *configPath); err != nil {
			log.Printf("Warning: failed to save Agent ID to config: %v", err)
		}
	} else {
		log.Printf("Using existing Agent ID: %s", cfg.Hub.ID)
	}

	for {
		log.Printf("Connecting to Hub at %s", u.String())

		err := connectAndMonitor(u.String(), cfg.Hub.Token, registry, interrupt, cfg, *configPath)
		if err != nil {
			log.Printf("Connection error: %v", err)
		}

		select {
		case <-interrupt:
			log.Println("Agent shutting down...")
			return
		case <-time.After(5 * time.Second):
			log.Println("Reconnecting in 5 seconds...")
		}
	}
}

func getOSInfo() string {
	osInfo := runtime.GOOS + "/" + runtime.GOARCH
	if b, err := os.ReadFile("/etc/os-release"); err == nil {
		lines := strings.Split(string(b), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				val := strings.TrimPrefix(line, "PRETTY_NAME=")
				val = strings.Trim(val, `"'`)
				osInfo = val + " (" + runtime.GOARCH + ")"
				break
			}
		}
	}
	return osInfo
}

func connectAndMonitor(urlStr, token string, registry *core.Registry, interrupt chan os.Signal, cfg *config.Config, cfgPath string) error {
	c, _, err := websocket.DefaultDialer.Dial(urlStr, nil)
	if err != nil {
		return err
	}
	defer c.Close()

	// Thread-safe write helper
	var mu sync.Mutex
	safeWrite := func(v interface{}) error {
		mu.Lock()
		defer mu.Unlock()
		return c.WriteJSON(v)
	}

	// Send Register Message
	hostname, _ := os.Hostname()
	services := registry.List()

	// Gather initial status
	var serviceInfos []protocol.ServiceInfo
	for _, svcName := range services {
		mod, err := registry.Get(svcName)
		var status core.Status = core.StatusUnknown
		var metrics map[string]float64
		if err == nil {
			status, _ = mod.Status()
			if gatherer, ok := mod.(core.MetricGatherer); ok {
				if m, err := gatherer.Metrics(); err == nil && m != nil {
					metrics = m
				}
			}
			if fwMod, ok := mod.(core.FirewallModule); ok {
				if metrics == nil {
					metrics = make(map[string]float64)
				}
				if fwMod.IsActive() {
					metrics["is_active"] = 1
				} else {
					metrics["is_active"] = 0
				}
			}
		}
		serviceInfos = append(serviceInfos, protocol.ServiceInfo{
			Name:    svcName,
			Status:  string(status),
			Metrics: metrics,
		})
	}

	regMsg := protocol.Message{
		Type: protocol.MsgTypeRegister,
		Payload: protocol.RegisterPayload{
			AgentID:  cfg.Hub.ID,
			Hostname: hostname,
			OSInfo:   getOSInfo(),
			Token:    token,
			Services: serviceInfos,
		},
	}

	if err := safeWrite(regMsg); err != nil {
		return fmt.Errorf("register write error: %w", err)
	}

	// 1. Wait for Welcome Message BEFORE starting loops
	var welcomeMsg protocol.Message
	if err := c.ReadJSON(&welcomeMsg); err != nil {
		return fmt.Errorf("failed to read welcome message: %w", err)
	}

	heartbeatInterval := 15 // Default
	if welcomeMsg.Type == protocol.MsgTypeWelcome {
		log.Println("Agent registered successfully!")
		if payload, ok := welcomeMsg.Payload.(map[string]interface{}); ok {
			if interval, ok := payload["heartbeat_interval"].(float64); ok && interval > 0 {
				heartbeatInterval = int(interval)
				log.Printf("Heartbeat interval set to %ds by Hub", heartbeatInterval)
			}
		}

		// Report "Agent Connected" event
		safeWrite(protocol.Message{
			Type: protocol.MsgTypeEvent,
			Payload: protocol.EventPayload{
				Type:    "agent_connected",
				Message: fmt.Sprintf("Agent %s successfully connected and registered", hostname),
			},
		})
	} else if welcomeMsg.Type == protocol.MsgTypeResponse {
		if payload, ok := welcomeMsg.Payload.(map[string]interface{}); ok {
			if errMsg, ok := payload["error"].(string); ok {
				log.Printf("Server rejected connection: %s", errMsg)
				return fmt.Errorf("server registration failed: %s", errMsg)
			}
		}
		log.Printf("Server sent unexpected response message: %+v", welcomeMsg.Payload)
		return fmt.Errorf("server registration failed with unknown response")
	} else {
		log.Printf("Expected welcome message, got %s", welcomeMsg.Type)
		return fmt.Errorf("unexpected message type from server: %s", welcomeMsg.Type)
	}

	// Handle Incoming Messages (Commands etc.)
	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			var msg protocol.Message
			err := c.ReadJSON(&msg)
			if err != nil {
				log.Printf("Read error: %v", err)
				return
			}
			// log.Printf("recv: %s", msg.Type)

			if msg.Type == protocol.MsgTypeCommand {
				payloadMap, ok := msg.Payload.(map[string]interface{})
				if !ok || payloadMap == nil {
					log.Printf("Received invalid command payload type or nil payload")
					continue
				}

				action, _ := payloadMap["action"].(string)
				serviceName, _ := payloadMap["service"].(string)
				cmdID, _ := payloadMap["command_id"].(string)

				if action == "" || serviceName == "" {
					log.Printf("Received command with empty action or service: action='%s', service='%s', cmdID='%s'", action, serviceName, cmdID)
				}

				log.Printf("Received command: %s %s [%s]", action, serviceName, cmdID)

				if action == "firewall_set_active" {
					go func() {
						var success bool
						var output string

						mod, err := registry.Get(serviceName)
						if err != nil {
							success = false
							output = "target firewall not found"
						} else if _, ok := mod.(core.FirewallModule); !ok {
							success = false
							output = "target is not a firewall module"
						} else {
							cfg.ActiveFirewall = serviceName
							if err := config.Save(cfg, cfgPath); err != nil {
								success = false
								output = "failed to save config: " + err.Error()
							} else {
								for _, name := range registry.List() {
									if hw, err := registry.Get(name); err == nil {
										if fwMod, ok := hw.(core.FirewallModule); ok {
											fwMod.SetActive(fwMod.TargetName() == serviceName)
										}
									}
								}
								success = true
								output = "Active firewall set to " + serviceName
							}
						}

						resp := protocol.Message{
							Type: protocol.MsgTypeResponse,
							Payload: protocol.ResponsePayload{
								CommandID: cmdID,
								Success:   success,
								Message:   output, // Legacy
								Output:    output,
								Error:     "",
							},
						}
						safeWrite(resp)
					}()
					continue
				}

				// Execute
				go func() {
					var opts map[string]interface{}
					if optsRaw, ok := payloadMap["options"]; ok && optsRaw != nil {
						opts, _ = optsRaw.(map[string]interface{})
					}
					cmdCtx := &CommandContext{
						Registry:   registry,
						Config:     cfg,
						ConfigPath: cfgPath,
					}

					// "agent" is not a registry module - dispatch directly without registry lookup
					if serviceName == "agent" {
						var success bool
						var output string
						if handler, ok := CommandHandlers[action]; ok {
							out, err := handler(nil, cmdCtx, map[string]interface{}{"options": opts})
							if err != nil {
								success = false
								output = err.Error()
							} else {
								success = true
								output = out
								if output == "" {
									output = "OK"
								}
							}
						} else {
							success = false
							output = fmt.Sprintf("unknown agent action: %s", action)
						}
						resp := protocol.Message{
							Type: protocol.MsgTypeResponse,
							Payload: protocol.ResponsePayload{
								CommandID: cmdID,
								Success:   success,
								Message:   output,
								Output:    func() string {
									if success { return output }; return ""
								}(),
								Error: func() string {
									if !success { return output }; return ""
								}(),
							},
						}
						safeWrite(resp)
						return
					}

					mod, err := registry.Get(serviceName)
					var success bool
					var output string

					if err != nil {
						success = false
						output = err.Error()
					} else {
						if handler, ok := CommandHandlers[action]; ok {
							out, err := handler(mod, cmdCtx, map[string]interface{}{"options": opts})
							if err != nil {
								success = false
								output = err.Error()
							} else {
								success = true
								output = out
								if output == "" {
									output = "OK"
								}
							}
						} else {
							success = false
							output = fmt.Sprintf("unknown action: %s", action)
						}
					}

					// Send Response
					respPayload := protocol.ResponsePayload{
						CommandID: cmdID,
						Success:   success,
						Message:   output, // Legacy
					}
					if success {
						respPayload.Output = output
					} else {
						respPayload.Error = output
						respPayload.Output = ""
					}

					resp := protocol.Message{
						Type:    protocol.MsgTypeResponse,
						Payload: respPayload,
					}
					safeWrite(resp)
				}()
			}
		}
	}()

	// Keep Track of last status for events
	lastStatuses := make(map[string]string)
	for _, info := range serviceInfos {
		lastStatuses[info.Name] = info.Status
	}

	// Tickers
	heartbeatTicker := time.NewTicker(time.Duration(heartbeatInterval) * time.Second)
	defer heartbeatTicker.Stop()
	monitorTicker := time.NewTicker(5 * time.Second)
	defer monitorTicker.Stop()

	for {
		select {
		case <-done:
			return fmt.Errorf("connection closed by server")
		case <-monitorTicker.C:
			// Rapidly check for status changes
			for _, svcName := range registry.List() {
				mod, err := registry.Get(svcName)
				if err == nil {
					status, _ := mod.Status()
					if oldStatus, exists := lastStatuses[svcName]; exists {
						if oldStatus != string(status) {
							log.Printf("Event: %s status changed %s -> %s", svcName, oldStatus, status)
							safeWrite(protocol.Message{
								Type: protocol.MsgTypeEvent,
								Payload: protocol.EventPayload{
									Type:    "service_status_change",
									Service: svcName,
									Status:  string(status),
									Message: fmt.Sprintf("Service %s changed status from %s to %s", svcName, oldStatus, status),
								},
							})
							lastStatuses[svcName] = string(status)
						}
					} else {
						lastStatuses[svcName] = string(status)
					}
				}
			}

		case <-heartbeatTicker.C:
			// Get latest status for full ping
			var serviceInfos []protocol.ServiceInfo
			for _, svcName := range registry.List() {
				mod, err := registry.Get(svcName)
				var status core.Status = core.StatusUnknown
				var metrics map[string]float64
				if err == nil {
					status, _ = mod.Status()
					if gatherer, ok := mod.(core.MetricGatherer); ok {
						if m, err := gatherer.Metrics(); err == nil && m != nil {
							metrics = m
						}
					}
					if fwMod, ok := mod.(core.FirewallModule); ok {
						if metrics == nil {
							metrics = make(map[string]float64)
						}
						if fwMod.IsActive() {
							metrics["is_active"] = 1
						} else {
							metrics["is_active"] = 0
						}
					}
				}
				serviceInfos = append(serviceInfos, protocol.ServiceInfo{
					Name:    svcName,
					Status:  string(status),
					Metrics: metrics,
				})
			}

			// Send Ping with Status payload
			pingMsg := protocol.Message{
				Type: protocol.MsgTypeKeepAlive,
				Payload: protocol.KeepAlivePayload{
					Services: serviceInfos,
				},
			}
			if err := safeWrite(pingMsg); err != nil {
				return fmt.Errorf("ping write error: %w", err)
			}
		case <-interrupt:
			// Cleanly close connection
			mu.Lock()
			c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			mu.Unlock()
			return nil // Graceful exit
		}
	}
}
