package db

import (
	"database/sql"
	"path/filepath"
	"os"
	"prism-server/internal/models"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	var err error
	
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err := createTables(); err != nil {
		return err
	}

	EnsureDefaultAdmin()
	return nil
}

func createTables() error {
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL,
		created_at TEXT NOT NULL
	);`

	projectTable := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		color TEXT,
		created_at TEXT
	);`

	accountTable := `
	CREATE TABLE IF NOT EXISTS service_accounts (
		id TEXT PRIMARY KEY,
		project_id TEXT,
		agent_id TEXT NOT NULL,
		type TEXT NOT NULL,
		name TEXT NOT NULL,
		host TEXT,
		port INTEGER,
		database_name TEXT,
		username TEXT,
		password TEXT,
		role TEXT,
		target_entity TEXT,
		vhost TEXT,
		endpoint TEXT,
		access_key TEXT,
		secret_key TEXT,
		bucket TEXT,
		root_path TEXT,
		app_name TEXT,
		script TEXT,
		cwd TEXT,
		pm2_port INTEGER,
		pm2_proxy_type TEXT,
		pm2_proxy_domain TEXT,
		tags TEXT,
		config TEXT DEFAULT '{}',
		quota INTEGER DEFAULT 0,
		quota_enabled INTEGER DEFAULT 0,
		created_at TEXT,
		FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
	);`

	agentTable := `
	CREATE TABLE IF NOT EXISTS agents (
		id TEXT PRIMARY KEY,
		name TEXT,
		description TEXT,
		hostname TEXT NOT NULL,
		os_info TEXT,
		status TEXT NOT NULL,
		last_seen TEXT NOT NULL,
		created_at TEXT NOT NULL
	);`

	if _, err := DB.Exec(projectTable); err != nil {
		return fmt.Errorf("create projects table: %w", err)
	}
	if _, err := DB.Exec(accountTable); err != nil {
		return fmt.Errorf("create service_accounts table: %w", err)
	}
	if _, err := DB.Exec(agentTable); err != nil {
		return fmt.Errorf("create agents table: %w", err)
	}
	if _, err := DB.Exec(createUsersTable); err != nil {
		return fmt.Errorf("create users table: %w", err)
	}

	// Auto-migrate new columns for existing databases safely
	DB.Exec("ALTER TABLE agents ADD COLUMN name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE agents ADD COLUMN description TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN role TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN target_entity TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN config TEXT DEFAULT '{}'")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN quota INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN quota_enabled INTEGER DEFAULT 0")

	log.Println("Database tables initialized successfully.")
	return nil
}

// Project Operations

