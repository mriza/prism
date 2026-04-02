package models

import "time"

// User represents internal PRISM users for authentication and RBAC
type User struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	Password   string `json:"-"` // never serialize password
	FullName   string `json:"fullName"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Role       string `json:"role"` // admin, operator, viewer
	MFAEnabled bool   `json:"mfaEnabled"`
	LastLogin  string `json:"lastLogin,omitempty"`
	Status     string `json:"status"` // active, disabled
	CreatedAt  string `json:"createdAt"`
}

// Project represents a resource group - collection of infrastructure resources
type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Owner       string `json:"owner,omitempty"`
	Team        string `json:"team,omitempty"`
	Status      string `json:"status"` // active, completed, archived
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// ResourceSummary for project display
type ResourceSummary struct {
	Accounts   int `json:"accounts"`
	Processes  int `json:"processes"`
	Containers int `json:"containers"`
	Servers    int `json:"servers"`
}

// RMQBinding represents RabbitMQ binding configuration
type RMQBinding struct {
	VHost            string `json:"vhost"`
	SourceExchange   string `json:"sourceExchange"`
	DestinationQueue string `json:"destinationQueue"`
	RoutingKey       string `json:"routingKey"`
}

// ServiceAccount represents Application Accounts (NOT Management Credentials)
// Categorized as project-based or independent
type ServiceAccount struct {
	ID           string `json:"id"`
	ProjectID    string `json:"projectId,omitempty"`
	ServerID     string `json:"serverId"`
	ServiceID    string `json:"serviceId"`
	Type         string `json:"type"`                  // user, service_account
	Category     string `json:"category"`              // project, independent
	ProjectName  string `json:"projectName,omitempty"` // denormalized for quick access
	Name         string `json:"name"`
	Username     string `json:"username"`
	Permissions  string `json:"permissions,omitempty"` // JSON-encoded permissions
	Status       string `json:"status"`                // active, disabled
	LastActivity string `json:"lastActivity,omitempty"`

	// Service-specific fields
	Host           string       `json:"host,omitempty"`
	Port           int          `json:"port,omitempty"`
	Database       string       `json:"database,omitempty"`
	Databases      []string     `json:"databases,omitempty"`
	Password       string       `json:"password,omitempty"`
	Role           string       `json:"role,omitempty"`
	TargetEntity   string       `json:"targetEntity,omitempty"`
	VHost          string       `json:"vhost,omitempty"`
	Bindings       []RMQBinding `json:"bindings,omitempty"`
	Endpoint       string       `json:"endpoint,omitempty"`
	AccessKey      string       `json:"accessKey,omitempty"`
	SecretKey      string       `json:"secretKey,omitempty"`
	Bucket         string       `json:"bucket,omitempty"`
	RootPath       string       `json:"rootPath,omitempty"`
	Quota          int          `json:"quota,omitempty"`
	QuotaEnabled   bool         `json:"quotaEnabled,omitempty"`
	AppName        string       `json:"appName,omitempty"`
	Script         string       `json:"script,omitempty"`
	Cwd            string       `json:"cwd,omitempty"`
	PM2Port        int          `json:"pm2Port,omitempty"`
	PM2ProxyType   string       `json:"pm2ProxyType,omitempty"`
	PM2ProxyDomain string       `json:"pm2ProxyDomain,omitempty"`
	Tags           []string     `json:"tags"`
	CreatedAt      string       `json:"createdAt"`
}

// ManagementCredential represents service-level credentials (root/admin accounts)
// Used by Agent to manage services - NOT displayed in Accounts tab
type ManagementCredential struct {
	ID                        string    `json:"id"`
	ServiceID                 string    `json:"serviceId"`
	CredentialType            string    `json:"credentialType"` // root, admin, default
	UsernameEncrypted         []byte    `json:"-"`              // never serialize
	PasswordEncrypted         []byte    `json:"-"`              // never serialize
	ConnectionParamsEncrypted []byte    `json:"-"`              // never serialize
	LastVerifiedAt            string    `json:"lastVerifiedAt,omitempty"`
	Status                    string    `json:"status"` // active, inactive, error
	CreatedAt                 time.Time `json:"createdAt"`
	UpdatedAt                 time.Time `json:"updatedAt"`

	// UI-only field (masked username)
	UsernameMasked string `json:"usernameMasked,omitempty"`
}

type RuntimeInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Path    string `json:"path"`
}

// Server represents a managed server (formerly Agent in v3.x)
type Server struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	Hostname      string        `json:"hostname"`
	IPAddress     string        `json:"ipAddress,omitempty"`
	OS            string        `json:"os"`
	OSInfo        string        `json:"osInfo,omitempty"`
	Status        string        `json:"status"` // pending, active, unreachable, removed
	AgentVersion  string        `json:"agentVersion,omitempty"`
	LastHeartbeat string        `json:"lastHeartbeat,omitempty"`
	Runtimes      []RuntimeInfo `json:"runtimes,omitempty"` // JSON-encoded in DB
	CreatedAt     string        `json:"createdAt"`
	UpdatedAt     string        `json:"updatedAt"`
}

// Service represents a managed service on a server
type Service struct {
	ID           string `json:"id"`
	ServerID     string `json:"serverId"`
	Name         string `json:"name"`
	Type         string `json:"type"` // mysql, postgresql, nginx, docker, etc.
	Version      string `json:"version,omitempty"`
	Port         int    `json:"port,omitempty"`
	Status       string `json:"status"` // running, stopped, error
	ConfigPath   string `json:"configPath,omitempty"`
	PID          int    `json:"pid,omitempty"`
	DiscoveredAt string `json:"discoveredAt"`
	UpdatedAt    string `json:"updatedAt"`
	Category     string `json:"category"` // database, message_broker, object_storage, etc.
}

// AgentCertificate represents X.509 certificate for mTLS
type AgentCertificate struct {
	ID               string     `json:"id"`
	ServerID         string     `json:"serverId"`
	Fingerprint      string     `json:"fingerprint"`
	IssuedAt         time.Time  `json:"issuedAt"`
	ExpiresAt        time.Time  `json:"expiresAt"`
	RevokedAt        *time.Time `json:"revokedAt,omitempty"`
	RevocationReason string     `json:"revocationReason,omitempty"`
}

// EnrollmentKey represents one-time PSK for agent enrollment
type EnrollmentKey struct {
	ID             string     `json:"id"`
	KeyHash        string     `json:"-"` // never serialize
	CreatedBy      string     `json:"createdBy"`
	ExpiresAt      time.Time  `json:"expiresAt"`
	UsedAt         *time.Time `json:"usedAt,omitempty"`
	UsedByServerID *string    `json:"usedByServerId,omitempty"`
}

// Command represents a command sent from Hub to Agent
type Command struct {
	ID         string                 `json:"id"`
	ServerID   string                 `json:"serverId"`
	ServiceID  string                 `json:"serviceId,omitempty"`
	Type       string                 `json:"type"` // start, stop, restart, config_update, account_create, etc.
	Payload    map[string]interface{} `json:"payload,omitempty"`
	Status     string                 `json:"status"` // pending, sent, executed, failed
	IssuedBy   string                 `json:"issuedBy"`
	IssuedAt   time.Time              `json:"issuedAt"`
	ExecutedAt *time.Time             `json:"executedAt,omitempty"`
	Result     map[string]interface{} `json:"result,omitempty"`
	Error      string                 `json:"error,omitempty"`
}

// Telemetry represents time-series metrics from Agent
type Telemetry struct {
	ID          int64                  `json:"id"`
	ServerID    string                 `json:"serverId"`
	ServiceID   string                 `json:"serviceId,omitempty"`
	Metrics     map[string]interface{} `json:"metrics"` // JSON-encoded metrics
	CollectedAt time.Time              `json:"collectedAt"`
}

// AuditLog represents immutable audit trail
type AuditLog struct {
	ID           int64                  `json:"id"`
	UserID       string                 `json:"userId,omitempty"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resourceType"`
	ResourceID   string                 `json:"resourceId,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
	IPAddress    string                 `json:"ipAddress,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
}

