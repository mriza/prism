package db

import (
	"context"
	"database/sql"
	"path/filepath"
	"os"
	"prism-server/internal/models"
	"prism-server/internal/valkeycache"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var (
	DB *sql.DB
	CacheClient *valkeycache.Client
	CacheTTL = 5 * time.Minute
)

// CacheConfig holds Valkey cache configuration
type CacheConfig struct {
	Addr     string
	Password string
	DB       int
}

// InitCache initializes Valkey cache client
func InitCache(ctx context.Context, cfg CacheConfig) error {
	if cfg.Addr == "" {
		log.Println("Valkey cache disabled (no address configured)")
		return nil
	}

	cacheCfg := valkeycache.DefaultConfig()
	cacheCfg.Addr = cfg.Addr
	cacheCfg.Password = cfg.Password
	cacheCfg.DB = cfg.DB

	var err error
	CacheClient, err = valkeycache.NewClient(ctx, cacheCfg)
	if err != nil {
		log.Printf("Warning: failed to initialize Valkey cache: %v", err)
		log.Println("Continuing without cache layer")
		return nil
	}

	log.Printf("Valkey cache initialized at %s", cfg.Addr)
	return nil
}

// invalidateCache deletes a key from cache (ignores errors)
func invalidateCache(ctx context.Context, key string) {
	if CacheClient != nil {
		if err := CacheClient.Delete(ctx, key); err != nil {
			log.Printf("Warning: failed to invalidate cache key %s: %v", key, err)
		} else {
			log.Printf("[CACHE INVALIDATED] %s", key)
		}
	}
}

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
	EnsureDefaultSettings()

	// Handle emergency admin reset via env var
	if os.Getenv("PRISM_RESET_ADMIN") == "true" {
		log.Println("PRISM_RESET_ADMIN environment variable detected. Running emergency reset...")
		EmergencyResetAdmin()
	}

	return nil
}

func createTables() error {
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		full_name TEXT DEFAULT '',
		email TEXT DEFAULT '',
		phone TEXT DEFAULT '',
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

	eventsTable := `
	CREATE TABLE IF NOT EXISTS events (
		id TEXT PRIMARY KEY,
		agent_id TEXT NOT NULL,
		type TEXT NOT NULL,
		service TEXT,
		status TEXT,
		message TEXT,
		created_at TEXT NOT NULL
	);`

	settingsTable := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
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
	if _, err := DB.Exec(settingsTable); err != nil {
		return fmt.Errorf("create settings table: %w", err)
	}
	if _, err := DB.Exec(eventsTable); err != nil {
		return fmt.Errorf("create events table: %w", err)
	}

	// Auto-migrate new columns for existing databases safely
	DB.Exec("ALTER TABLE agents ADD COLUMN name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE agents ADD COLUMN description TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN role TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN target_entity TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN config TEXT DEFAULT '{}'")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN quota INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN quota_enabled INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''")

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
	invalidateCache(context.Background(), "agents:all")
	return a, nil
}

