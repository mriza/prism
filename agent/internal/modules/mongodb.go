package modules

import (
	"fmt"
	"os"
	"prism-agent/internal/core"
	"strings"
)

type MongoDBModule struct {
	*SystemdModule
	managementCreds map[string]string
}

func NewMongoDBModule() *MongoDBModule {
	return &MongoDBModule{
		SystemdModule: NewSystemdModule("mongodb", "mongod", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*MongoDBModule)(nil)
var _ core.DatabaseModule = (*MongoDBModule)(nil)
var _ core.ServiceSettings = (*MongoDBModule)(nil)
var _ core.ConfigurableModule = (*MongoDBModule)(nil)
var _ core.ManagementCredentialAware = (*MongoDBModule)(nil)

func (m *MongoDBModule) SetManagementCredentials(creds map[string]string) {
	m.managementCreds = creds
}

func (m *MongoDBModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()

	// Add Version - mongosh is typically available on modern mongodb installations
	out, err := getExecutor().Command("mongosh", "--nodb", "--quiet", "--eval", "print(version())").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	} else {
		// Fallback to mongo shell
		out, err = getExecutor().Command("mongo", "--nodb", "--quiet", "--eval", "print(version())").Output()
		if err == nil {
			facts["version"] = strings.TrimSpace(string(out))
		}
	}
	return facts, nil
}

// Helper to determine which mongo shell to use
func getMongoCmd() string {
	if err := getExecutor().Command("mongosh", "--version").Run(); err == nil {
		return "mongosh"
	}
	return "mongo"
}

// buildMongoCmdArgs appends credentials to args if available
func (m *MongoDBModule) buildMongoCmdArgs(baseArgs ...string) []string {
	var args []string
	if m.managementCreds != nil {
		if user, ok := m.managementCreds["username"]; ok && user != "" {
			args = append(args, "-u", user)
		}
		if pass, ok := m.managementCreds["password"]; ok && pass != "" {
			args = append(args, "-p", pass)
		}
		// Try to extract authSource from connectionParams, otherwise default to admin
		authSource := "admin"
		if params, ok := m.managementCreds["connection_params"]; ok && params != "" {
			if strings.Contains(params, `"authSource"`) {
				// quick extraction, could be improved
				parts := strings.Split(params, `"authSource"`)
				if len(parts) > 1 {
					subparts := strings.Split(parts[1], `"`)
					if len(subparts) > 1 {
						authSource = subparts[1]
					}
				}
			}
		}
		if authSource != "" && m.managementCreds["username"] != "" {
			args = append(args, "--authenticationDatabase", authSource)
		}
	}
	return append(args, baseArgs...)
}

// Database Management Methods
func (m *MongoDBModule) ListDatabases() ([]string, error) {
	cmd := getMongoCmd()
	args := m.buildMongoCmdArgs("--quiet", "--eval", "db.adminCommand('listDatabases').databases.forEach(d => print(d.name))")
	out, err := getExecutor().Command(cmd, args...).Output()
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

func (m *MongoDBModule) CreateDatabase(name string) error {
	// Not directly supported as standard since DB is created implicitly.
	// But returning nil satisfies interface.
	return nil
}

func (m *MongoDBModule) ListUsers() ([]string, error) {
	cmd := getMongoCmd()
	evalCmd := "db.getSiblingDB('admin').system.users.find({}, {user:1, db:1}).forEach(u => print(u.user + '@' + u.db))"
	args := m.buildMongoCmdArgs("--quiet", "--eval", evalCmd)
	out, err := getExecutor().Command(cmd, args...).Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(out), "\n")
	var users []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			users = append(users, line)
		}
	}
	return users, nil
}

