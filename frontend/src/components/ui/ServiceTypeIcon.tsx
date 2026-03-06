import type { ServiceType } from '../../types';

// Color mapping per service type
const colors: Record<ServiceType, string> = {
    mongodb: '#22c55e',
    mysql: '#3b82f6',
    postgresql: '#6366f1',
    rabbitmq: '#f97316',
    's3-minio': '#ec4899',
    's3-garage': '#a855f7',
    'ftp-vsftpd': '#14b8a6',
    'ftp-sftpgo': '#06b6d4',
    pm2: '#eab308',
};

const abbr: Record<ServiceType, string> = {
    mongodb: 'MG',
    mysql: 'MY',
    postgresql: 'PG',
    rabbitmq: 'MQ',
    's3-minio': 'S3',
    's3-garage': 'S3',
    'ftp-vsftpd': 'FT',
    'ftp-sftpgo': 'FT',
    pm2: 'P2',
};

interface ServiceTypeIconProps {
    type: ServiceType;
    size?: number;
}

export function ServiceTypeIcon({ type, size = 36 }: ServiceTypeIconProps) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: '8px',
                background: colors[type] + '22',
                border: `1px solid ${colors[type]}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors[type],
                fontWeight: 700,
                fontSize: size * 0.33,
                letterSpacing: '0.02em',
                flexShrink: 0,
            }}
        >
            {abbr[type]}
        </div>
    );
}

export function serviceColor(type: ServiceType): string {
    return colors[type];
}