func GetAgents() ([]models.Agent, error) {
	ctx := context.Background()
	
	// Try cache first
	if CacheClient != nil {
		var cached []models.Agent
		if err := CacheClient.Get(ctx, "agents:all", &cached); err == nil {
			log.Printf("[CACHE HIT] agents:all")
			return cached, nil
		}
		log.Printf("[CACHE MISS] agents:all")
	}
	
	// Query database
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
	
	// Cache result
	if CacheClient != nil && len(agents) > 0 {
		CacheClient.Set(ctx, "agents:all", agents, CacheTTL)
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
	if err == nil {
		invalidateCache(context.Background(), "agents:all")
	}
	return err
}

func UpdateAgentLastSeen(id string, osInfo string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	query := `UPDATE agents SET last_seen = ?, os_info = ? WHERE id = ?`
	_, err := DB.Exec(query, now, osInfo, id)
	return err
}

// ReplaceAgentID updates the primary key of an agent row (e.g. when the same host reconnects with a new UUID).
func ReplaceAgentID(oldID, newID string) error {
	query := `UPDATE agents SET id = ? WHERE id = ?`
	_, err := DB.Exec(query, newID, oldID)
	if err == nil {
		invalidateCache(context.Background(), "agents:all")
	}
	return err
}

func DeleteAgent(id string) error {
	query := `DELETE FROM agents WHERE id = ?`
	_, err := DB.Exec(query, id)
	if err == nil {
		invalidateCache(context.Background(), "agents:all")
	}
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
	query := `INSERT INTO users (id, username, password_hash, full_name, email, phone, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, u.ID, u.Username, u.Password, u.FullName, u.Email, u.Phone, u.Role, u.CreatedAt)
	return u, err
}

func GetUserByUsername(username string) (*models.User, error) {
	query := `SELECT id, username, password_hash, full_name, email, phone, role, created_at FROM users WHERE username = ?`
	row := DB.QueryRow(query, username)
	
	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Password, &u.FullName, &u.Email, &u.Phone, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &u, nil
}

func GetUserByID(id string) (*models.User, error) {
	query := `SELECT id, username, password_hash, full_name, email, phone, role, created_at FROM users WHERE id = ?`
	row := DB.QueryRow(query, id)
	
	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Password, &u.FullName, &u.Email, &u.Phone, &u.Role, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, err
	}
	return &u, nil
}

func GetUsers() ([]models.User, error) {
	query := `SELECT id, username, full_name, email, phone, role, created_at FROM users ORDER BY created_at ASC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.Email, &u.Phone, &u.Role, &u.CreatedAt); err != nil {
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
		query := `UPDATE users SET username = ?, full_name = ?, email = ?, phone = ?, role = ?, password_hash = ? WHERE id = ?`
		_, err := DB.Exec(query, u.Username, u.FullName, u.Email, u.Phone, u.Role, u.Password, u.ID)
		return err
	} else {
		query := `UPDATE users SET username = ?, full_name = ?, email = ?, phone = ?, role = ? WHERE id = ?`
		_, err := DB.Exec(query, u.Username, u.FullName, u.Email, u.Phone, u.Role, u.ID)
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

// Event Operations

func CreateEvent(e models.Event) (models.Event, error) {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.CreatedAt == "" {
		e.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	query := `INSERT INTO events (id, agent_id, type, service, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, e.ID, e.AgentID, e.Type, e.Service, e.Status, e.Message, e.CreatedAt)
	return e, err
}

func GetEvents(limit int) ([]models.Event, error) {
	query := `
		SELECT e.id, e.agent_id, a.name, e.type, e.service, e.status, e.message, e.created_at 
		FROM events e
		LEFT JOIN agents a ON e.agent_id = a.id
		ORDER BY e.created_at DESC 
		LIMIT ?`
	
	rows, err := DB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var e models.Event
		var agentName sql.NullString
		if err := rows.Scan(&e.ID, &e.AgentID, &agentName, &e.Type, &e.Service, &e.Status, &e.Message, &e.CreatedAt); err != nil {
			return nil, err
		}
		if agentName.Valid {
			e.AgentName = agentName.String
		}
		events = append(events, e)
	}
	return events, nil
}

func GetEventsFiltered(agentID, service string, limit int) ([]models.Event, error) {
	// Support matching by either agent UUID or hostname
	query := `
		SELECT e.id, e.agent_id, a.name, e.type, e.service, e.status, e.message, e.created_at 
		FROM events e
		LEFT JOIN agents a ON e.agent_id = a.id
		WHERE (e.agent_id = ? OR a.hostname = ?) AND e.service = ? COLLATE NOCASE
		ORDER BY e.created_at DESC 
		LIMIT ?`
	
	rows, err := DB.Query(query, agentID, agentID, service, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var e models.Event
		var agentName sql.NullString
		if err := rows.Scan(&e.ID, &e.AgentID, &agentName, &e.Type, &e.Service, &e.Status, &e.Message, &e.CreatedAt); err != nil {
			return nil, err
		}
		if agentName.Valid {
			e.AgentName = agentName.String
		}
		events = append(events, e)
	}
	return events, nil
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

// EmergencyResetAdmin force-updates the administrator password to 'admin123'
func EmergencyResetAdmin() {
	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash emergency admin password: %v", err)
		return
	}

	// Update password for 'admin' user
	query := `UPDATE users SET password_hash = ? WHERE username = 'admin'`
	res, err := DB.Exec(query, string(hash))
	if err != nil {
		log.Printf("Failed to execute emergency reset query: %v", err)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		// If 'admin' doesn't exist, create it
		admin := models.User{
			Username: "admin",
			Password: string(hash),
			Role:     "admin",
		}
		if _, err := CreateUser(admin); err != nil {
			log.Printf("Emergency reset failed to create admin user: %v", err)
		} else {
			log.Println("Emergency reset: Created missing 'admin' user with password 'admin123'")
		}
	} else {
		log.Println("Emergency reset: Successfully reset 'admin' password to 'admin123'")
	}
}

// Setting Operations

func GetSettings() ([]models.Setting, error) {
	ctx := context.Background()
	
	// Try cache first
	if CacheClient != nil {
		var cached []models.Setting
		if err := CacheClient.Get(ctx, "settings:all", &cached); err == nil {
			log.Printf("[CACHE HIT] settings:all")
			return cached, nil
		}
		log.Printf("[CACHE MISS] settings:all")
	}
	
	// Query database
	query := `SELECT key, value FROM settings`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settings []models.Setting
	for rows.Next() {
		var s models.Setting
		if err := rows.Scan(&s.Key, &s.Value); err != nil {
			return nil, err
		}
		settings = append(settings, s)
	}
	
	// Cache result
	if CacheClient != nil && len(settings) > 0 {
		CacheClient.Set(ctx, "settings:all", settings, CacheTTL)
	}
	
	return settings, nil
}

func GetSetting(key string) (string, error) {
	var value string
	err := DB.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

func UpdateSetting(key, value string) error {
	ctx := context.Background()
	
	query := `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	_, err := DB.Exec(query, key, value)
	if err != nil {
		return err
	}
	
	// Invalidate cache
	invalidateCache(ctx, "settings:all")
	invalidateCache(ctx, "setting:"+key)
	
	return err
}

func EnsureDefaultSettings() {
	// Set default polling interval if not exists
	_, err := GetSetting("pollingInterval")
	if err != nil {
		UpdateSetting("pollingInterval", "15000")
		log.Println("Seeded default 'pollingInterval' setting: 15000ms")
	}
}
