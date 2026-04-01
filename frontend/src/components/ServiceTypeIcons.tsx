import React from 'react';
import {
    DatabaseOutlined,
    GlobalOutlined,
    CloudServerOutlined,
    NodeIndexOutlined,
    ThunderboltOutlined,
    HddOutlined,
    SafetyOutlined,
    SecurityScanOutlined,
    FileTextOutlined,
    RocketOutlined
} from '@ant-design/icons';
import type { ServiceType } from '../types';

interface ServiceTypeIconsProps {
    type: ServiceType;
    style?: React.CSSProperties;
}

export function ServiceTypeIcons({ type, style }: ServiceTypeIconsProps) {
    switch (type) {
        case 'mysql':
        case 'postgresql':
        case 'mongodb':
            return <DatabaseOutlined style={style} />;
        case 'web-nginx':
        case 'web-caddy':
            return <GlobalOutlined style={style} />;
        case 'rabbitmq':
            return <ThunderboltOutlined style={style} />;
        case 'mqtt-mosquitto':
            return <CloudServerOutlined style={style} />;
        case 's3-minio':
        case 's3-garage':
            return <HddOutlined style={style} />;
        case 'ftp-vsftpd':
        case 'ftp-sftpgo':
            return <FileTextOutlined style={style} />;
        case 'firewall':
            return <SafetyOutlined style={style} />;
        case 'security-crowdsec':
            return <SecurityScanOutlined style={style} />;
        case 'valkey-nosql':
            return <DatabaseOutlined style={style} />;
        case 'valkey-broker':
            return <ThunderboltOutlined style={style} />;
        case 'valkey-cache':
            return <RocketOutlined style={style} />;
        case 'pm2':
        case 'supervisor':
        case 'systemd':
            return <NodeIndexOutlined style={style} />;
        default:
            return <NodeIndexOutlined style={style} />;
    }
}
