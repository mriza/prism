import type { ServiceType } from '../../types';
import { clsx } from 'clsx';

// Color mapping per service type
const colors: Record<ServiceType, string> = {
    mongodb: '#22c55e',
    mysql: '#3b82f6',
    postgresql: '#6366f1',
    rabbitmq: '#f97316',
    'mqtt-mosquitto': '#0ea5e9',
    's3-minio': '#ec4899',
    's3-garage': '#a855f7',
    'ftp-vsftpd': '#14b8a6',
    'ftp-sftpgo': '#06b6d4',
    'web-caddy': '#38bdf8',
    'web-nginx': '#22c55e',
    pm2: '#eab308',
    supervisor: '#64748b',
    systemd: '#ef4444',
    'security-crowdsec': '#f59e0b',
};

const abbr: Record<ServiceType, string> = {
    mongodb: 'MG',
    mysql: 'MY',
    postgresql: 'PG',
    rabbitmq: 'MQ',
    'mqtt-mosquitto': 'MS',
    's3-minio': 'S3',
    's3-garage': 'S3',
    'ftp-vsftpd': 'FT',
    'ftp-sftpgo': 'FT',
    'web-caddy': 'CD',
    'web-nginx': 'NX',
    pm2: 'P2',
    supervisor: 'SP',
    systemd: 'SD',
    'security-crowdsec': 'CS',
};

interface ServiceTypeIconProps {
    type: ServiceType;
    size?: number;
}

export function ServiceTypeIcon({ type, size = 36 }: ServiceTypeIconProps) {
    const color = colors[type];
    
    return (
        <div
            className={clsx(
                "rounded-xl border flex items-center justify-center font-black tracking-widest shrink-0 transition-transform duration-300 hover:scale-105",
                "bg-opacity-10 shadow-sm"
            )}
            style={{
                width: size,
                height: size,
                backgroundColor: `${color}15`,
                borderColor: `${color}33`,
                color: color,
                fontSize: size * 0.33,
            }}
        >
            {abbr[type]}
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function serviceColor(type: ServiceType): string {
    return colors[type];
}
