package models

type User struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Password  string `json:"-"` // never serialize password
	FullName  string `json:"fullName"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Role      string `json:"role"` // admin, manager, user
	CreatedAt string `json:"createdAt"`
}

type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	CreatedAt   string `json:"createdAt"`
}

type RMQBinding struct {
	VHost            string `json:"vhost"`
	SourceExchange   string `json:"sourceExchange"`
	DestinationQueue string `json:"destinationQueue"`
	RoutingKey       string `json:"routingKey"`
}

type ServiceAccount struct {
	ID             string   `json:"id"`
	ProjectID      string   `json:"projectId,omitempty"`
	AgentID        string   `json:"agentId"`
	Type           string   `json:"type"`
	Name           string   `json:"name"`
	Host           string   `json:"host,omitempty"`
	Port           int      `json:"port,omitempty"`
	Database       string   `json:"database,omitempty"`
	Databases      []string `json:"databases,omitempty"` // For multi-DB support
	Username       string   `json:"username,omitempty"`
	Password       string   `json:"password,omitempty"`
	Role           string   `json:"role,omitempty"`
	TargetEntity   string   `json:"targetEntity,omitempty"`
	VHost          string   `json:"vhost,omitempty"`
	Bindings       []RMQBinding `json:"bindings,omitempty"` // For RabbitMQ bindings
	Endpoint       string   `json:"endpoint,omitempty"`
	AccessKey      string   `json:"accessKey,omitempty"`
	SecretKey      string   `json:"secretKey,omitempty"`
	Bucket         string   `json:"bucket,omitempty"`
	RootPath       string   `json:"rootPath,omitempty"`
	Quota          int      `json:"quota,omitempty"`        // in MB
	QuotaEnabled   bool     `json:"quotaEnabled,omitempty"`
	AppName        string   `json:"appName,omitempty"`
	Script         string   `json:"script,omitempty"`
	Cwd            string   `json:"cwd,omitempty"`
	PM2Port        int      `json:"pm2Port,omitempty"`
	PM2ProxyType   string   `json:"pm2ProxyType,omitempty"`
	PM2ProxyDomain string   `json:"pm2ProxyDomain,omitempty"`
	Tags           []string `json:"tags"`
	CreatedAt      string   `json:"createdAt"`
}

type Agent struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Hostname    string `json:"hostname"`
	OSInfo    string `json:"osInfo"`
	Status    string `json:"status"` // pending, approved, rejected
	LastSeen  string `json:"lastSeen"`
	CreatedAt string `json:"createdAt"`
}

type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}
type Event struct {
	ID        string `json:"id"`
	AgentID   string `json:"agentId"`
	AgentName string `json:"agentName"`
	Type      string `json:"type"`
	Service   string `json:"service"`
	Status    string `json:"status"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
}