func (m *MongoDBModule) CreateUser(name, password, role, target string) error {
	// Parse username to see if a DB is specified (user@db)
	username := name
	database := "admin" // Default target DB

	if strings.Contains(name, "@") {
		parts := strings.Split(name, "@")
		username = parts[0]
		database = parts[1]
	}

	if role == "" {
		role = "readWrite" // Default role
	} else {
		switch strings.ToLower(role) {
		case "read":
			role = "read"
		case "write", "readwrite":
			role = "readWrite"
		case "admin", "all", "all privileges":
			role = "dbAdmin"
		}
	}

	cmd := getMongoCmd()

	roleDoc := fmt.Sprintf(`{ role: "%s", db: "%s" }`, role, database)
	if target != "" && target != "*" {
		roleDoc = fmt.Sprintf(`{ role: "%s", db: "%s", collection: "%s" }`, role, database, target)
	}

	// Idempotent approach: Try to update first. If user doesn't exist, it might fail or do nothing depending on version.
	// Actually, the most robust way is to try createUser and if it fails with "already exists", call updateUser.
	script := fmt.Sprintf(`
		try {
			db.getSiblingDB('%s').createUser({
				user: '%s',
				pwd: '%s',
				roles: [ %s ]
			});
		} catch (e) {
			if (e.message.includes('already exists')) {
				db.getSiblingDB('%s').updateUser('%s', {
					pwd: '%s',
					roles: [ %s ]
				});
			} else {
				throw e;
			}
		}
	`, database, username, password, roleDoc, database, username, password, roleDoc)

	args := m.buildMongoCmdArgs("--quiet", "--eval", script)
	err := getExecutor().Command(cmd, args...).Run()
	if err != nil {
		return fmt.Errorf("failed to create/update mongodb user: %v", err)
	}

	// 2. Create the dummy collection so the DB is actually instantiated
	if database != "admin" {
		createCollEval := fmt.Sprintf(`db.getSiblingDB('%s').createCollection('_prism_init')`, database)
		args := m.buildMongoCmdArgs("--quiet", "--eval", createCollEval)
		getExecutor().Command(cmd, args...).Run()
	}

	return nil
}

func (m *MongoDBModule) UpdatePrivileges(name, role, target string) error {
	username := name
	database := "admin"

	if strings.Contains(name, "@") {
		parts := strings.Split(name, "@")
		username = parts[0]
		database = parts[1]
	}

	if role == "" {
		role = "readWrite" // Default role
	} else {
		switch strings.ToLower(role) {
		case "read":
			role = "read"
		case "write", "readwrite":
			role = "readWrite"
		case "admin", "all", "all privileges":
			role = "dbAdmin"
		}
	}

	cmd := getMongoCmd()

	roleDoc := fmt.Sprintf(`{ role: "%s", db: "%s" }`, role, database)
	if target != "" && target != "*" {
		roleDoc = fmt.Sprintf(`{ role: "%s", db: "%s", collection: "%s" }`, role, database, target)
	}

	updateUserEval := fmt.Sprintf(`
		var res = db.getSiblingDB('%s').updateUser('%s', {
			roles: [ %s ]
		});
		if (res) print(res);
	`, database, username, roleDoc)

	args := m.buildMongoCmdArgs("--quiet", "--eval", updateUserEval)
	err := getExecutor().Command(cmd, args...).Run()
	if err != nil {
		return fmt.Errorf("failed to update user privileges: %v", err)
	}

	return nil
}

// --- ConfigurableModule Implementation ---

func (m *MongoDBModule) GetConfigPath() string {
	return "/etc/mongod.conf"
}

func (m *MongoDBModule) ReadConfig() (string, error) {
	content, err := os.ReadFile(m.GetConfigPath())
	return string(content), err
}

func (m *MongoDBModule) WriteConfig(content string) error {
	if err := os.WriteFile(m.GetConfigPath(), []byte(content), 0644); err != nil {
		return err
	}
	return m.Restart()
}

// --- ServiceSettings Implementation ---

