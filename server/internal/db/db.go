package db

import (
	"database/sql"
	"prism-server/internal/models"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	return createTables()
}

func createTables() error {
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
		created_at TEXT,
		FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
	);`

	if _, err := DB.Exec(projectTable); err != nil {
		return fmt.Errorf("create projects table: %w", err)
	}
	if _, err := DB.Exec(accountTable); err != nil {
		return fmt.Errorf("create service_accounts table: %w", err)
	}

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
