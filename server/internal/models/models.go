package models

type User struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Password  string `json:"-"` // never serialize password
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

type ServiceAccount struct {
	ID             string   `json:"id"`
	ProjectID      string   `json:"projectId,omitempty"`
	AgentID        string   `json:"agentId"`
	Type           string   `json:"type"`
	Name           string   `json:"name"`
	Host           string   `json:"host,omitempty"`
	Port           int      `json:"port,omitempty"`
	Database       string   `json:"database,omitempty"`
	Username       string   `json:"username,omitempty"`
	Password       string   `json:"password,omitempty"`
	Role           string   `json:"role,omitempty"`
	TargetEntity   string   `json:"targetEntity,omitempty"`
	VHost          string   `json:"vhost,omitempty"`
	Endpoint       string   `json:"endpoint,omitempty"`
	AccessKey      string   `json:"accessKey,omitempty"`
	SecretKey      string   `json:"secretKey,omitempty"`
	Bucket         string   `json:"bucket,omitempty"`
	RootPath       string   `json:"rootPath,omitempty"`
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
