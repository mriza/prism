package modules

import (
	"fmt"
	"os"
	"prism-agent/internal/core"
	"strings"
)

type MySQLModule struct {
	*SystemdModule
	managementCreds map[string]string
}

func NewMySQLModule() *MySQLModule {
	return &MySQLModule{
		SystemdModule: NewSystemdModule("mysql", "mysql", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*MySQLModule)(nil)
var _ core.ManagementCredentialAware = (*MySQLModule)(nil)

func (m *MySQLModule) SetManagementCredentials(creds map[string]string) {
	m.managementCreds = creds
}

func (m *MySQLModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()

	// Add Version
	out, err := getExecutor().Command("mysql", "--version").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

// Database Management Methods

func (m *MySQLModule) buildMysqlCmd(baseArgs ...string) Command {
	var args []string
	var env []string

	args = append(args, "mysql")
	if m.managementCreds != nil && m.managementCreds["username"] != "" {
		args = append(args, "-u", m.managementCreds["username"])
		if host := m.managementCreds["host"]; host != "" {
			args = append(args, "-h", host)
		} else {
			args = append(args, "-h", "127.0.0.1")
		}
		if pass := m.managementCreds["password"]; pass != "" {
			env = append(os.Environ(), "MYSQL_PWD="+pass)
		}
	}

	args = append(args, baseArgs...)
	cmd := getExecutor().Command(args[0], args[1:]...)
	if len(env) > 0 {
		cmd.SetEnv(env)
	}
	return cmd
}

func (m *MySQLModule) ListDatabases() ([]string, error) {
	cmd := m.buildMysqlCmd("-e", "SHOW DATABASES;")
	out, err := cmd.Output()
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
	return m.buildMysqlCmd("-e", fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`;", name)).Run()
}

func (m *MySQLModule) ListUsers() ([]string, error) {
	// Filter out system users
	cmd := m.buildMysqlCmd("-e", "SELECT User, Host FROM mysql.user WHERE User NOT IN ('mysql.sys', 'mysql.session', 'mysql.infoschema', 'root');")
	out, err := cmd.Output()
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

	if !isValidIdentifier(name) || !isValidHost(host) {
		return fmt.Errorf("invalid username or host")
	}

	// Determine Role/Privileges (default to ALL PRIVILEGES)
	privileges := "ALL PRIVILEGES"
	switch strings.ToLower(role) {
	case "read":
		privileges = "SELECT"
	case "write":
		privileges = "INSERT, UPDATE, DELETE"
	case "readwrite":
		privileges = "SELECT, INSERT, UPDATE, DELETE"
	case "admin", "all privileges", "all", "":
		privileges = "ALL PRIVILEGES"
	default:
		privileges = role
	}

	targetDB := "*.*"
	if target != "" {
		targetDB = target
	}

	// Use CREATE USER IF NOT EXISTS for idempotency
	query := fmt.Sprintf("CREATE USER IF NOT EXISTS '%s'@'%s' IDENTIFIED BY '%s'; GRANT %s ON %s TO '%s'@'%s' WITH GRANT OPTION; FLUSH PRIVILEGES;", name, host, password, privileges, targetDB, name, host)
	cmd := m.buildMysqlCmd()
	cmd.SetStdin(strings.NewReader(query))
	return cmd.Run()
}

func (m *MySQLModule) UpdatePrivileges(name, role, target string) error {
	host := "%"
	if strings.Contains(name, "@") {
		parts := strings.Split(name, "@")
		name = parts[0]
		host = parts[1]
	}

	if !isValidIdentifier(name) || !isValidHost(host) {
		return fmt.Errorf("invalid username or host")
	}

	privileges := "ALL PRIVILEGES"
	switch strings.ToLower(role) {
	case "read":
		privileges = "SELECT"
	case "write":
		privileges = "INSERT, UPDATE, DELETE"
	case "readwrite":
		privileges = "SELECT, INSERT, UPDATE, DELETE"
	case "admin", "all privileges", "all", "":
		privileges = "ALL PRIVILEGES"
	default:
		privileges = role
	}

	targetDB := "*.*"
	if target != "" {
		targetDB = target
	}

	query := fmt.Sprintf("REVOKE ALL PRIVILEGES, GRANT OPTION FROM '%s'@'%s'; GRANT %s ON %s TO '%s'@'%s'; FLUSH PRIVILEGES;", name, host, privileges, targetDB, name, host)
	cmd := m.buildMysqlCmd()
	cmd.SetStdin(strings.NewReader(query))
	return cmd.Run()
}

// isValidIdentifier checks that a database/user name contains only safe characters.
func isValidIdentifier(s string) bool {
	if s == "" || len(s) > 64 {
		return false
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '_') {
			return false
		}
	}
	return true
}

// isValidHost checks that a MySQL host value is safe (%, localhost, IP, hostname).
func isValidHost(s string) bool {
	if s == "" || len(s) > 255 {
		return false
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' || r == '%') {
			return false
		}
	}
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

// --- ServiceSettings Implementation ---

func (m *MySQLModule) GetSettings() (map[string]interface{}, error) {
	content, err := m.ReadConfig()
	if err != nil {
		return nil, err
	}

	settings := make(map[string]interface{})
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		switch key {
		case "port":
			settings["port"] = val
		case "socket":
			settings["socket"] = val
		case "datadir":
			settings["datadir"] = val
		case "log_error":
			settings["log_error"] = val
		}
	}

	// Defaults if missing
	if _, ok := settings["port"]; !ok {
		settings["port"] = "3306"
	}
	return settings, nil
}

func (m *MySQLModule) UpdateSettings(settings map[string]interface{}) error {
	content, err := m.ReadConfig()
	if err != nil {
		return err
	}

	lines := strings.Split(content, "\n")
	newSettings := make(map[string]string)
	for k, v := range settings {
		if val, ok := v.(string); ok && val != "" {
			newSettings[k] = val
		}
	}

	// Track which settings were updated
	updated := make(map[string]bool)

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])

		if newVal, ok := newSettings[key]; ok {
			lines[i] = fmt.Sprintf("%s = %s", key, newVal)
			updated[key] = true
		}
	}

	// Add missing settings to [mysqld] section
	var resultLines []string
	mysqldFound := false

	for _, line := range lines {
		resultLines = append(resultLines, line)
		trimmed := strings.TrimSpace(line)
		if trimmed == "[mysqld]" {
			mysqldFound = true
			// Inject missing settings immediately after [mysqld]
			for key, val := range newSettings {
				if !updated[key] {
					resultLines = append(resultLines, fmt.Sprintf("%s = %s", key, val))
					updated[key] = true
				}
			}
		} else if strings.HasPrefix(trimmed, "[") {
			// Section changed
		}
	}

	if !mysqldFound {
		resultLines = append(resultLines, "[mysqld]")
		for key, val := range newSettings {
			if !updated[key] {
				resultLines = append(resultLines, fmt.Sprintf("%s = %s", key, val))
			}
		}
	}

	return m.WriteConfig(strings.Join(resultLines, "\n"))
}
