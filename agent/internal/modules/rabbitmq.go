package modules

import (
	"prism-agent/internal/core"
	"fmt"
	"log"
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
		facts["type"] = "message-broker"
	}
	return facts, nil
}

// --- VHost Management ---

func (m *RabbitMQModule) ListVHosts() ([]string, error) {
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
	// add_vhost fails if exists, but that's often okay for us
	log.Printf("Creating vhost: %s", name)
	exec.Command("rabbitmqctl", "add_vhost", name).Run()
	return nil
}

func (m *RabbitMQModule) DeleteVHost(name string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid vhost name")
	}
	return exec.Command("rabbitmqctl", "delete_vhost", name).Run()
}

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

// --- Standardized Interface Methods ---

func (m *RabbitMQModule) CreateDatabase(name string) error {
	return m.CreateVHost(name)
}

func (m *RabbitMQModule) CreateUser(name, password, role, target string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}
	
	// 1. Create User (ignore error if already exists)
	exec.Command("rabbitmqctl", "add_user", name, password).Run()

	// 2. Set Tags (role mappings)
	if role == "" {
		role = "management"
	}
	exec.Command("rabbitmqctl", "set_user_tags", name, role).Run()

	// 3. Set Permissions for the vhost
	vhost := "/"
	if target != "" && target != "*" {
		vhost = target
	}
	
	return exec.Command("rabbitmqctl", "set_permissions", "-p", vhost, name, ".*", ".*", ".*").Run()
}

func (m *RabbitMQModule) UpdatePrivileges(name, role, target string) error {
	if !isValidRMQIdentifier(name) {
		return fmt.Errorf("invalid username")
	}

	if role != "" {
		exec.Command("rabbitmqctl", "set_user_tags", name, role).Run()
	}

	vhost := "/"
	if target != "" && target != "*" {
		vhost = target
	}
	return exec.Command("rabbitmqctl", "set_permissions", "-p", vhost, name, ".*", ".*", ".*").Run()
}

// --- List/Delete Methods ---

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
	return exec.Command("rabbitmqctl", "set_permissions", "-p", vhost, user, conf, write, read).Run()
}

// --- Binding Management ---

func (m *RabbitMQModule) CreateBinding(vhost, sourceExchange, destinationQueue, routingKey string) error {
	if !isValidRMQIdentifier(vhost) || !isValidRMQIdentifier(sourceExchange) || !isValidRMQIdentifier(destinationQueue) || !isValidRMQIdentifier(routingKey) {
		return fmt.Errorf("invalid identifier in binding parameters")
	}
	return exec.Command("rabbitmqctl", "bind_queue", destinationQueue, sourceExchange, routingKey, "-p", vhost).Run()
}

func (m *RabbitMQModule) ListBindings(vhost string) ([]string, error) {
	out, err := exec.Command("rabbitmqctl", "list_bindings", "-p", vhost, "--quiet", "--no-table-headers").Output()
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

		err := m.CreateBinding(vhost, exchange, queue, rkey)
		if err != nil {
			log.Printf("Binding error for %s: %v", queue, err)
		}
	}
	return nil
}
