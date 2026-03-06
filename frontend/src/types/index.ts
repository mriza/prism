export type ServiceType =
    | 'mongodb'
    | 'mysql'
    | 'postgresql'
    | 'rabbitmq'
    | 's3-minio'
    | 's3-garage'
    | 'ftp-vsftpd'
    | 'ftp-sftpgo'
    | 'pm2';

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
    's3-minio': 'MinIO (S3)',
    's3-garage': 'Garage (S3)',
    'ftp-vsftpd': 'vsftpd (FTP)',
    'ftp-sftpgo': 'SFTPGo',
    pm2: 'PM2 Process',
};

export const SERVICE_TYPE_CATEGORIES: Record<string, ServiceType[]> = {
    Database: ['mongodb', 'mysql', 'postgresql'],
    'Message Queue': ['rabbitmq'],
    'Object Storage': ['s3-minio', 's3-garage'],
    'File Transfer': ['ftp-vsftpd', 'ftp-sftpgo'],
    'Process Manager': ['pm2'],
};

export interface Project {
    id: string;
    name: string;
    description?: string;
    color: string;
    createdAt: string;
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
    database?: string;
    username?: string;
    password?: string;
    // RabbitMQ
    vhost?: string;
    // S3
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
    // FTP
    rootPath?: string;
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
    services: {
        name: string;
        status: string;
    }[];
}

export const PROJECT_COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
];
