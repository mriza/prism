package modules

import (
	"fmt"
	"os"
	"os/exec"
	"prism-agent/internal/core"
	"strings"
)

type PostgresModule struct {
	*SystemdModule
}

func NewPostgresModule() *PostgresModule {
	return &PostgresModule{
		SystemdModule: NewSystemdModule("postgresql", "postgresql", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*PostgresModule)(nil)
var _ core.DatabaseModule = (*PostgresModule)(nil)

func (m *PostgresModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()
	out, err := exec.Command("psql", "--version").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	}
	return facts, nil
}

func (m *PostgresModule) ListDatabases() ([]string, error) {
	out, err := exec.Command("sudo", "-u", "postgres", "psql", "-t", "-c", "SELECT datname FROM pg_database WHERE datistemplate = false;").Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(out), "\n")
	var dbs []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			dbs = append(dbs, line)
		}
	}
	return dbs, nil
}

func (m *PostgresModule) CreateDatabase(name string) error {
	if !isValidIdentifier(name) {
		return fmt.Errorf("invalid database name")
	}
	// Check if already exists for idempotency
	checkCmd := fmt.Sprintf("SELECT 1 FROM pg_database WHERE datname = '%s'", name)
	out, _ := exec.Command("sudo", "-u", "postgres", "psql", "-t", "-c", checkCmd).Output()
	if strings.TrimSpace(string(out)) == "1" {
		return nil // Already exists
	}

	// Use sudo -u postgres createdb
	return exec.Command("sudo", "-u", "postgres", "createdb", name).Run()
}

func (m *PostgresModule) ListUsers() ([]string, error) {
	out, err := exec.Command("sudo", "-u", "postgres", "psql", "-t", "-c", "SELECT usename FROM pg_user;").Output()
	if err != nil {
		return nil, err
	}
	var users []string
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line != "" && line != "postgres" {
			users = append(users, line)
		}
	}
	return users, nil
}

func (m *PostgresModule) CreateUser(name, password, role, target string) error {
	if !isValidIdentifier(name) {
		return fmt.Errorf("invalid username")
	}
	if err := ValidatePassword(password); err != nil {
		return err
	}
	password = strings.ReplaceAll(password, "'", "''")

	privileges := "ALL PRIVILEGES"
	if role != "" {
		privileges = role
	}

	targetDB := "ALL SEQUENCES IN SCHEMA public"
	targetTables := "ALL TABLES IN SCHEMA public"
	if target != "" && target != "*" && target != "*.*" {
		targetTables = target // E.g., a specific table name
	}

	createUserCmd := fmt.Sprintf("CREATE USER \"%s\" WITH PASSWORD '%s';", name, password)
	if err := exec.Command("sudo", "-u", "postgres", "psql", "-c", createUserCmd).Run(); err != nil {
		return fmt.Errorf("failed to create user: %v", err)
	}

	// Grant on existing tables/sequences
	grantCmd := fmt.Sprintf("GRANT %s ON %s TO \"%s\"; GRANT %s ON %s TO \"%s\";", privileges, targetTables, name, privileges, targetDB, name)
	if targetTables == target { // If a specific table was specified
		grantCmd = fmt.Sprintf("GRANT %s ON TABLE \"%s\" TO \"%s\";", privileges, targetTables, name)
	}

	if err := exec.Command("sudo", "-u", "postgres", "psql", "-c", grantCmd).Run(); err != nil {
		return fmt.Errorf("failed to grant privileges: %v", err)
	}

	// Alter default privileges for future tables/sequences (only if target is all tables)
	if targetTables != target {
		defaultPrivsCmd := fmt.Sprintf("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT %s ON TABLES TO \"%s\"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT %s ON SEQUENCES TO \"%s\";", privileges, name, privileges, name)
		exec.Command("sudo", "-u", "postgres", "psql", "-c", defaultPrivsCmd).Run()
	}

	return nil
}

func (m *PostgresModule) UpdatePrivileges(name, role, target string) error {
	// ... existing implementation
	return nil
}

// --- ConfigurableModule Implementation ---

func (m *PostgresModule) GetConfigPath() string {
	// Try to detect version from installed PostgreSQL
	if out, err := exec.Command("pg_lsclusters", "--no-header").Output(); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				candidate := fmt.Sprintf("/etc/postgresql/%s/main/postgresql.conf", fields[0])
				if _, err := os.Stat(candidate); err == nil {
					return candidate
				}
			}
		}
	}
	// Glob for any installed version
	for _, ver := range []string{"17", "16", "15", "14", "13", "12"} {
		p := fmt.Sprintf("/etc/postgresql/%s/main/postgresql.conf", ver)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	// RHEL/generic fallback
	for _, p := range []string{"/var/lib/pgsql/data/postgresql.conf", "/var/lib/postgresql/data/postgresql.conf"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "/etc/postgresql/16/main/postgresql.conf"
}

func (m *PostgresModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *PostgresModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}

// --- ServiceSettings Implementation ---

func (m *PostgresModule) GetSettings() (map[string]interface{}, error) {
	settings := map[string]interface{}{
		"port": "5432",
		"bind": "localhost",
	}

	content, err := m.ReadConfig()
	if err != nil {
		return settings, nil
	}

	hbaPath := ""
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(strings.Split(parts[1], "#")[0]) // strip inline comments
		val = strings.Trim(val, "' \"")

		switch key {
		case "port":
			settings["port"] = val
		case "listen_addresses":
			settings["bind"] = val
		case "data_directory":
			settings["data_directory"] = val
		case "hba_file":
			hbaPath = val
		}
	}

	// Read pg_hba.conf for acl_rules
	if hbaPath == "" {
		// Derive from config path
		dir := strings.TrimSuffix(m.GetConfigPath(), "postgresql.conf")
		hbaPath = dir + "pg_hba.conf"
	}
	if hbaContent, err := os.ReadFile(hbaPath); err == nil {
		settings["acl_rules"] = string(hbaContent)
	}

	return settings, nil
}

func (m *PostgresModule) UpdateSettings(settings map[string]interface{}) error {
	content, err := m.ReadConfig()
	if err != nil {
		return err
	}

	lines := strings.Split(content, "\n")
	updated := make(map[string]bool)

	// Handle standard settings
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

		if newVal, ok := settings[key].(string); ok && newVal != "" {
			lines[i] = fmt.Sprintf("%s = '%s'", key, newVal)
			updated[key] = true
		}
	}

	// Add missing settings
	for _, key := range []string{"port", "data_directory", "hba_file", "ident_file"} {
		if newVal, ok := settings[key].(string); ok && newVal != "" && !updated[key] {
			lines = append(lines, fmt.Sprintf("%s = '%s'", key, newVal))
		}
	}

	// Handle ACL Rules (pg_hba.conf)
	if aclRules, ok := settings["acl_rules"].(string); ok && aclRules != "" {
		hbaPath, _ := settings["hba_file"].(string)
		if hbaPath == "" {
			// Try to find it from existing config if not in settings
			for _, line := range lines {
				if strings.HasPrefix(strings.TrimSpace(line), "hba_file") {
					parts := strings.SplitN(line, "=", 2)
					if len(parts) >= 2 {
						hbaPath = strings.Trim(strings.TrimSpace(parts[1]), "'\";")
						break
					}
				}
			}
		}
		if hbaPath != "" {
			if err := os.WriteFile(hbaPath, []byte(aclRules), 0640); err != nil {
				return fmt.Errorf("failed to write hba_file: %v", err)
			}
		}
	}

	return m.WriteConfig(strings.Join(lines, "\n"))
}
