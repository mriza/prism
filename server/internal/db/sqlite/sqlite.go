package sqlite

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

// Database wraps SQLite connection
type Database struct {
	conn *sql.DB
}

// User represents a user in the system
type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"password"`
	FullName  string    `json:"full_name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// Agent represents an agent in the system
type Agent struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Hostname    string    `json:"hostname"`
	OSInfo      string    `json:"os_info"`
	Status      string    `json:"status"`
	LastSeen    time.Time `json:"last_seen"`
	CreatedAt   time.Time `json:"created_at"`
}

// Event represents an event in the system
type Event struct {
	ID        string    `json:"id"`
	AgentID   string    `json:"agent_id"`
	AgentName string    `json:"agent_name"`
	Type      string    `json:"type"`
	Service   string    `json:"service"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// Project represents a project
type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	CreatedAt   time.Time `json:"created_at"`
}

// ServiceAccount represents a service account
type ServiceAccount struct {
	ID             string                 `json:"id"`
	ProjectID      string                 `json:"project_id"`
	AgentID        string                 `json:"agent_id"`
	Type           string                 `json:"type"`
	Name           string                 `json:"name"`
	Host           string                 `json:"host"`
	Port           int                    `json:"port"`
	DatabaseName   string                 `json:"database_name"`
	Username       string                 `json:"username"`
	Password       string                 `json:"password"`
	Role           string                 `json:"role"`
	TargetEntity   string                 `json:"target_entity"`
	Vhost          string                 `json:"vhost"`
	Endpoint       string                 `json:"endpoint"`
	AccessKey      string                 `json:"access_key"`
	SecretKey      string                 `json:"secret_key"`
	Bucket         string                 `json:"bucket"`
	RootPath       string                 `json:"root_path"`
	AppName        string                 `json:"app_name"`
	Script         string                 `json:"script"`
	Cwd            string                 `json:"cwd"`
	PM2Port        int                    `json:"pm2_port"`
	PM2ProxyType   string                 `json:"pm2_proxy_type"`
	PM2ProxyDomain string                 `json:"pm2_proxy_domain"`
	Tags           string                 `json:"tags"`
	Config         map[string]interface{} `json:"config"`
	Quota          int                    `json:"quota"`
	QuotaEnabled   int                    `json:"quota_enabled"`
	CreatedAt      time.Time              `json:"created_at"`
}

// Setting represents a system setting
type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewDatabase creates a new SQLite database connection
func NewDatabase(dbPath string) (*Database, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &Database{conn: conn}

	if err := db.createTables(); err != nil {
		return nil, err
	}

	log.Println("SQLite database initialized")
	return db, nil
}

// Close closes the database connection
func (db *Database) Close() error {
	return db.conn.Close()
}

// createTables creates all necessary tables
func (db *Database) createTables() error {
	tables := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			full_name TEXT DEFAULT '',
			email TEXT DEFAULT '',
			phone TEXT DEFAULT '',
			role TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS agents (
			id TEXT PRIMARY KEY,
			name TEXT DEFAULT '',
			description TEXT DEFAULT '',
			hostname TEXT NOT NULL,
			os_info TEXT,
			status TEXT NOT NULL,
			last_seen TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			agent_id TEXT NOT NULL,
			type TEXT NOT NULL,
			service TEXT,
			status TEXT,
			message TEXT,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			color TEXT,
			created_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS service_accounts (
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
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
	}

	for _, table := range tables {
		if _, err := db.conn.Exec(table); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	// Auto-migrate new columns
	migrations := []string{
		`ALTER TABLE agents ADD COLUMN name TEXT DEFAULT ''`,
		`ALTER TABLE agents ADD COLUMN description TEXT DEFAULT ''`,
		`ALTER TABLE service_accounts ADD COLUMN role TEXT DEFAULT ''`,
		`ALTER TABLE service_accounts ADD COLUMN target_entity TEXT DEFAULT ''`,
		`ALTER TABLE service_accounts ADD COLUMN config TEXT DEFAULT '{}'`,
		`ALTER TABLE service_accounts ADD COLUMN quota INTEGER DEFAULT 0`,
		`ALTER TABLE service_accounts ADD COLUMN quota_enabled INTEGER DEFAULT 0`,
		`ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''`,
	}

	for _, migration := range migrations {
		db.conn.Exec(migration) // Ignore errors (column might already exist)
	}

	log.Println("Database tables created successfully")
	return nil
}

// EnsureDefaultAdmin creates default admin user if none exists
func (db *Database) EnsureDefaultAdmin() error {
	var count int
	err := db.conn.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil || count > 0 {
		return nil // Users already exist
	}

	// Generate secure random password
	randomPassword := generateSecurePassword(16)
	hash, err := bcrypt.GenerateFromPassword([]byte(randomPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	_, err = db.conn.Exec(
		`INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
		uuid.NewString(),
		"admin",
		string(hash),
		"admin",
		time.Now().UTC().Format(time.RFC3339),
	)

	if err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	log.Println("=========================================================")
	log.Println("FIRST BOOT: Created default admin user")
	log.Printf("FIRST BOOT: Username: admin")
	log.Printf("FIRST BOOT: Password: %s", randomPassword)
	log.Println("FIRST BOOT: CHANGE THIS PASSWORD IMMEDIATELY!")
	log.Println("=========================================================")
	return nil
}