func (m *MongoDBModule) GetSettings() (map[string]interface{}, error) {
	settings := map[string]interface{}{
		"port":    "27017",
		"bind":    "127.0.0.1",
		"dbpath":  "/var/lib/mongodb",
		"logpath": "/var/log/mongodb/mongod.log",
	}

	content, err := m.ReadConfig()
	if err != nil {
		return settings, nil
	}

	// Parse mongod.conf (YAML) by tracking current section
	section := ""
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		// Detect top-level section (no leading whitespace, ends with ":")
		if !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") && strings.HasSuffix(trimmed, ":") {
			section = strings.TrimSuffix(trimmed, ":")
			continue
		}
		parts := strings.SplitN(trimmed, ":", 2)
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if val == "" {
			continue
		}
		switch section {
		case "net":
			switch key {
			case "port":
				settings["port"] = val
			case "bindIp", "bindip":
				settings["bind"] = val
			}
		case "storage":
			if key == "dbPath" || key == "dbpath" {
				settings["dbpath"] = val
			}
		case "systemLog":
			if key == "path" {
				settings["logpath"] = val
			}
		}
	}

	return settings, nil
}

func (m *MongoDBModule) UpdateSettings(settings map[string]interface{}) error {
	content, err := m.ReadConfig()
	if err != nil {
		return err
	}

	lines := strings.Split(content, "\n")
	updated := make(map[string]bool)

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			continue
		}
		parts := strings.SplitN(trimmed, ":", 2)
		if len(parts) < 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])

		if newVal, ok := settings[key].(string); ok && newVal != "" {
			// preserve indentation
			idx := strings.Index(line, key+":")
			indent := line[:idx]
			lines[i] = fmt.Sprintf("%s%s: %s", indent, key, newVal)
			updated[key] = true
		} else if key == "authorization" {
			if auth, ok := settings["auth_enabled"].(string); ok {
				idx := strings.Index(line, key+":")
				indent := line[:idx]
				lines[i] = fmt.Sprintf("%s%s: %s", indent, key, auth)
				updated["auth_enabled"] = true
			}
		}
	}

	// Add missing settings with basic nesting logic
	var resultLines []string
	netFound := false
	storageFound := false
	securityFound := false

	for _, line := range lines {
		resultLines = append(resultLines, line)
		trimmed := strings.TrimSpace(line)
		if trimmed == "net:" {
			netFound = true
			if port, ok := settings["port"].(string); ok && !updated["port"] {
				resultLines = append(resultLines, "  port: "+port)
				updated["port"] = true
			}
			if bindIp, ok := settings["bindIp"].(string); ok && !updated["bindIp"] {
				resultLines = append(resultLines, "  bindIp: "+bindIp)
				updated["bindIp"] = true
			}
		} else if trimmed == "storage:" {
			storageFound = true
			if dbPath, ok := settings["dbPath"].(string); ok && !updated["dbPath"] {
				resultLines = append(resultLines, "  dbPath: "+dbPath)
				updated["dbPath"] = true
			}
		} else if trimmed == "systemLog:" {
			if logPath, ok := settings["logPath"].(string); ok && !updated["logPath"] {
				resultLines = append(resultLines, "  destination: file")
				resultLines = append(resultLines, "  path: "+logPath)
				updated["logPath"] = true
			}
		} else if trimmed == "security:" {
			securityFound = true
			if auth, ok := settings["auth_enabled"].(string); ok && !updated["auth_enabled"] {
				resultLines = append(resultLines, "  authorization: "+auth)
				updated["auth_enabled"] = true
			}
		}
	}

	// Add entire sections if missing
	if !netFound && (settings["port"] != nil || settings["bindIp"] != nil) {
		resultLines = append(resultLines, "net:")
		if port, ok := settings["port"].(string); ok {
			resultLines = append(resultLines, "  port: "+port)
		}
		if bindIp, ok := settings["bindIp"].(string); ok {
			resultLines = append(resultLines, "  bindIp: "+bindIp)
		}
	}
	if !storageFound && settings["dbPath"] != nil {
		resultLines = append(resultLines, "storage:", "  dbPath: "+settings["dbPath"].(string))
	}
	if !securityFound && settings["auth_enabled"] != nil {
		resultLines = append(resultLines, "security:", "  authorization: "+settings["auth_enabled"].(string))
	}

	return m.WriteConfig(strings.Join(resultLines, "\n"))
}
