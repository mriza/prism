package core

type Status string

type RabbitUser struct {
	Name string `json:"name"`
	Tags string `json:"tags"`
}

const (
	StatusRunning Status = "running"
	StatusStopped Status = "stopped"
	StatusError   Status = "error"
	StatusUnknown Status = "unknown"
)

type ServiceModule interface {
	Name() string
	Install() error
	Start() error
	Stop() error
	Restart() error
	Status() (Status, error)
	GetFacts() (map[string]string, error)

	// Database Managment (Optional interface assertion in runtime)
	// ListDatabases() ([]string, error)
	// CreateDatabase(name string) error
	// ListUsers() ([]string, error)
	// CreateUser(name, password string) error
	// GrantPrivilege(user, database, privilege string) error

	Configure(config map[string]interface{}) error
}

type ConfigurableModule interface {
	GetConfigPath() string
	ReadConfig() (string, error)
	WriteConfig(content string) error
}

type DatabaseModule interface {
	ListDatabases() ([]string, error)
	CreateDatabase(name string) error
	ListUsers() ([]string, error)
	CreateUser(name, password, role, target string) error
	UpdatePrivileges(name, role, target string) error
}

type RabbitMQModule interface {
	ListVHosts() ([]string, error)
	CreateVHost(name string) error
	DeleteVHost(name string) error

	ListUsers() ([]RabbitUser, error)
	CreateUser(name, password, role, target string) error
	DeleteUser(name string) error
	SetPermissions(vhost, user, conf, write, read string) error

	ListBindings(vhost string) ([]string, error)
	CreateBinding(vhost, sourceExchange, destinationQueue, routingKey string) error
	SyncBindings(bindings []map[string]interface{}) error
}

type WebServerModule interface {
	ListSites() ([]string, error)
	CreateSite(name, content string) error
	DeleteSite(name string) error
	EnableSite(name string) error
	DisableSite(name string) error
}

type StorageUser struct {
	AccessKey string `json:"access_key"`
	SecretKey string `json:"secret_key,omitempty"`
}

type StorageModule interface {
	ListBuckets() ([]string, error)
	CreateBucket(name string) error
	DeleteBucket(name string) error

	ListUsers() ([]StorageUser, error)
	CreateUser(accessKey, secretKey string) (StorageUser, error)
	DeleteUser(accessKey string) error
}

type AnsibleModule interface {
	RunPlaybook(playbookPath, inventory, extraVars string) (string, error)
}

// ProxyModule is implemented by reverse proxy modules (Caddy, Nginx).
// It enables creating proxy rules for PM2 apps via domain → localhost:port.
type ProxyModule interface {
	// GetProxyType returns "caddy" or "nginx".
	GetProxyType() string
	// ListReverseProxies returns all configured proxy rules on this server.
	ListReverseProxies() ([]ProxyInfo, error)
	// CreateReverseProxy creates a rule routing domain → localhost:port.
	CreateReverseProxy(domain string, port int) error
	// DeleteReverseProxy removes the proxy rule for a domain.
	DeleteReverseProxy(domain string) error
}

// ProxyInfo describes a single reverse proxy rule.
type ProxyInfo struct {
	Domain   string `json:"domain"`
	Upstream string `json:"upstream"`
	Enabled  bool   `json:"enabled"`
}

// PM2App represents a process managed by PM2.
type PM2App struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	PID    int    `json:"pid"`
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
}

// PM2Module is implemented by the PM2 service module.
type PM2Module interface {
	GetApps() ([]PM2App, error)
	GetListenPort(pid int) (int, error)
}

// FirewallModule is implemented by firewall services like UFW.
type FirewallModule interface {
	IsActive() bool
	SetActive(active bool)
	TargetName() string
	AllowPort(port int, protocol string) error
	DenyPort(port int, protocol string) error
	ListRules() ([]map[string]string, error)
	DeleteRule(ruleID string) error
	SetDefaultPolicy(policy, direction string) error
}

// CrowdSecModule is implemented by the CrowdSec security engine.
type CrowdSecModule interface {
	ListDecisions() (string, error)
	AddDecision(ip, duration, reason, decType string) error
	DeleteDecision(id string) error
	DeleteDecisionByIP(ip string) error
}

type MQTTModule interface {
	ListUsers() ([]string, error)
	CreateUser(username, password string) error
	DeleteUser(username string) error
}

type FTPModule interface {
	ListUsers() ([]string, error)
	CreateUser(username, password, rootPath string, quota int, quotaEnabled bool) error
	DeleteUser(username string) error
}

// MetricGatherer can be implemented by modules to report quantitative statistics.
type MetricGatherer interface {
	Metrics() (map[string]float64, error)
}
