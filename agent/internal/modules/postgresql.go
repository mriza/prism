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
	// Common paths: /etc/postgresql/16/main/postgresql.conf (Debian) or /var/lib/pgsq/data/postgresql.conf (RHEL)
	// For now, return a generic path or detect. 
	// Let's assume a standard location or the one most likely to be edited.
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
