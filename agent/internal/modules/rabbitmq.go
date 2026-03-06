package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"os/exec"
	"strings"
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

func (m *RabbitMQModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()

	// Get Version
	_, err := exec.Command("rabbitmqctl", "status").Output()
	if err == nil {
		// Parsing rabbitmqctl status is verbose, maybe just basic check or grep version
		// For now just indicate it's rabbitmq
		facts["type"] = "message-broker"
	}
	return facts, nil
}

// --- VHost Management ---

func (m *RabbitMQModule) ListVHosts() ([]string, error) {
	// rabbitmqctl list_vhosts --quiet --no-table-headers
	out, err := exec.Command("rabbitmqctl", "list_vhosts", "--quiet", "--no-table-headers").Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(string(out)), "\n"), nil
}

func (m *RabbitMQModule) CreateVHost(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid vhost name")
	}
	return exec.Command("rabbitmqctl", "add_vhost", name).Run()
}

func (m *RabbitMQModule) DeleteVHost(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid vhost name")
	}
	return exec.Command("rabbitmqctl", "delete_vhost", name).Run()
}

// --- User Management ---

// Helper for basic RabbitMQ identifier validation
func isValidRMQIdentifier(s string) bool {
	if len(s) == 0 || len(s) > 128 {
		return false
	}
	for _, r := range s {
		// allow alphanumeric, dashes, underscores, and forward slashes (for vhosts)
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' && r != '-' && r != '/' && r != '.' {
			return false
		}
	}
	return true
}

func (m *RabbitMQModule) ListUsers() ([]core.RabbitUser, error) {
	out, err := exec.Command("rabbitmqctl", "list_users", "-q").CombinedOutput()
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

func (m *RabbitMQModule) CreateUser(name, password, tags string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}
	if err := exec.Command("rabbitmqctl", "add_user", name, password).Run(); err != nil {
		return err
	}
	if tags != "" {
		if !isValidRMQIdentifier(tags) && !strings.Contains(tags, ",") {
			// Tags can be comma separated, but we do basic check
		}
		return exec.Command("rabbitmqctl", "set_user_tags", name, tags).Run()
	}
	return nil
}

func (m *RabbitMQModule) DeleteUser(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}
	return exec.Command("rabbitmqctl", "delete_user", name).Run()
}

func (m *RabbitMQModule) SetPermissions(vhost, user, conf, write, read string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(user) {
		return fmt.Errorf("invalid vhost or username")
	}
	// rabbitmqctl set_permissions -p vhost user "conf" "write" "read"
	return exec.Command("rabbitmqctl", "set_permissions", "-p", vhost, user, conf, write, read).Run()
}

// --- Binding Management (MQTT Support) ---

// CreateBinding binds a queue to an exchange.
// For MQTT, we typically bind a queue to 'amq.topic' exchange.
func (m *RabbitMQModule) CreateBinding(vhost, sourceExchange, destinationQueue, routingKey string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(sourceExchange) || !isValidRMQIdentifier(destinationQueue) || !isValidRMQIdentifier(routingKey) {
		return fmt.Errorf("invalid identifier in binding parameters")
	}
	// rabbitmqctl bind_queue -p vhost queue exchange routing_key
	// Note: rabbitmqctl syntax: bind_queue source_exchange destination_queue routing_key [arguments] -- vhost via -p

	// Syntax: rabbitmqctl bind_queue <queue> <exchange> <routing_key> -p <vhost>
	return exec.Command("rabbitmqctl", "bind_queue", destinationQueue, sourceExchange, routingKey, "-p", vhost).Run()
}

func (m *RabbitMQModule) ListBindings(vhost string) ([]string, error) {
	// rabbitmqctl list_bindings -p vhost --quiet --no-table-headers
	out, err := exec.Command("rabbitmqctl", "list_bindings", "-p", vhost, "--quiet", "--no-table-headers").Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(string(out)), "\n"), nil
}
