package modules

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"prism-agent/internal/core"
)

type RabbitMQModule struct {
	*SystemdModule
}

func NewRabbitMQModule() *RabbitMQModule {
	return &RabbitMQModule{
		SystemdModule: NewSystemdModule("rabbitmq", "rabbitmq-server", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*RabbitMQModule)(nil)
var _ core.RabbitMQModule = (*RabbitMQModule)(nil)
var _ core.ServiceSettings = (*RabbitMQModule)(nil)
var _ core.ConfigurableModule = (*RabbitMQModule)(nil)

func (m *RabbitMQModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()

	// Get Version
	_, err := getExecutor().Command("rabbitmqctl", "status").Output()
	if err == nil {
		facts["type"] = "message-broker"
	}
	return facts, nil
}

// --- VHost Management ---

func (m *RabbitMQModule) ListVHosts() ([]string, error) {
	out, err := getExecutor().Command("rabbitmqctl", "list_vhosts", "--quiet", "--no-table-headers").Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(string(out)), "\n"), nil
}

func (m *RabbitMQModule) CreateVHost(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid vhost name")
	}
	// add_vhost fails if exists, but that's often okay for us
	log.Printf("Creating vhost: %s", name)
	getExecutor().Command("rabbitmqctl", "add_vhost", name).Run()
	return nil
}

func (m *RabbitMQModule) DeleteVHost(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid vhost name")
	}
	return getExecutor().Command("rabbitmqctl", "delete_vhost", name).Run()
}

// Helper for basic RabbitMQ identifier validation
func isValidRMQIdentifier(s string) bool {
	if len(s) == 0 || len(s) > 128 {
		return false
	}
	for _, r := range s {
		// allow alphanumeric, dashes, underscores, and forward slashes (for vhosts)
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' && r != '-' && r != '/' && r != '.' && r != '*' && r != '#' {
			return false
		}
	}
	return true
}

// --- Standardized Interface Methods ---

func (m *RabbitMQModule) CreateDatabase(name string) error {
	return m.CreateVHost(name)
}

func (m *RabbitMQModule) CreateUser(name, password, role, target string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}
	
	// 1. Create User (ignore error if already exists)
	getExecutor().Command("rabbitmqctl", "add_user", name, password).Run()

	// 2. Set Tags (role mappings)
	if role == "" {
		role = "management"
	}
	getExecutor().Command("rabbitmqctl", "set_user_tags", name, role).Run()

	// 3. Set Permissions for the vhost
	vhost := "/"
	if target != "" && target != "*" {
		vhost = target
	}
	
	return getExecutor().Command("rabbitmqctl", "set_permissions", "-p", vhost, name, ".*", ".*", ".*").Run()
}

func (m *RabbitMQModule) UpdatePrivileges(name, role, target string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}

	if role != "" {
		getExecutor().Command("rabbitmqctl", "set_user_tags", name, role).Run()
	}

	vhost := "/"
	if target != "" && target != "*" {
		vhost = target
	}
	return getExecutor().Command("rabbitmqctl", "set_permissions", "-p", vhost, name, ".*", ".*", ".*").Run()
}

// --- List/Delete Methods ---

func (m *RabbitMQModule) ListUsers() ([]core.RabbitUser, error) {
	out, err := getExecutor().Command("rabbitmqctl", "list_users", "-q").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("rabbitmqctl error: %v output: %s", err, string(out))
	}

	var users []core.RabbitUser
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 1 {
			tags := ""
			if len(parts) > 1 {
				tags = parts[1]
			}
			users = append(users, core.RabbitUser{Name: parts[0], Tags: tags})
		}
	}
	return users, nil
}

func (m *RabbitMQModule) DeleteUser(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}
	return getExecutor().Command("rabbitmqctl", "delete_user", name).Run()
}

func (m *RabbitMQModule) SetPermissions(vhost, user, conf, write, read string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(user) {
		return fmt.Errorf("invalid vhost or username")
	}
	return getExecutor().Command("rabbitmqctl", "set_permissions", "-p", vhost, user, conf, write, read).Run()
}

// --- Binding Management ---

func (m *RabbitMQModule) CreateBinding(vhost, sourceExchange, destinationQueue, routingKey string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(sourceExchange) || !isValidRMQIdentifier(destinationQueue) || !isValidRMQIdentifier(routingKey) {
		return fmt.Errorf("invalid identifier in binding parameters")
	}
	return getExecutor().Command("rabbitmqctl", "bind_queue", destinationQueue, sourceExchange, routingKey, "-p", vhost).Run()
}

func (m *RabbitMQModule) DeclareExchange(vhost, name, kind string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(name) || !isValidRMQIdentifier(kind) {
		return fmt.Errorf("invalid exchange parameters")
	}
	// rabbitmqadmin declare exchange name=my-exchange type=direct -V my-vhost
	return getExecutor().Command("rabbitmqadmin", "declare", "exchange", "name="+name, "type="+kind, "-V", vhost).Run()
}

func (m *RabbitMQModule) DeclareQueue(vhost, name string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid queue parameters")
	}
	// rabbitmqadmin declare queue name=my-queue -V my-vhost
	return getExecutor().Command("rabbitmqadmin", "declare", "queue", "name="+name, "-V", vhost).Run()
}

func (m *RabbitMQModule) ListBindings(vhost string) ([]string, error) {
	out, err := getExecutor().Command("rabbitmqctl", "list_bindings", "-p", vhost, "--quiet", "--no-table-headers").Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(string(out)), "\n"), nil
}

