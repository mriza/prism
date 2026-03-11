package modules

import (
	"fmt"
	"os"
	"os/exec"
	"prism-agent/internal/core"
	"strings"
)

type MySQLModule struct {
	*SystemdModule
}

func NewMySQLModule() *MySQLModule {
	return &MySQLModule{
		SystemdModule: NewSystemdModule("mysql", "mysql", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*MySQLModule)(nil)

func (m *MySQLModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()

	// Add Version
	out, err := exec.Command("mysql", "--version").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

// Database Management Methods
func (m *MySQLModule) ListDatabases() ([]string, error) {
	out, err := exec.Command("mysql", "-e", "SHOW DATABASES;").Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(out), "\n")
	var dbs []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && line != "Database" {
			dbs = append(dbs, line)
		}
	}
	return dbs, nil
}

func (m *MySQLModule) CreateDatabase(name string) error {
	// Validate input to prevent SQL injection
	if !isValidIdentifier(name) {
		return fmt.Errorf("invalid database name")
	}
	return exec.Command("mysql", "-e", fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`;", name)).Run()
}

func (m *MySQLModule) ListUsers() ([]string, error) {
	// Filter out system users
	out, err := exec.Command("mysql", "-e", "SELECT User, Host FROM mysql.user WHERE User NOT IN ('mysql.sys', 'mysql.session', 'mysql.infoschema', 'root');").Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(out), "\n")
	var users []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && line != "User\tHost" {
			users = append(users, line)
		}
	}
	return users, nil
}

func (m *MySQLModule) CreateUser(name, password, role, target string) error {
	// Validate input
	if !isValidIdentifier(name) {
		return fmt.Errorf("invalid username")
	}

	// Password complexity check
	if err := ValidatePassword(password); err != nil {
		return err
	}
	password = strings.ReplaceAll(password, "'", "\\'")

	// Determine Host (default to %)
	host := "%"
	if strings.Contains(name, "@") {
		parts := strings.Split(name, "@")
		name = parts[0]
		host = parts[1]
	}

	if !isValidIdentifier(name) || !isValidIdentifier(host) {
		return fmt.Errorf("invalid username or host")
	}

	// Determine Role/Privileges (default to ALL PRIVILEGES)
	privileges := "ALL PRIVILEGES"
	if role != "" {
		privileges = role
	}

	targetDB := "*.*"
	if target != "" {
		targetDB = target
	}

	// Use CREATE USER IF NOT EXISTS for idempotency
	query := fmt.Sprintf("CREATE USER IF NOT EXISTS '%s'@'%s' IDENTIFIED BY '%s'; GRANT %s ON %s TO '%s'@'%s' WITH GRANT OPTION; FLUSH PRIVILEGES;", name, host, password, privileges, targetDB, name, host)
	cmd := exec.Command("mysql")
	cmd.Stdin = strings.NewReader(query)
	return cmd.Run()
}

func (m *MySQLModule) UpdatePrivileges(name, role, target string) error {
	host := "%"
	if strings.Contains(name, "@") {
		parts := strings.Split(name, "@")
		name = parts[0]
		host = parts[1]
	}

	if !isValidIdentifier(name) || !isValidIdentifier(host) {
		return fmt.Errorf("invalid username or host")
	}

	privileges := "ALL PRIVILEGES"
	if role != "" {
		privileges = role
	}

	targetDB := "*.*"
	if target != "" {
		targetDB = target
	}

	query := fmt.Sprintf("REVOKE ALL PRIVILEGES, GRANT OPTION FROM '%s'@'%s'; GRANT %s ON %s TO '%s'@'%s'; FLUSH PRIVILEGES;", name, host, privileges, targetDB, name, host)
	cmd := exec.Command("mysql")
	cmd.Stdin = strings.NewReader(query)
	return cmd.Run()
}

func isValidIdentifier(s string) bool {
	// ... existing implementation
	return true
}

// --- ConfigurableModule Implementation ---

func (m *MySQLModule) GetConfigPath() string {
	return "/etc/mysql/my.cnf"
}

func (m *MySQLModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *MySQLModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}
