export type ServiceType =
    | 'mongodb'
    | 'mysql'
    | 'postgresql'
    | 'rabbitmq'
    | 'mqtt-mosquitto'
    | 's3-minio'
    | 's3-garage'
    | 'ftp-vsftpd'
    | 'ftp-sftpgo'
    | 'web-caddy'
    | 'web-nginx'
    | 'pm2'
    | 'supervisor'
    | 'systemd'
    | 'firewall'
    | 'security-crowdsec'
    | 'valkey-cache'
    | 'valkey-broker'
    | 'valkey-nosql';

export type ProxyType = 'caddy' | 'nginx' | 'none';

export const PROXY_TYPE_LABELS: Record<ProxyType, string> = {
    caddy: 'Caddy',
    nginx: 'Nginx',
    none: 'No reverse proxy',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
    mongodb: 'MongoDB',
    mysql: 'MySQL',
    postgresql: 'PostgreSQL',
    rabbitmq: 'RabbitMQ',
    'mqtt-mosquitto': 'Mosquitto (MQTT)',
    's3-minio': 'MinIO (S3)',
    's3-garage': 'Garage (S3)',
    'ftp-vsftpd': 'vsftpd (FTP)',
    'ftp-sftpgo': 'SFTPGo',
    'web-caddy': 'Caddy',
    'web-nginx': 'Nginx',
    pm2: 'PM2 Process',
    supervisor: 'Supervisor Process',
    systemd: 'Systemd Process',
    firewall: 'Firewall',
    'security-crowdsec': 'CrowdSec',
    'valkey-cache': 'Valkey (Cache)',
    'valkey-broker': 'Valkey (Pub/Sub)',
    'valkey-nosql': 'Valkey (NoSQL DB)',
};

export const SERVICE_TYPE_CATEGORIES: Record<string, ServiceType[]> = {
    'Databases': ['mongodb', 'mysql', 'postgresql', 'valkey-nosql'],
    'Message Queue': ['rabbitmq', 'mqtt-mosquitto', 'valkey-broker'],
    'Storage': ['s3-minio', 's3-garage'],
    'File Transfer': ['ftp-vsftpd', 'ftp-sftpgo'],
    'Web Servers & Proxies': ['web-caddy', 'web-nginx'],
    'Caching': ['valkey-cache'],
};

export interface Project {
    id: string;
    name: string;
    description?: string;
    color: string;
    createdAt: string;
}

export interface RMQBinding {
    vhost: string;
    sourceExchange: string;
    destinationQueue: string;
    routingKey: string;
}

export type AccountCategory = 'management' | 'project' | 'independent';

export interface ServiceAccount {
    id: string;
    category: AccountCategory;
    projectId?: string;   // only relevant when category === 'project'
    projectName?: string; // denormalized for quick access
    serverId: string;
    serviceId: string;
    agentId: string;  // Legacy, use serverId
    type: ServiceType;
    name: string;
    username: string;
    permissions?: string;
    status: 'active' | 'disabled';
    lastActivity?: string;
    // Common
    host?: string;
    port?: number;
    // DB
    database?: string;      // Legacy
    databases?: string[];   // Multi-DB
    password?: string;
    role?: string;
    targetEntity?: string;
    // RabbitMQ
    vhost?: string;
    bindings?: RMQBinding[];
    // S3
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
    // FTP
    rootPath?: string;
    quota?: number;          // in MB
    quotaEnabled?: boolean;
    // PM2
    appName?: string;
    script?: string;
    cwd?: string;
    // PM2 reverse proxy
    pm2Port?: number;         // app listen port
    pm2ProxyType?: ProxyType; // which proxy handles it
    pm2ProxyDomain?: string;  // e.g. myapp.example.com
    // Valkey-specific fields
    databaseIndex?: number;    // Valkey NoSQL database index (0-15)
    aclCategory?: string;      // Valkey Cache ACL category
    channelPattern?: string;   // Valkey Broker pub/sub channel pattern
    tags: string[];
    createdAt: string;
}

export interface RuntimeInfo {
    name: string;
    version: string;
    path: string;
}

export interface Agent {
    id: string;
    name: string;
    description: string;
    hostname: string;
    osInfo: string;
    status: 'pending' | 'approved' | 'online' | 'offline' | 'rejected';
    lastSeen: string;
    createdAt: string;
    runtimes?: RuntimeInfo[];
    services: {
        id: string;
        name: string;
        status: string;
        metrics?: Record<string, number>;
    }[];
}

export interface User {
    id: string;
    username: string;
    fullName?: string;
    email?: string;
    phone?: string;
    role: 'admin' | 'manager' | 'user';
    createdAt: string;
}

export const PROJECT_COLORS = [
    'primary',    // Blue - Ant Design primary color
    'secondary',  // Purple - Link color
    'success',    // Green - Success color
    'warning',    // Orange - Warning color
    'error',      // Red - Error color
    'neutral',    // Gray - Text secondary color
];

export interface Event {
    id: string;
    agentId: string;
    agentName?: string;
    type: string;
    service: string;
    status: string;
    message: string;
    createdAt: string;
}

export interface ServiceLog {
    timestamp: string;
    level: string;
    message: string;
    source?: string;
}

export interface StorageUser {
    accessKeyId: string;
    secretKey?: string;
    name?: string;
    policies?: string[];
    status?: string;
}