func (m *RabbitMQModule) SyncBindings(bindings []map[string]interface{}) error {
	for _, b := range bindings {
		vhost, _ := b["vhost"].(string)
		exchange, _ := b["sourceExchange"].(string)
		queue, _ := b["destinationQueue"].(string)
		rkey, _ := b["routingKey"].(string)

		if vhost == "" || queue == "" || exchange == "" {
			continue
		}

		// 1. Ensure Queue and Exchange exist
		m.DeclareQueue(vhost, queue)
		m.DeclareExchange(vhost, exchange, "topic") // Default to topic for MQTT

		// 2. Create Binding
		err := m.CreateBinding(vhost, exchange, queue, rkey)
		if err != nil {
			log.Printf("Binding error for %s: %v", queue, err)
		}
	}
	return nil
}

// --- ConfigurableModule Implementation ---

func (m *RabbitMQModule) GetConfigPath() string {
	return "/etc/rabbitmq/rabbitmq.conf"
}

func (m *RabbitMQModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *RabbitMQModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}

// --- ServiceSettings Implementation ---

func (m *RabbitMQModule) GetSettings() (map[string]interface{}, error) {
	settings := map[string]interface{}{
		"port":            "5672",
		"management_port": "15672",
		"admin_username":  "guest",
	}

	if content, err := m.ReadConfig(); err == nil {
		for _, line := range strings.Split(content, "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "listeners.tcp.default") {
				if parts := strings.SplitN(trimmed, "=", 2); len(parts) == 2 {
					settings["port"] = strings.TrimSpace(parts[1])
				}
			}
			if strings.HasPrefix(trimmed, "management.tcp.port") {
				if parts := strings.SplitN(trimmed, "=", 2); len(parts) == 2 {
					settings["management_port"] = strings.TrimSpace(parts[1])
				}
			}
			if strings.HasPrefix(trimmed, "default_user") {
				if parts := strings.SplitN(trimmed, "=", 2); len(parts) == 2 {
					settings["admin_username"] = strings.TrimSpace(parts[1])
				}
			}
		}
	}

	// Read enabled plugins from /etc/rabbitmq/enabled_plugins
	pluginPaths := []string{"/etc/rabbitmq/enabled_plugins", "/var/lib/rabbitmq/enabled_plugins"}
	for _, path := range pluginPaths {
		if data, err := os.ReadFile(path); err == nil {
			// Format: [rabbitmq_management,rabbitmq_peer_discovery_localnode].
			raw := strings.TrimSpace(string(data))
			raw = strings.Trim(raw, "[].")
			settings["enabled_plugins"] = raw
			break
		}
	}

	return settings, nil
}

func (m *RabbitMQModule) UpdateSettings(settings map[string]interface{}) error {
	content, err := m.ReadConfig()
	var lines []string
	if err != nil {
		lines = []string{}
	} else {
		lines = strings.Split(content, "\n")
	}

	newSettings := map[string]string{
		"listeners.tcp.default": "port",
		"management.tcp.port":   "management_port",
	}

	for configKey, settingsKey := range newSettings {
		if val, ok := settings[settingsKey].(string); ok && val != "" {
			updated := false
			for i, line := range lines {
				if strings.HasPrefix(strings.TrimSpace(line), configKey) {
					lines[i] = fmt.Sprintf("%s = %s", configKey, val)
					updated = true
					break
				}
			}
			if !updated {
				lines = append(lines, fmt.Sprintf("%s = %s", configKey, val))
			}
		}
	}

	return m.WriteConfig(strings.Join(lines, "\n"))
}

// ListExchanges returns all exchanges in a vhost
func (m *RabbitMQModule) ListExchanges(vhost string) ([]string, error) {
	// Use rabbitmqadmin or rabbitmqctl to list exchanges
	cmd := getExecutor().Command("rabbitmqadmin", "-V", vhost, "list", "exchanges", "--format", "json")
	output, err := cmd.Output()
	if err != nil {
		// Fallback to rabbitmqctl
		cmd = getExecutor().Command("rabbitmqctl", "-p", vhost, "list_exchanges")
		output, err = cmd.Output()
		if err != nil {
			return []string{}, nil // Return empty on error
		}
	}

	var exchanges []string
	if err := json.Unmarshal(output, &exchanges); err != nil {
		// Parse plain text output
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			parts := strings.Fields(line)
			if len(parts) >= 2 && parts[0] != "name" {
				exchanges = append(exchanges, parts[0])
			}
		}
	}
	
	return exchanges, nil
}

// ListQueues returns all queues in a vhost
func (m *RabbitMQModule) ListQueues(vhost string) ([]string, error) {
	// Use rabbitmqadmin or rabbitmqctl to list queues
	cmd := getExecutor().Command("rabbitmqadmin", "-V", vhost, "list", "queues", "--format", "json")
	output, err := cmd.Output()
	if err != nil {
		// Fallback to rabbitmqctl
		cmd = getExecutor().Command("rabbitmqctl", "-p", vhost, "list_queues", "name")
		output, err = cmd.Output()
		if err != nil {
			return []string{}, nil // Return empty on error
		}
	}

	var queues []string
	if err := json.Unmarshal(output, &queues); err != nil {
		// Parse plain text output
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			parts := strings.Fields(line)
			if len(parts) >= 1 && parts[0] != "name" {
				queues = append(queues, parts[0])
			}
		}
	}
	
	return queues, nil
}