// Setting represents key-value configuration settings
type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Event represents system events (legacy, kept for backward compatibility)
type Event struct {
	ID        string `json:"id"`
	AgentID   string `json:"agentId"`
	AgentName string `json:"agentName"`
	ProjectID string `json:"projectId,omitempty"`
	Type      string `json:"type"`
	Service   string `json:"service"`
	Status    string `json:"status"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
}

// LegacyAgent is kept for backward compatibility with existing agents table
//
// 🔵 DEPRECATED (v4.4.6): Use Server instead.
// This struct and the agents table are deprecated and will be removed in v5.0.
//
// Migration path:
// - v4.5: Deprecation warnings added
// - v4.6: Data migration from agents → servers
// - v5.0: LegacyAgent and agents table removed
//
// For new code, always use Server model and /api/servers endpoints.
// See MIGRATION_GUIDE.md for detailed migration instructions.
//
// Tracking: BUG-008
type LegacyAgent struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Hostname    string `json:"hostname"`
	OSInfo      string `json:"osInfo"`
	Status      string `json:"status"` // pending, approved, rejected
	LastSeen    string `json:"lastSeen"`
	CreatedAt   string `json:"createdAt"`
}

// Permission represents a granular permission for RBAC
type Permission struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	ResourceType string    `json:"resourceType"` // server, service, account, project, user
	Action       string    `json:"action"`       // read, write, delete, control
	CreatedAt    time.Time `json:"createdAt"`
}

// Deployment represents an application deployment via Git release artifacts
type Deployment struct {
	ID                   string            `json:"id"`
	ProjectID            string            `json:"projectId"`
	ServerID             string            `json:"serverId"`
	Name                 string            `json:"name"`
	Description          string            `json:"description,omitempty"`
	SourceURL            string            `json:"sourceUrl"`                      // Git repo URL (releases)
	SourceToken          string            `json:"sourceToken,omitempty"`          // PAT for private repos
	Runtime              string            `json:"runtime"`                        // nodejs, python, php, go, binary
	RuntimeVersion       string            `json:"runtimeVersion,omitempty"`       // e.g. 18.x, 3.11
	ProcessManager       string            `json:"processManager"`                 // pm2, systemd, supervisor
	StartCommand         string            `json:"startCommand"`                   // e.g. npm start, ./main
	EnvVars              map[string]string `json:"envVars,omitempty"`              // KEY=VALUE pairs
	DomainName           string            `json:"domainName,omitempty"`           // e.g. api.myapp.com
	InternalPort         int               `json:"internalPort,omitempty"`         // port the app listens on
	ProxyType            string            `json:"proxyType,omitempty"`            // caddy, nginx, none
	Status               string            `json:"status"`                         // active, deploying, failed, stopped
	LastDeployedRevision string            `json:"lastDeployedRevision,omitempty"` // tag/version
	LastDeployedAt       string            `json:"lastDeployedAt,omitempty"`
	CreatedAt            string            `json:"createdAt"`
	UpdatedAt            string            `json:"updatedAt"`
}
