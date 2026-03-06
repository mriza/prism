package models

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
