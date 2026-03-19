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
    | 'cache-valkey';

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
    'cache-valkey': 'Valkey (Cache)',
};

export const SERVICE_TYPE_CATEGORIES: Record<string, ServiceType[]> = {
    'Databases': ['mongodb', 'mysql', 'postgresql'],
    'Message Queue': ['rabbitmq', 'mqtt-mosquitto'],
    'Storage': ['s3-minio', 's3-garage'],
    'File Transfer': ['ftp-vsftpd', 'ftp-sftpgo'],
    'Web Servers': ['web-caddy', 'web-nginx'],
    'Process Managers': ['pm2', 'supervisor', 'systemd'],
    'Security': ['security-crowdsec', 'firewall'],
    'Caching': ['cache-valkey'],
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

export interface ServiceAccount {
    id: string;
    projectId?: string;
    agentId: string;
    type: ServiceType;
    name: string;
    // Common
    host?: string;
    port?: number;
    // DB
    database?: string;      // Legacy
    databases?: string[];   // Multi-DB
    username?: string;
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
    tags: string[];
    createdAt: string;
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
    services: {
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
    'primary',
    'secondary',
    'accent',
    'info',
    'success',
    'warning',
    'error',
    'neutral',
];
