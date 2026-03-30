import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../contexts/AuthContext';
import { 
    Card, 
    Row, 
    Col, 
    Badge, 
    Button, 
    Typography, 
    Space, 
    Tag, 
    Alert, 
    theme, 
    Empty, 
    Tooltip,
    Divider,
    Dropdown
} from 'antd';
import {
    CloudServerOutlined,
    SettingOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined,
    DashboardOutlined,
    MoreOutlined
} from '@ant-design/icons';
import { FirewallModal } from '../components/modals/FirewallModal';
import { CrowdSecModal } from '../components/modals/CrowdSecModal';
import { ApproveServerModal } from '../components/modals/ApproveServerModal';
import { ServiceDetailModal } from '../components/modals/ServiceDetailModal';
import { ServerSettingsModal } from '../components/modals/ServerSettingsModal';
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
    'valkey': 'cache-valkey',
    'valkey-server': 'cache-valkey',
};

export function ServersPage() {
    const { agents, loading, error, deleteAgent } = useAgents();
    const [fwAgent, setFwAgent] = useState<string | null>(null);
    const [csAgent, setCsAgent] = useState<string | null>(null);
    const [approvingAgentId, setApprovingAgentId] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<{
        agentId: string;
        agentName: string;
        serviceId: string;
        serviceName: string;
        serviceLabel: string;
        serviceType: ServiceType;
        status: string;
        metrics?: Record<string, number>;
    } | null>(null);
    const [serverSettingsAgent, setServerSettingsAgent] = useState<{id: string, name: string} | null>(null);
    const { user } = useAuth();
    const { token } = theme.useToken();

    const pendingAgents = agents.filter(a => a.status === 'pending');
    const registeredServers = agents.filter(a => a.status !== 'pending');

    const getApprovingAgent = () => {
        if (!approvingAgentId) return null;
        return agents.find(a => a.id === approvingAgentId) || null;
    };

    const handleDelete = (id: string, nameOrHost: string) => {
        if (confirm(`Are you sure you want to remove the server "${nameOrHost}"?`)) {
            deleteAgent(id);
        }
    };

    return (
        <PageContainer 
            title="Servers" 
            description="Centrally manage your distributed fleet of PRISM agents and infrastructure."
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {error && (
                    <Alert
                        message="Deployment Alert"
                        description={error}
                        type="error"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        style={{ borderRadius: '12px' }}
                    />
                )}

                {/* Pending Approvals */}
                {pendingAgents.length > 0 && user?.role === 'admin' && (
                    <div>
                        <Divider orientation={"left" as any} style={{ margin: '16px 0' }}>
                            <Space>
                                <ExclamationCircleOutlined style={{ color: token.colorWarning }} />
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', color: token.colorWarning }}>Security Check Required</Text>
                            </Space>
                        </Divider>
                        <Row gutter={[24, 24]}>
                            {pendingAgents.map(agent => (
                                <Col xs={24} md={12} lg={8} key={agent.id}>
                                    <Card 
                                        style={{ border: `1px solid ${token.colorWarningOutline}`, background: token.colorWarningBgHover }}
                                        bodyStyle={{ padding: '24px' }}
                                    >
                                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                            <Space align="start">
                                                <div style={{ 
                                                    padding: '12px', 
                                                    borderRadius: '12px', 
                                                    background: token.colorWarningBg, 
                                                    color: token.colorWarning,
                                                    display: 'flex',
                                                    border: `1px solid ${token.colorWarningBorder}`
                                                }}>
                                                    <CloudServerOutlined style={{ fontSize: '20px' }} />
                                                </div>
                                                <div>
                                                    <Text strong>{agent.hostname}</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>{agent.osInfo || 'Awaiting Specs'}</Text>
                                                </div>
                                            </Space>
                                            <Text type="secondary" style={{ fontSize: '13px' }}>
                                                An unauthorized agent is attempting to join the fleet. Please verify credentials.
                                            </Text>
                                            <Space style={{ width: '100%' }}>
                                                <Button type="primary" block onClick={() => setApprovingAgentId(agent.id)}>Authorize</Button>
                                                <Button danger block onClick={() => handleDelete(agent.id, agent.hostname)}>Reject</Button>
                                            </Space>
                                        </Space>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </div>
                )}

                {/* Registered Servers */}
                <div>
                    <Divider orientation={"left" as any} plain>
                        <Space>
                            <CloudServerOutlined />
                            <Text strong style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>Active Fleet</Text>
                        </Space>
                    </Divider>

                    {loading && registeredServers.length === 0 ? (
                        <div style={{ padding: '64px', textAlign: 'center' }}>
                            <Space direction="vertical">
                                <Button type="text" loading />
                                <Text type="secondary" strong style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>Connecting to infrastructure...</Text>
                            </Space>
                        </div>
                    ) : registeredServers.length === 0 ? (
                        <Empty 
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <Space direction="vertical">
                                    <Text strong>No Registered Servers</Text>
                                    <Text type="secondary">Start a PRISM agent on any server and it will appear here for management.</Text>
                                </Space>
                            }
                        />
                    ) : (
                        <Row gutter={[24, 24]}>
                            {registeredServers.map(server => (
                                <Col xs={24} md={12} lg={8} key={server.id}>
                                    <Card 
                                        hoverable
                                        style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '16px' }}
                                        bodyStyle={{ padding: 0 }}
                                    >
                                        {/* Header */}
                                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Space size="middle">
                                                <CloudServerOutlined style={{ color: server.status === 'online' ? token.colorSuccess : token.colorTextDisabled, fontSize: '18px' }} />
                                                <div>
                                                    <Text strong style={{ fontSize: '14px' }}>{server.name || server.hostname}</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>{server.hostname}</Text>
                                                </div>
                                            </Space>
                                            <Space>
                                                <Badge status={server.status === 'online' ? 'success' : 'default'} text={server.status.toUpperCase()} style={{ fontSize: '10px', fontWeight: 700 }} />
                                                {user?.role !== 'user' && (
                                                    <Dropdown 
                                                        menu={{ 
                                                            items: [
                                                                { key: 'settings', label: 'Settings', icon: <SettingOutlined />, onClick: () => setServerSettingsAgent({ id: server.id, name: server.name || server.hostname }) },
                                                                { type: 'divider' },
                                                                { key: 'delete', label: 'Remove', danger: true, icon: <DeleteOutlined />, onClick: () => handleDelete(server.id, server.name || server.hostname) }
                                                            ] 
                                                        }} 
                                                        trigger={['click']}
                                                    >
                                                        <Button type="text" icon={<MoreOutlined />} size="small" />
                                                    </Dropdown>
                                                )}
                                            </Space>
                                        </div>

                                        {/* Content */}
                                        <div style={{ padding: '24px' }}>
                                            {server.description && (
                                                <Paragraph type="secondary" italic style={{ fontSize: '12px', borderLeft: `3px solid ${token.colorPrimaryBg}`, paddingLeft: '12px', marginBottom: '24px' }}>
                                                    {server.description}
                                                </Paragraph>
                                            )}

                                            <div style={{ marginBottom: '8px' }}>
                                                <Space style={{ marginBottom: '12px' }}>
                                                    <DashboardOutlined style={{ fontSize: '12px', opacity: 0.3 }} />
                                                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.3 }}>Managed Services</Text>
                                                </Space>

                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {server.services && server.services.length > 0 ? (
                                                        // Sort services alphabetically for consistent display
                                                        [...server.services]
                                                            .sort((a, b) => a.name.localeCompare(b.name))
                                                            .map(svc => {
                                                                const isSecurity = svc.name === 'ufw' || svc.name === 'crowdsec';
                                                                const isFirewall = ['ufw', 'firewalld', 'iptables', 'nftables'].includes(svc.name);
                                                                const type = SERVICE_NAME_TO_TYPE[svc.name] || 'systemd' as ServiceType;
                                                                const label = SERVICE_TYPE_LABELS[type] || svc.name;
                                                                const isSvcOnline = svc.status === 'running' || svc.status === 'online' || svc.status === 'active';

                                                                // For firewalls, show type in parentheses
                                                                const displayName = isFirewall
                                                                    ? `${label} (${svc.name})`
                                                                    : label;

                                                                const handleClick = svc.name === 'ufw'
                                                                    ? () => setFwAgent(server.id)
                                                                    : svc.name === 'crowdsec'
                                                                        ? () => setCsAgent(server.id)
                                                                        : () => setSelectedService({
                                                                            agentId: server.id,
                                                                            agentName: server.name || server.hostname,
                                                                            serviceId: svc.id,
                                                                            serviceName: svc.name,
                                                                            serviceLabel: label,
                                                                            serviceType: type,
                                                                            status: svc.status,
                                                                            metrics: svc.metrics
                                                                        });

                                                                return (
                                                                <Tooltip title={`Manage ${displayName}`} key={svc.name}>
                                                                    <Tag
                                                                        onClick={handleClick}
                                                                        style={{
                                                                            cursor: 'pointer',
                                                                            borderRadius: '6px',
                                                                            padding: '4px 10px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            marginRight: 0,
                                                                            border: isSecurity ? undefined : `1px solid ${token.colorBorderSecondary}`,
                                                                            background: isSecurity ? (svc.name === 'ufw' ? token.colorInfoBg : token.colorWarningBg) : token.colorBgContainer
                                                                        }}
                                                                        color={isSecurity ? (svc.name === 'ufw' ? 'info' : 'warning') : undefined}
                                                                    >
                                                                        <div style={{
                                                                            width: '4px',
                                                                            height: '4px',
                                                                            borderRadius: '50%',
                                                                            background: isSvcOnline ? token.colorSuccess : token.colorTextDisabled
                                                                        }} />
                                                                        <Text style={{ fontSize: '11px', fontWeight: 600, color: 'inherit' }}>{displayName}</Text>
                                                                    </Tag>
                                                                </Tooltip>
                                                            );
                                                        })
                                                    ) : (
                                                        <div style={{ 
                                                            width: '100%', 
                                                            padding: '24px', 
                                                            borderRadius: '12px', 
                                                            border: `1px dashed ${token.colorBorder}`, 
                                                            textAlign: 'center' 
                                                        }}>
                                                            <Text type="secondary" italic style={{ fontSize: '12px' }}>No managed services reported</Text>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </div>
            </Space>

            {/* Modals */}
            {fwAgent && <FirewallModal isOpen={true} onClose={() => setFwAgent(null)} agentId={fwAgent} />}
            {csAgent && <CrowdSecModal isOpen={true} onClose={() => setCsAgent(null)} agentId={csAgent} />}
            {approvingAgentId && (
                <ApproveServerModal
                    isOpen={true}
                    onClose={() => setApprovingAgentId(null)}
                    agentId={approvingAgentId}
                    hostname={getApprovingAgent()?.hostname || ''}
                />
            )}
            {selectedService && <ServiceDetailModal isOpen={true} onClose={() => setSelectedService(null)} {...selectedService} />}
            {serverSettingsAgent && (
                <ServerSettingsModal
                    isOpen={true}
                    onClose={() => setServerSettingsAgent(null)}
                    agentId={serverSettingsAgent.id}
                    agentName={serverSettingsAgent.name}
                />
            )}
        </PageContainer>
    );
}

