import { useState, useMemo } from 'react';
import { 
    Button, 
    Card, 
    Space, 
    Typography, 
    Table, 
    Input, 
    Alert, 
    Badge, 
    theme, 
    Empty,
    Spin,
    Divider,
    Tooltip
} from 'antd';
import { 
    SearchOutlined, 
    PlayCircleOutlined, 
    StopOutlined, 
    SyncOutlined, 
    DeleteOutlined, 
    HddOutlined,
    GlobalOutlined,
    CloudServerOutlined,
    DatabaseOutlined,
    SettingOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import { useAgents } from '../hooks/useAgents';
import { SERVICE_TYPE_LABELS } from '../types';
import type { ServiceType } from '../types';
import { PageContainer } from '../components/PageContainer';

const { Text, Paragraph } = Typography;

// Reverse map to find category/label
const SERVICE_NAME_TO_TYPE: Record<string, ServiceType> = {
    'mongodb': 'mongodb', 'mongod': 'mongodb',
    'mysql': 'mysql', 'mariadb': 'mysql',
    'postgresql': 'postgresql', 'postgres': 'postgresql',
    'rabbitmq': 'rabbitmq',
    'mosquitto': 'mqtt-mosquitto',
    'minio': 's3-minio',
    'garage': 's3-garage',
    'vsftpd': 'ftp-vsftpd',
    'sftpgo': 'ftp-sftpgo',
    'caddy': 'web-caddy',
    'nginx': 'web-nginx',
    'pm2': 'pm2',
    'supervisor': 'supervisor',
    'systemd': 'systemd',
    'ufw': 'firewall',
    'iptables': 'firewall',
    'nftables': 'firewall',
    'crowdsec': 'security-crowdsec',
};

const ServiceTypeIcon = ({ type, size = 18 }: { type: ServiceType, size?: number }) => {
    const style = { fontSize: size };
    switch (type) {
        case 'mongodb':
        case 'mysql':
        case 'postgresql':
            return <DatabaseOutlined style={style} />;
        case 'web-caddy':
        case 'web-nginx':
            return <GlobalOutlined style={style} />;
        case 'rabbitmq':
        case 'mqtt-mosquitto':
            return <SyncOutlined style={style} />;
        case 's3-minio':
        case 's3-garage':
            return <HddOutlined style={style} />;
        case 'firewall':
            return <SafetyCertificateOutlined style={style} />;
        case 'security-crowdsec':
            return <SafetyCertificateOutlined style={style} />;
        default:
            return <SettingOutlined style={style} />;
    }
};

export function ServicesPage() {
    const { agents, controlService, unregisterService, loading, error } = useAgents();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = theme.useToken();

    const handleControl = async (e: React.MouseEvent, agentId: string, service: string, action: string) => {
        e.stopPropagation(); 
        const id = `${agentId}-${service}-${action}`;
        setActionLoading(id);
        try {
          await controlService(agentId, service, action);
        } finally {
          setActionLoading(null);
        }
    };

    const sortedAgents = useMemo(() => {
        return [...agents]
            .filter(a => a.status !== 'pending' && a.status !== 'rejected')
            .sort((a, b) => (a.name || a.hostname).localeCompare(b.name || b.hostname))
            .map(agent => ({
                ...agent,
                services: agent.services
                    .filter(s => !['pm2', 'supervisor', 'systemd'].includes(s.name))
                    .sort((a, b) => {
                        const labelA = SERVICE_TYPE_LABELS[SERVICE_NAME_TO_TYPE[a.name] || 'systemd'] || a.name;
                        const labelB = SERVICE_TYPE_LABELS[SERVICE_NAME_TO_TYPE[b.name] || 'systemd'] || b.name;
                        return labelA.localeCompare(labelB);
                    })
            }));
    }, [agents]);

    const filteredAgents = useMemo(() => {
        if (!searchTerm) return sortedAgents;
        const lowSearch = searchTerm.toLowerCase();
        return sortedAgents.map(agent => ({
            ...agent,
            services: agent.services.filter(svc => {
                const label = (SERVICE_TYPE_LABELS[SERVICE_NAME_TO_TYPE[svc.name] || 'systemd'] || svc.name).toLowerCase();
                return label.includes(lowSearch) || svc.name.toLowerCase().includes(lowSearch);
            })
        })).filter(agent => agent.services.length > 0);
    }, [sortedAgents, searchTerm]);

    const columns = [
        {
            title: 'Service',
            key: 'service',
            render: (_: any, svc: any) => {
                const type = SERVICE_NAME_TO_TYPE[svc.name] || 'systemd';
                const label = SERVICE_TYPE_LABELS[type as ServiceType] || svc.name;
                const isOnline = svc.status === 'online' || svc.status === 'running' || svc.status === 'active';
                return (
                    <Space size="middle">
                        <div style={{ 
                            padding: '10px', 
                            borderRadius: '12px', 
                            backgroundColor: isOnline ? `${token.colorPrimary}10` : token.colorFillAlter,
                            color: isOnline ? token.colorPrimary : token.colorTextDisabled,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <ServiceTypeIcon type={type as ServiceType} />
                        </div>
                        <div>
                            <Text strong style={{ display: 'block' }}>{label}</Text>
                            <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{svc.name}</Text>
                        </div>
                    </Space>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const isOnline = status === 'online' || status === 'running' || status === 'active';
                return (
                    <Badge 
                        status={isOnline ? 'success' : 'error'} 
                        text={<Text strong style={{ textTransform: 'capitalize' }}>{status}</Text>} 
                    />
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, svc: any, _index: number) => {
                const agentId = (svc as any).agentId; // We'll ensure agentId is available in record or passed correctly
                const isOnline = svc.status === 'online' || svc.status === 'running' || svc.status === 'active';
                const isOffline = svc.status === 'offline' || svc.status === 'stopped';
                const type = SERVICE_NAME_TO_TYPE[svc.name] || 'systemd';

                return (
                    <Space>
                        <Tooltip title="Start">
                            <Button 
                                type="text" 
                                icon={actionLoading === `${agentId}-${svc.name}-start` ? <SyncOutlined spin /> : <PlayCircleOutlined />} 
                                disabled={isOnline || !!actionLoading}
                                onClick={(e) => handleControl(e, agentId, svc.name, 'start')}
                                style={{ color: isOnline ? undefined : token.colorSuccess }}
                            />
                        </Tooltip>
                        <Tooltip title="Stop">
                            <Button 
                                type="text" 
                                icon={actionLoading === `${agentId}-${svc.name}-stop` ? <SyncOutlined spin /> : <StopOutlined />} 
                                disabled={isOffline || !!actionLoading}
                                onClick={(e) => handleControl(e, agentId, svc.name, 'stop')}
                                style={{ color: isOffline ? undefined : token.colorError }}
                            />
                        </Tooltip>
                        <Tooltip title="Restart">
                            <Button 
                                type="text" 
                                icon={actionLoading === `${agentId}-${svc.name}-restart` ? <SyncOutlined spin /> : <SyncOutlined />} 
                                disabled={!!actionLoading}
                                onClick={(e) => handleControl(e, agentId, svc.name, 'restart')}
                                style={{ color: token.colorPrimary }}
                            />
                        </Tooltip>
                        {type === 'systemd' && (
                            <Tooltip title="Unregister">
                                <Button 
                                    type="text" 
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`Unregister ${svc.name}? This only stops monitoring.`)) {
                                            await unregisterService(agentId, svc.name);
                                        }
                                    }}
                                />
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        }
    ];

    return (
        <PageContainer
            title="Infrastructure"
            description="Centrally monitor and control core infrastructure services across your fleet."
            extra={
                <Input
                    prefix={<SearchOutlined style={{ color: token.colorTextDisabled }} />}
                    placeholder="Search infrastructure or hosts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: 300, borderRadius: '10px' }}
                />
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {error && (
                    <Alert
                        message="System Alert"
                        description={error}
                        type="error"
                        showIcon
                        closable
                        style={{ borderRadius: '12px' }}
                    />
                )}

                {loading && agents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <Spin size="large" />
                        <Paragraph type="secondary" style={{ marginTop: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Inventorying Infrastructure...
                        </Paragraph>
                    </div>
                ) : (
                    filteredAgents.map(agent => (
                        <div key={agent.id} style={{ marginBottom: '40px' }}>
                            <Divider orientation={"left" as any} style={{ margin: '0 0 24px 0' }}>
                                <Space>
                                    <div style={{ 
                                        padding: '8px', 
                                        borderRadius: '8px', 
                                        backgroundColor: agent.status === 'online' ? `${token.colorSuccess}10` : token.colorFillAlter,
                                        color: agent.status === 'online' ? token.colorSuccess : token.colorTextDisabled,
                                        border: `1px solid ${agent.status === 'online' ? `${token.colorSuccess}20` : token.colorBorderSecondary}`,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}>
                                        <CloudServerOutlined />
                                    </div>
                                    <div>
                                        <Text strong>{agent.name || agent.hostname}</Text>
                                        <Text type="secondary" style={{ fontSize: '10px', marginLeft: '8px', fontWeight: 700 }}>
                                            {agent.hostname} • {agent.osInfo}
                                        </Text>
                                    </div>
                                </Space>
                            </Divider>

                            <Card 
                                bodyStyle={{ padding: 0 }} 
                                style={{ borderRadius: '20px', overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}
                            >
                                <Table
                                    dataSource={agent.services}
                                    columns={columns.map(col => col.key === 'actions' ? { ...col, render: (text: any, record: any, idx: number) => (col.render as any)(text, { ...record, agentId: agent.id }, idx) } : col)}
                                    pagination={false}
                                    rowKey={(record, idx) => `${agent.id}-${record.name}-${idx}`}
                                />
                            </Card>
                        </div>
                    ))
                )}

                {filteredAgents.length === 0 && !loading && (
                    <Empty 
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <Space direction="vertical">
                                <Text strong>No Infrastructure Found</Text>
                                <Text type="secondary">
                                    {searchTerm ? `No infrastructure matches "${searchTerm}" in your fleet.` : "Your agents haven't reported any managed infrastructure services yet."}
                                </Text>
                            </Space>
                        }
                    >
                        {searchTerm && <Button onClick={() => setSearchTerm('')}>Clear Search</Button>}
                    </Empty>
                )}
            </Space>
        </PageContainer>
    );
}

export default ServicesPage;