func CreateProject(p models.Project) (models.Project, error) {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.CreatedAt == "" {
		p.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	query := `INSERT INTO projects (id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, p.ID, p.Name, p.Description, p.Color, p.CreatedAt)
	if err != nil {
		return p, err
	}
	return p, nil
}

func GetProjects() ([]models.Project, error) {
	query := `SELECT id, name, description, color, created_at FROM projects ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Color, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}

func UpdateProject(p models.Project) error {
	query := `UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ?`
	_, err := DB.Exec(query, p.Name, p.Description, p.Color, p.ID)
	return err
}

func DeleteProject(id string) error {
	// Enable foreign key support in SQLite to allow ON DELETE CASCADE to work
	_, err := DB.Exec("PRAGMA foreign_keys = ON;")
	if err != nil {
		return err
	}
	query := `DELETE FROM projects WHERE id = ?`
	_, err = DB.Exec(query, id)
	return err
}

// Agent Operations

func CreateAgent(a models.Agent) (models.Agent, error) {
	if a.ID == "" {
		a.ID = uuid.NewString() // or we could use hostname if we wanted it strictly 1-1
	}
	if a.CreatedAt == "" {
		a.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if a.LastSeen == "" {
		a.LastSeen = time.Now().UTC().Format(time.RFC3339)
	}
	if a.Status == "" {
		a.Status = "pending"
	}

	query := `INSERT INTO agents (id, name, description, hostname, os_info, status, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, a.ID, a.Name, a.Description, a.Hostname, a.OSInfo, a.Status, a.LastSeen, a.CreatedAt)
	if err != nil {
		return a, err
	}
	return a, nil
}

func GetAgents() ([]models.Agent, error) {
	query := `SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var a models.Agent
		if err := rows.Scan(&a.ID, &a.Name, &a.Description, &a.Hostname, &a.OSInfo, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, nil
}

func GetAgentByHostname(hostname string) (*models.Agent, error) {
	query := `SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents WHERE hostname = ?`
	row := DB.QueryRow(query, hostname)

	var a models.Agent
	if err := row.Scan(&a.ID, &a.Name, &a.Description, &a.Hostname, &a.OSInfo, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &a, nil
}

func GetAgentByID(id string) (*models.Agent, error) {
	query := `SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents WHERE id = ?`
	row := DB.QueryRow(query, id)

	var a models.Agent
	if err := row.Scan(&a.ID, &a.Name, &a.Description, &a.Hostname, &a.OSInfo, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &a, nil
}

func UpdateAgentStatus(id string, status string, name string, description string) error {
	query := `UPDATE agents SET status = ?, name = ?, description = ? WHERE id = ?`
	_, err := DB.Exec(query, status, name, description, id)
	return err
}

func UpdateAgentLastSeen(id string, osInfo string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE agents SET last_seen = ?, os_info = ? WHERE id = ?`
	_, err := DB.Exec(query, now, osInfo, id)
	return err
}

func DeleteAgent(id string) error {
	query := `DELETE FROM agents WHERE id = ?`
	_, err := DB.Exec(query, id)
	return err
}

// User Operations

func CreateUser(u models.User) (models.User, error) {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	if u.CreatedAt == "" {
		u.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	// password should already be hashed by the caller, but we just insert
	query := `INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, u.ID, u.Username, u.Password, u.Role, u.CreatedAt)
	return u, err
}

func GetUserByUsername(username string) (*models.User, error) {
	query := `SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?`
	row := DB.QueryRow(query, username)
	
	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &u, nil
}

func GetUserByID(id string) (*models.User, error) {
	query := `SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?`
	row := DB.QueryRow(query, id)
	
	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &u, nil
}

func GetUsers() ([]models.User, error) {
	query := `SELECT id, username, role, created_at FROM users ORDER BY created_at ASC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func UpdateUserPassword(id, newHash string) error {
	query := `UPDATE users SET password_hash = ? WHERE id = ?`
	_, err := DB.Exec(query, newHash, id)
	return err
}

func UpdateUser(u models.User) error {
	if u.Password != "" {
		query := `UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?`
		_, err := DB.Exec(query, u.Username, u.Role, u.Password, u.ID)
		return err
	} else {
		query := `UPDATE users SET username = ?, role = ? WHERE id = ?`
		_, err := DB.Exec(query, u.Username, u.Role, u.ID)
		return err
	}
}

func UpdateUserRole(id, role string) error {
	query := `UPDATE users SET role = ? WHERE id = ?`
	_, err := DB.Exec(query, role, id)
	return err
}

func DeleteUser(id string) error {
	query := `DELETE FROM users WHERE id = ?`
	_, err := DB.Exec(query, id)
	return err
}

// EnsureDefaultAdmin creates an 'admin' account if no users exist.
func EnsureDefaultAdmin() {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil || count > 0 {
		return // users already exist
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash default admin password: %v", err)
		return
	}

	admin := models.User{
		Username: "admin",
		Password: string(hash),
		Role:     "admin",
	}
	if _, err := CreateUser(admin); err != nil {
		log.Printf("Failed to seed default admin user: %v", err)
	} else {
		log.Println("Seeded default 'admin' user with password 'admin123'")
	}
}
