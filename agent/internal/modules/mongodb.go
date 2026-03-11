package modules

import (
	"fmt"
	"os/exec"
	"prism-agent/internal/core"
	"strings"
)

type MongoDBModule struct {
	*SystemdModule
}

func NewMongoDBModule() *MongoDBModule {
	return &MongoDBModule{
		SystemdModule: NewSystemdModule("mongodb", "mongod", false),
	}
}

// Ensure Interface Compatibility
var _ core.ServiceModule = (*MongoDBModule)(nil)

func (m *MongoDBModule) GetFacts() (map[string]string, error) {
	facts, _ := m.SystemdModule.GetFacts()

	// Add Version - mongosh is typically available on modern mongodb installations
	out, err := exec.Command("mongosh", "--nodb", "--quiet", "--eval", "print(version())").Output()
	if err == nil {
		facts["version"] = strings.TrimSpace(string(out))
	} else {
		// Fallback to mongo shell
		out, err = exec.Command("mongo", "--nodb", "--quiet", "--eval", "print(version())").Output()
		if err == nil {
			facts["version"] = strings.TrimSpace(string(out))
		}
	}
	return facts, nil
}

// Helper to determine which mongo shell to use
func getMongoCmd() string {
	if err := exec.Command("mongosh", "--version").Run(); err == nil {
		return "mongosh"
	}
	return "mongo"
}

// Database Management Methods
func (m *MongoDBModule) ListDatabases() ([]string, error) {
	cmd := getMongoCmd()
	out, err := exec.Command(cmd, "--quiet", "--eval", "db.adminCommand('listDatabases').databases.forEach(d => print(d.name))").Output()
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
	out, err := exec.Command(cmd, "--quiet", "--eval", evalCmd).Output()
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

	err := exec.Command(cmd, "--quiet", "--eval", script).Run()
	if err != nil {
		return fmt.Errorf("failed to create/update mongodb user: %v", err)
	}

	// 2. Create the dummy collection so the DB is actually instantiated
	if database != "admin" {
		createCollEval := fmt.Sprintf(`db.getSiblingDB('%s').createCollection('_prism_init')`, database)
		exec.Command(cmd, "--quiet", "--eval", createCollEval).Run()
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
		role = "readWrite"
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

	err := exec.Command(cmd, "--quiet", "--eval", updateUserEval).Run()
	if err != nil {
		return fmt.Errorf("failed to update user privileges: %v", err)
	}

	return nil
}
