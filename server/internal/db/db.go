package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"prism-server/internal/models"
	"prism-server/internal/valkeycache"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var (
	DB          *sql.DB
	CacheClient *valkeycache.Client
	PubSub      *valkeycache.PubSubClient
	CacheTTL    = 5 * time.Minute
)

// CacheConfig holds Valkey cache configuration
type CacheConfig struct {
	Addr     string
	Password string
	DB       int
}

// InitCache initializes Valkey cache client and Pub/Sub
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

	// Initialize Pub/Sub client
	PubSub = valkeycache.NewPubSubClient(CacheClient.GetRedisClient())
	log.Printf("Valkey Pub/Sub initialized at %s", cfg.Addr)

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

	// Updated service_accounts table with category and project_name for v4.0
	accountTable := `
	CREATE TABLE IF NOT EXISTS service_accounts (
		id TEXT PRIMARY KEY,
		project_id TEXT,
		server_id TEXT NOT NULL,
		service_id TEXT NOT NULL,
		type TEXT NOT NULL DEFAULT 'user',
		category TEXT NOT NULL DEFAULT 'independent',
		project_name TEXT,
		name TEXT NOT NULL,
		username TEXT NOT NULL,
		permissions TEXT,
		status TEXT NOT NULL DEFAULT 'active',
		last_activity TEXT,
		host TEXT,
		port INTEGER,
		database_name TEXT,
		password TEXT,
		role TEXT,
		target_entity TEXT,
		vhost TEXT,
		endpoint TEXT,
		access_key TEXT,
		secret_key TEXT,
		bucket TEXT,
		root_path TEXT,
		quota INTEGER DEFAULT 0,
		quota_enabled INTEGER DEFAULT 0,
		app_name TEXT,
		script TEXT,
		cwd TEXT,
		pm2_port INTEGER,
		pm2_proxy_type TEXT,
		pm2_proxy_domain TEXT,
		tags TEXT,
		config TEXT DEFAULT '{}',
		created_at TEXT,
		FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
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

	// New tables for PRISM v4.0

	serversTable := `
	CREATE TABLE IF NOT EXISTS servers (
		id TEXT PRIMARY KEY,
		name TEXT,
		description TEXT,
		hostname TEXT NOT NULL,
		ip_address TEXT,
		os TEXT,
		os_info TEXT,
		status TEXT NOT NULL DEFAULT 'pending',
		agent_version TEXT,
		last_heartbeat TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);`

	servicesTable := `
	CREATE TABLE IF NOT EXISTS services (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		version TEXT,
		port INTEGER,
		status TEXT NOT NULL DEFAULT 'running',
		config_path TEXT,
		pid INTEGER,
		discovered_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		category TEXT,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
	);`

	managementCredentialsTable := `
	CREATE TABLE IF NOT EXISTS management_credentials (
		id TEXT PRIMARY KEY,
		service_id TEXT NOT NULL,
		credential_type TEXT NOT NULL,
		username_encrypted BLOB NOT NULL,
		password_encrypted BLOB NOT NULL,
		connection_params_encrypted BLOB,
		last_verified_at TEXT,
		status TEXT NOT NULL DEFAULT 'active',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
	);`

	agentCertificatesTable := `
	CREATE TABLE IF NOT EXISTS agent_certificates (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL,
		fingerprint TEXT NOT NULL,
		issued_at TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		revoked_at TEXT,
		revocation_reason TEXT,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
	);`

	enrollmentKeysTable := `
	CREATE TABLE IF NOT EXISTS enrollment_keys (
		id TEXT PRIMARY KEY,
		key_hash TEXT NOT NULL,
		created_by TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		used_at TEXT,
		used_by_server_id TEXT,
		FOREIGN KEY(used_by_server_id) REFERENCES servers(id) ON DELETE SET NULL
	);`

	commandsTable := `
	CREATE TABLE IF NOT EXISTS commands (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL,
		service_id TEXT,
		type TEXT NOT NULL,
		payload TEXT,
		status TEXT NOT NULL DEFAULT 'pending',
		issued_by TEXT NOT NULL,
		issued_at TEXT NOT NULL,
		executed_at TEXT,
		result TEXT,
		error TEXT,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL
	);`

	telemetryTable := `
	CREATE TABLE IF NOT EXISTS telemetry (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		server_id TEXT NOT NULL,
		service_id TEXT,
		metrics TEXT NOT NULL,
		collected_at TEXT NOT NULL,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL
	);`

	auditLogTable := `
	CREATE TABLE IF NOT EXISTS audit_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT,
		action TEXT NOT NULL,
		resource_type TEXT NOT NULL,
		resource_id TEXT,
		details TEXT,
		ip_address TEXT,
		timestamp TEXT NOT NULL
	);`

	// New tables for PRISM v4.2 - RBAC Granular

	permissionsTable := `
	CREATE TABLE IF NOT EXISTS permissions (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		description TEXT,
		resource_type TEXT NOT NULL,
		action TEXT NOT NULL,
		created_at TEXT NOT NULL
	);`

	rolePermissionsTable := `
	CREATE TABLE IF NOT EXISTS role_permissions (
		id TEXT PRIMARY KEY,
		role TEXT NOT NULL,
		permission_id TEXT NOT NULL,
		server_group_id TEXT,
		created_at TEXT NOT NULL,
		FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
		FOREIGN KEY(server_group_id) REFERENCES server_groups(id) ON DELETE CASCADE
	);`

	userServerAccessTable := `
	CREATE TABLE IF NOT EXISTS user_server_access (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		server_id TEXT NOT NULL,
		access_level TEXT NOT NULL DEFAULT 'view',
		granted_by TEXT,
		granted_at TEXT NOT NULL,
		expires_at TEXT,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		UNIQUE(user_id, server_id)
	);`

	serverGroupsTable := `
	CREATE TABLE IF NOT EXISTS server_groups (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		created_by TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);`

	serverGroupMembersTable := `
	CREATE TABLE IF NOT EXISTS server_group_members (
		id TEXT PRIMARY KEY,
		group_id TEXT NOT NULL,
		server_id TEXT NOT NULL,
		created_at TEXT NOT NULL,
		FOREIGN KEY(group_id) REFERENCES server_groups(id) ON DELETE CASCADE,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		UNIQUE(group_id, server_id)
	);`

	// Webhook and Retention tables for v4.2

	webhookSubscriptionsTable := `
	CREATE TABLE IF NOT EXISTS webhook_subscriptions (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		events TEXT NOT NULL,
		active INTEGER DEFAULT 1,
		secret TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);`

	webhookDeliveriesTable := `
	CREATE TABLE IF NOT EXISTS webhook_deliveries (
		id TEXT PRIMARY KEY,
		subscription_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		payload TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		response_code TEXT,
		response_body TEXT,
		attempts INTEGER DEFAULT 0,
		created_at TEXT NOT NULL,
		delivered_at TEXT,
		FOREIGN KEY(subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
	);`

	retentionPoliciesTable := `
	CREATE TABLE IF NOT EXISTS retention_policies (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		resource_type TEXT NOT NULL,
		retention_days INTEGER NOT NULL,
		enabled INTEGER DEFAULT 1,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);`

	// Configuration Drift Detection tables for v4.2

	configurationSnapshotsTable := `
	CREATE TABLE IF NOT EXISTS configuration_snapshots (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL,
		service_id TEXT,
		config_hash TEXT NOT NULL,
		config_data TEXT NOT NULL,
		created_at TEXT NOT NULL,
		created_by TEXT,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
	);`

	driftEventsTable := `
	CREATE TABLE IF NOT EXISTS drift_events (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL,
		service_id TEXT,
		snapshot_id TEXT,
		drift_type TEXT NOT NULL,
		severity TEXT NOT NULL DEFAULT 'warning',
		description TEXT,
		old_config TEXT,
		new_config TEXT,
		detected_at TEXT NOT NULL,
		resolved_at TEXT,
		resolved_by TEXT,
		FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
		FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE,
		FOREIGN KEY(snapshot_id) REFERENCES configuration_snapshots(id) ON DELETE CASCADE
	);`

	if _, err := DB.Exec(projectTable); err != nil {
		return fmt.Errorf("create projects table: %w", err)
	}
	if _, err := DB.Exec(accountTable); err != nil {
		return fmt.Errorf("create service_accounts table: %w", err)
	}
	if _, err := DB.Exec(serversTable); err != nil {
		return fmt.Errorf("create servers table: %w", err)
	}
	if _, err := DB.Exec(servicesTable); err != nil {
		return fmt.Errorf("create services table: %w", err)
	}
	if _, err := DB.Exec(managementCredentialsTable); err != nil {
		return fmt.Errorf("create management_credentials table: %w", err)
	}
	if _, err := DB.Exec(agentCertificatesTable); err != nil {
		return fmt.Errorf("create agent_certificates table: %w", err)
	}
	if _, err := DB.Exec(enrollmentKeysTable); err != nil {
		return fmt.Errorf("create enrollment_keys table: %w", err)
	}
	if _, err := DB.Exec(commandsTable); err != nil {
		return fmt.Errorf("create commands table: %w", err)
	}
	if _, err := DB.Exec(telemetryTable); err != nil {
		return fmt.Errorf("create telemetry table: %w", err)
	}
	if _, err := DB.Exec(auditLogTable); err != nil {
		return fmt.Errorf("create audit_log table: %w", err)
	}
	// Create RBAC tables for v4.2
	if _, err := DB.Exec(permissionsTable); err != nil {
		return fmt.Errorf("create permissions table: %w", err)
	}
	if _, err := DB.Exec(rolePermissionsTable); err != nil {
		return fmt.Errorf("create role_permissions table: %w", err)
	}
	if _, err := DB.Exec(userServerAccessTable); err != nil {
		return fmt.Errorf("create user_server_access table: %w", err)
	}
	if _, err := DB.Exec(serverGroupsTable); err != nil {
		return fmt.Errorf("create server_groups table: %w", err)
	}
	if _, err := DB.Exec(serverGroupMembersTable); err != nil {
		return fmt.Errorf("create server_group_members table: %w", err)
	}
	// Create Webhook and Retention tables
	if _, err := DB.Exec(webhookSubscriptionsTable); err != nil {
		return fmt.Errorf("create webhook_subscriptions table: %w", err)
	}
	if _, err := DB.Exec(webhookDeliveriesTable); err != nil {
		return fmt.Errorf("create webhook_deliveries table: %w", err)
	}
	if _, err := DB.Exec(retentionPoliciesTable); err != nil {
		return fmt.Errorf("create retention_policies table: %w", err)
	}
	// Create Drift Detection tables
	if _, err := DB.Exec(configurationSnapshotsTable); err != nil {
		return fmt.Errorf("create configuration_snapshots table: %w", err)
	}
	if _, err := DB.Exec(driftEventsTable); err != nil {
		return fmt.Errorf("create drift_events table: %w", err)
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

	// Create indexes for telemetry table (critical for performance)
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_server_time ON telemetry(server_id, collected_at)`); err != nil {
		log.Printf("Warning: failed to create telemetry index: %v", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_service ON telemetry(service_id) WHERE service_id IS NOT NULL`); err != nil {
		log.Printf("Warning: failed to create service index: %v", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)`); err != nil {
		log.Printf("Warning: failed to create audit log index: %v", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_services_server ON services(server_id)`); err != nil {
		log.Printf("Warning: failed to create services index: %v", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_commands_server ON commands(server_id)`); err != nil {
		log.Printf("Warning: failed to create commands index: %v", err)
	}
	// RBAC indexes
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role)`); err != nil {
		log.Printf("Warning: failed to create role_permissions index: %v", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_user_server_access_user ON user_server_access(user_id)`); err != nil {
		log.Printf("Warning: failed to create user_server_access index: %v", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_server_group_members_group ON server_group_members(group_id)`); err != nil {
		log.Printf("Warning: failed to create server_group_members index: %v", err)
	}

	// Auto-migrate new columns for existing databases safely
	DB.Exec("ALTER TABLE agents ADD COLUMN name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE agents ADD COLUMN description TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN role TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN target_entity TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN config TEXT DEFAULT '{}'")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN quota INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN quota_enabled INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN server_id TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN service_id TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN type TEXT DEFAULT 'user'")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN category TEXT DEFAULT 'independent'")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN project_name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN permissions TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN status TEXT DEFAULT 'active'")
	DB.Exec("ALTER TABLE service_accounts ADD COLUMN last_activity TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0")
	DB.Exec("ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")

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
	if p.UpdatedAt == "" {
		p.UpdatedAt = p.CreatedAt
	}
	if p.Status == "" {
		p.Status = "active"
	}

	query := `INSERT INTO projects (id, name, description, color, owner, team, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := DB.Exec(query, p.ID, p.Name, p.Description, p.Color, p.Owner, p.Team, p.Status, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return p, err
	}
	invalidateCache(context.Background(), "projects:all")
	return p, nil
}

func GetProjects() ([]models.Project, error) {
	ctx := context.Background()

	// Try cache first
	if CacheClient != nil {
		var cached []models.Project
		if err := CacheClient.Get(ctx, "projects:all", &cached); err == nil {
			log.Printf("[CACHE HIT] projects:all")
			return cached, nil
		}
		log.Printf("[CACHE MISS] projects:all")
	}

	query := `SELECT id, name, description, color, owner, team, status, created_at, updated_at FROM projects ORDER BY created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		var owner, team, status sql.NullString

		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Color, &owner, &team, &status, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}

		if owner.Valid {
			p.Owner = owner.String
		}
		if team.Valid {
			p.Team = team.String
		}
		if status.Valid {
			p.Status = status.String
		}

		projects = append(projects, p)
	}

	// Cache result
	if CacheClient != nil && len(projects) > 0 {
		CacheClient.Set(ctx, "projects:all", projects, CacheTTL)
	}

	return projects, nil
}

func GetProjectByID(id string) (*models.Project, error) {
	query := `SELECT id, name, description, color, owner, team, status, created_at, updated_at FROM projects WHERE id = ?`
	row := DB.QueryRow(query, id)

	var p models.Project
	var owner, team, status sql.NullString

	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Color, &owner, &team, &status, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if owner.Valid {
		p.Owner = owner.String
	}
	if team.Valid {
		p.Team = team.String
	}
	if status.Valid {
		p.Status = status.String
	}

	return &p, nil
}

func UpdateProject(p models.Project) error {
	query := `UPDATE projects SET name = ?, description = ?, color = ?, owner = ?, team = ?, status = ?, updated_at = ? WHERE id = ?`
	_, err := DB.Exec(query, p.Name, p.Description, p.Color, p.Owner, p.Team, p.Status, time.Now().UTC().Format(time.RFC3339), p.ID)
	if err == nil {
		invalidateCache(context.Background(), "projects:all")
		invalidateCache(context.Background(), "project:id:"+p.ID)
	}
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
	if err == nil {
		invalidateCache(context.Background(), "projects:all")
	}
	return err
}

// Legacy Agent Operations (for backward compatibility with existing agents table)
// New code should use Server operations from servers.go

func CreateAgent(a models.LegacyAgent) (models.LegacyAgent, error) {
	if a.ID == "" {
		a.ID = uuid.NewString()
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

func GetAgents() ([]models.LegacyAgent, error) {
	ctx := context.Background()

	// Try cache first
	if CacheClient != nil {
		var cached []models.LegacyAgent
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

	var agents []models.LegacyAgent
	for rows.Next() {
		var a models.LegacyAgent
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

func GetAgentByHostname(hostname string) (*models.LegacyAgent, error) {
	query := `SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents WHERE hostname = ?`
	row := DB.QueryRow(query, hostname)

	var a models.LegacyAgent
	if err := row.Scan(&a.ID, &a.Name, &a.Description, &a.Hostname, &a.OSInfo, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func GetAgentByID(id string) (*models.LegacyAgent, error) {
	query := `SELECT id, name, description, hostname, os_info, status, last_seen, created_at FROM agents WHERE id = ?`
	row := DB.QueryRow(query, id)

	var a models.LegacyAgent
	if err := row.Scan(&a.ID, &a.Name, &a.Description, &a.Hostname, &a.OSInfo, &a.Status, &a.LastSeen, &a.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
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

// ReplaceAgentID updates the primary key of an agent row
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
