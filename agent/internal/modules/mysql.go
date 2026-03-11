package modules

import (
	"fmt"
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
	return exec.Command("mysql", "-e", fmt.Sprintf("CREATE DATABASE `%s`;", name)).Run()
}

func (m *MySQLModule) ListUsers() ([]string, error) {
	out, err := exec.Command("mysql", "-e", "SELECT User, Host FROM mysql.user;").Output()
	if err != nil {
		return nil, err
	}
	return strings.Split(string(out), "\n"), nil
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

	// First query creates the user. Second query grants the privileges.
	query := fmt.Sprintf("CREATE USER '%s'@'%s' IDENTIFIED BY '%s'; GRANT %s ON %s TO '%s'@'%s'; FLUSH PRIVILEGES;", name, host, password, privileges, targetDB, name, host)
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

// Helper for basic identifier validation (alphanumeric, underscore, dash)
func isValidIdentifier(s string) bool {
	if len(s) == 0 || len(s) > 64 {
		return false
	}
	for _, r := range s {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') && r != '_' && r != '-' && r != '%' {
			return false
		}
	}
	return true
}