// generateSecurePassword generates a cryptographically secure random password
func generateSecurePassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"
	password := make([]byte, length)
	for i := range password {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			password[i] = charset[i%len(charset)]
		} else {
			password[i] = charset[n.Int64()]
		}
	}
	return string(password)
}

// EnsureDefaultSettings creates default settings if none exist
func (db *Database) EnsureDefaultSettings() error {
	settings := map[string]string{
		"heartbeatInterval": "15000",
		"uiRefreshRate":     "10000",
	}

	for key, value := range settings {
		var exists int
		err := db.conn.QueryRow("SELECT COUNT(*) FROM settings WHERE key = ?", key).Scan(&exists)
		if err != nil || exists > 0 {
			continue
		}

		_, err = db.conn.Exec(
			`INSERT INTO settings (key, value) VALUES (?, ?)`,
			key,
			value,
		)
		if err != nil {
			return err
		}
	}

	log.Println("Default settings created")
	return nil
}

// User Operations

func (db *Database) CreateUser(user User) error {
	_, err := db.conn.Exec(
		`INSERT INTO users (id, username, password_hash, full_name, email, phone, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID,
		user.Username,
		user.Password,
		user.FullName,
		user.Email,
		user.Phone,
		user.Role,
		user.CreatedAt.Format(time.RFC3339),
	)
	return err
}

func (db *Database) GetUserByUsername(username string) (*User, error) {
	var user User
	var createdAt string
	err := db.conn.QueryRow(
		`SELECT id, username, password_hash, full_name, email, phone, role, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&user.ID, &user.Username, &user.Password, &user.FullName, &user.Email, &user.Phone, &user.Role, &createdAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	user.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return &user, nil
}

func (db *Database) GetUsers() ([]User, error) {
	rows, err := db.conn.Query(`SELECT id, username, full_name, email, phone, role, created_at FROM users ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var createdAt string
		if err := rows.Scan(&user.ID, &user.Username, &user.FullName, &user.Email, &user.Phone, &user.Role, &createdAt); err != nil {
			return nil, err
		}
		user.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		users = append(users, user)
	}
	return users, nil
}

func (db *Database) UpdateUser(user User) error {
	_, err := db.conn.Exec(
		`UPDATE users SET username = ?, full_name = ?, email = ?, phone = ?, role = ? WHERE id = ?`,
		user.Username,
		user.FullName,
		user.Email,
		user.Phone,
		user.Role,
		user.ID,
	)
	return err
}

func (db *Database) DeleteUser(id string) error {
	_, err := db.conn.Exec(`DELETE FROM users WHERE id = ?`, id)
	return err
}

// Agent Operations

func (db *Database) CreateAgent(agent Agent) error {
	_, err := db.conn.Exec(
		`INSERT INTO agents (id, name, description, hostname, os_info, status, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		agent.ID,
		agent.Name,
		agent.Description,
		agent.Hostname,
		agent.OSInfo,
		agent.Status,
		agent.LastSeen.Format(time.RFC3339),
		agent.CreatedAt.Format(time.RFC3339),
	)
	return err
}

func (db *Database) GetAgents() ([]Agent, error) {
	rows, err := db.conn.Query(`SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []Agent
	for rows.Next() {
		var agent Agent
		var lastSeen, createdAt string
		if err := rows.Scan(&agent.ID, &agent.Name, &agent.Description, &agent.Hostname, &agent.OSInfo, &agent.Status, &lastSeen, &createdAt); err != nil {
			return nil, err
		}
		agent.LastSeen, _ = time.Parse(time.RFC3339, lastSeen)
		agent.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		agents = append(agents, agent)
	}
	return agents, nil
}

func (db *Database) GetAgentByHostname(hostname string) (*Agent, error) {
	var agent Agent
	var lastSeen, createdAt string
	err := db.conn.QueryRow(
		`SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents WHERE hostname = ?`,
		hostname,
	).Scan(&agent.ID, &agent.Name, &agent.Description, &agent.Hostname, &agent.OSInfo, &agent.Status, &lastSeen, &createdAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	agent.LastSeen, _ = time.Parse(time.RFC3339, lastSeen)
	agent.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return &agent, nil
}

func (db *Database) GetAgentByID(id string) (*Agent, error) {
	var agent Agent
	var lastSeen, createdAt string
	err := db.conn.QueryRow(
		`SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents WHERE id = ?`,
		id,
	).Scan(&agent.ID, &agent.Name, &agent.Description, &agent.Hostname, &agent.OSInfo, &agent.Status, &lastSeen, &createdAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	agent.LastSeen, _ = time.Parse(time.RFC3339, lastSeen)
	agent.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	return &agent, nil
}

func (db *Database) UpdateAgentStatus(id, status, name, description string) error {
	_, err := db.conn.Exec(
		`UPDATE agents SET status = ?, name = ?, description = ? WHERE id = ?`,
		status,
		name,
		description,
		id,
	)
	return err
}

func (db *Database) UpdateAgentLastSeen(id, osInfo string) error {
	_, err := db.conn.Exec(
		`UPDATE agents SET last_seen = ?, os_info = ? WHERE id = ?`,
		time.Now().UTC().Format(time.RFC3339),
		osInfo,
		id,
	)
	return err
}

func (db *Database) DeleteAgent(id string) error {
	_, err := db.conn.Exec(`DELETE FROM agents WHERE id = ?`, id)
	return err
}

// Event Operations

func (db *Database) CreateEvent(event Event) error {
	_, err := db.conn.Exec(
		`INSERT INTO events (id, agent_id, type, service, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		event.ID,
		event.AgentID,
		event.Type,
		event.Service,
		event.Status,
		event.Message,
		event.CreatedAt.Format(time.RFC3339),
	)
	return err
}

func (db *Database) GetEvents(limit int) ([]Event, error) {
	rows, err := db.conn.Query(`
		SELECT e.id, e.agent_id, a.name, e.type, e.service, e.status, e.message, e.created_at
		FROM events e
		LEFT JOIN agents a ON e.agent_id = a.id
		ORDER BY e.created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		var agentName sql.NullString
		var createdAt string
		if err := rows.Scan(&event.ID, &event.AgentID, &agentName, &event.Type, &event.Service, &event.Status, &event.Message, &createdAt); err != nil {
			return nil, err
		}
		if agentName.Valid {
			event.AgentName = agentName.String
		}
		event.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		events = append(events, event)
	}
	return events, nil
}

func (db *Database) GetEventsByAgent(agentID string, limit int) ([]Event, error) {
	rows, err := db.conn.Query(`
		SELECT id, agent_id, type, service, status, message, created_at
		FROM events
		WHERE agent_id = ?
		ORDER BY created_at DESC
		LIMIT ?`, agentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var event Event
		var createdAt string
		if err := rows.Scan(&event.ID, &event.AgentID, &event.Type, &event.Service, &event.Status, &event.Message, &createdAt); err != nil {
			return nil, err
		}
		event.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		events = append(events, event)
	}
	return events, nil
}

// Project Operations

func (db *Database) CreateProject(project Project) error {
	_, err := db.conn.Exec(
		`INSERT INTO projects (id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?)`,
		project.ID,
		project.Name,
		project.Description,
		project.Color,
		project.CreatedAt.Format(time.RFC3339),
	)
	return err
}

func (db *Database) GetProjects() ([]Project, error) {
	rows, err := db.conn.Query(`SELECT id, name, description, color, created_at FROM projects ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var project Project
		var createdAt string
		if err := rows.Scan(&project.ID, &project.Name, &project.Description, &project.Color, &createdAt); err != nil {
			return nil, err
		}
		project.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		projects = append(projects, project)
	}
	return projects, nil
}

func (db *Database) UpdateProject(project Project) error {
	_, err := db.conn.Exec(
		`UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ?`,
		project.Name,
		project.Description,
		project.Color,
		project.ID,
	)
	return err
}

func (db *Database) DeleteProject(id string) error {
	_, err := db.conn.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

// Service Account Operations

func (db *Database) CreateServiceAccount(account ServiceAccount) error {
	configJSON := "{}"
	if len(account.Config) > 0 {
		if b, err := json.Marshal(account.Config); err == nil {
			configJSON = string(b)
		}
	}

	_, err := db.conn.Exec(
		`INSERT INTO service_accounts (
			id, project_id, agent_id, type, name, host, port, database_name,
			username, password, role, target_entity, vhost, endpoint,
			access_key, secret_key, bucket, root_path, app_name, script,
			cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain, tags,
			config, quota, quota_enabled, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		account.ID,
		account.ProjectID,
		account.AgentID,
		account.Type,
		account.Name,
		account.Host,
		account.Port,
		account.DatabaseName,
		account.Username,
		account.Password,
		account.Role,
		account.TargetEntity,
		account.Vhost,
		account.Endpoint,
		account.AccessKey,
		account.SecretKey,
		account.Bucket,
		account.RootPath,
		account.AppName,
		account.Script,
		account.Cwd,
		account.PM2Port,
		account.PM2ProxyType,
		account.PM2ProxyDomain,
		account.Tags,
		configJSON,
		account.Quota,
		account.QuotaEnabled,
		account.CreatedAt.Format(time.RFC3339),
	)
	return err
}

func (db *Database) GetServiceAccounts(projectID string) ([]ServiceAccount, error) {
	var rows *sql.Rows
	var err error

	if projectID != "" {
		rows, err = db.conn.Query(
			`SELECT id, project_id, agent_id, type, name, host, port, database_name,
				username, password, role, target_entity, vhost, endpoint,
				access_key, secret_key, bucket, root_path, app_name, script,
				cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain, tags,
				config, quota, quota_enabled, created_at
			FROM service_accounts WHERE project_id = ? ORDER BY created_at DESC`,
			projectID,
		)
	} else {
		rows, err = db.conn.Query(
			`SELECT id, project_id, agent_id, type, name, host, port, database_name,
				username, password, role, target_entity, vhost, endpoint,
				access_key, secret_key, bucket, root_path, app_name, script,
				cwd, pm2_port, pm2_proxy_type, pm2_proxy_domain, tags,
				config, quota, quota_enabled, created_at
			FROM service_accounts ORDER BY created_at DESC`,
		)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []ServiceAccount
	for rows.Next() {
		var account ServiceAccount
		var createdAt string
		var configJSON string
		if err := rows.Scan(
			&account.ID, &account.ProjectID, &account.AgentID, &account.Type, &account.Name,
			&account.Host, &account.Port, &account.DatabaseName, &account.Username,
			&account.Password, &account.Role, &account.TargetEntity, &account.Vhost,
			&account.Endpoint, &account.AccessKey, &account.SecretKey, &account.Bucket,
			&account.RootPath, &account.AppName, &account.Script, &account.Cwd,
			&account.PM2Port, &account.PM2ProxyType, &account.PM2ProxyDomain, &account.Tags,
			&configJSON, &account.Quota, &account.QuotaEnabled, &createdAt,
		); err != nil {
			return nil, err
		}
		account.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		if configJSON != "" && configJSON != "{}" {
			if err := json.Unmarshal([]byte(configJSON), &account.Config); err != nil {
				account.Config = map[string]interface{}{}
			}
		}
		accounts = append(accounts, account)
	}
	return accounts, nil
}

// Settings Operations

func (db *Database) GetSettings() (map[string]string, error) {
	rows, err := db.conn.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		settings[key] = value
	}
	return settings, nil
}

func (db *Database) GetSetting(key string) (string, error) {
	var value string
	err := db.conn.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

func (db *Database) UpdateSetting(key, value string) error {
	_, err := db.conn.Exec(
		`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		key,
		value,
	)
	return err
}
