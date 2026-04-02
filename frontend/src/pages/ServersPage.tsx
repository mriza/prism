import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAgentsContext } from '../contexts/AgentsContext';
import { theme } from 'antd';
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
    'valkey': 'valkey-cache',
    'valkey-server': 'valkey-cache',
};

export function ServersPage() {
    const { agents, loading, error, deleteAgent } = useAgents();
    const { usingPollingFallback } = useAgentsContext();
    const { token } = theme.useToken();
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
            <Space direction="vertical" size="large" className="prism-full-width">
                {usingPollingFallback && (
                    <Alert
                        message="Real-time Updates Unavailable"
                        description="WebSocket connection failed. Using polling mode for agent updates (refreshes every 5 seconds). Check your network connection or server status."
                        type="warning"
                        showIcon
                        className="prism-margin-lg"
                    />
                )}

                {error && (
                    <Alert
                        message="Deployment Alert"
                        description={error}
                        type="error"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        className="prism-rounded"
                    />
                )}

                {/* Pending Approvals */}
                {pendingAgents.length > 0 && user?.role === 'admin' && (
                    <div>
                        <Divider titlePlacement="left" className="prism-margin-sm prism-margin-top-0">
                            <Space>
                                <ExclamationCircleOutlined className="prism-text-warning" />
                                <Text strong className="prism-section-header prism-text-warning">Security Check Required</Text>
                            </Space>
                        </Divider>
                        <Row gutter={[24, 24]}>
                            {pendingAgents.map(agent => (
                                <Col xs={24} md={12} lg={8} key={agent.id}>
                                    <Card
                                        className="prism-border-warning-outline prism-bg-warning-hover"
                                        styles={{ body: { padding: token.paddingLG } }}
                                    >
                                        <Space direction="vertical" size="middle" className="prism-full-width">
                                            <Space align="start">
                                                <div className="prism-padding-sm prism-rounded-lg prism-bg-warning prism-text-warning prism-flex-center prism-border-warning">
                                                    <CloudServerOutlined className="prism-text-lg" />
                                                </div>
                                                <div>
                                                    <Text strong>{agent.hostname}</Text>
                                                    <br />
                                                    <Text type="secondary" className="prism-text-sm prism-uppercase">{agent.osInfo || 'Awaiting Specs'}</Text>
                                                </div>
                                            </Space>
                                            <Text type="secondary" className="prism-text-sm">
                                                An unauthorized agent is attempting to join the fleet. Please verify credentials.
                                            </Text>
                                            <Space className="prism-full-width">
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
                    <Divider titlePlacement="left" plain>
                        <Space>
                            <CloudServerOutlined />
                            <Text strong className="prism-section-header">Active Fleet</Text>
                        </Space>
                    </Divider>

                    {loading && registeredServers.length === 0 ? (
                        <div className="prism-padding-xl-2 prism-text-center">
                            <Space direction="vertical">
                                <Button type="text" loading />
                                <Text type="secondary" strong className="prism-text-sm prism-uppercase prism-letter-spacing-1">Connecting to infrastructure...</Text>
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
                                        className="prism-card"
                                        styles={{ body: { padding: 0 } }}
                                    >
                                        {/* Header */}
                                        <div className="prism-padding-md-lg prism-border-bottom prism-flex-between">
                                            <Space size="middle">
                                                <CloudServerOutlined className={`${server.status === 'online' ? 'prism-text-success' : 'prism-text-secondary'} prism-text-lg`} />
                                                <div>
                                                    <Text strong className="prism-text-sm">{server.name || server.hostname}</Text>
                                                    <br />
                                                    <Text type="secondary" className="prism-text-sm prism-uppercase">{server.hostname}</Text>
                                                </div>
                                            </Space>
                                            <Space>
                                                <Badge status={server.status === 'online' ? 'success' : 'default'} text={server.status.toUpperCase()} className="prism-text-sm prism-text-bold" />
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
                                        <div className="prism-padding-lg">
                                            {server.description && (
                                                <Paragraph type="secondary" italic className="prism-text-sm prism-border-left-primary prism-padding-left-sm prism-margin-lg">
                                                    {server.description}
                                                </Paragraph>
                                            )}

                                            <div className="prism-margin-xs">
                                                <Space className="prism-margin-sm">
                                                    <DashboardOutlined className="prism-text-sm prism-opacity-3" />
                                                    <Text strong className="prism-section-header">Managed Services</Text>
                                                </Space>

                                                <div className="prism-flex-wrap prism-gap-xs">
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
                                                                        className={`prism-pointer prism-rounded-sm prism-flex-center prism-gap-sm ${isSecurity ? '' : 'prism-border-secondary'} ${isSecurity ? (svc.name === 'ufw' ? 'prism-bg-info' : 'prism-bg-warning') : 'prism-bg-container'}`}
                                                                        color={isSecurity ? (svc.name === 'ufw' ? 'info' : 'warning') : undefined}
                                                                    >
                                                                        <div className={`prism-status-dot ${isSvcOnline ? 'prism-bg-success' : 'prism-bg-secondary'}`} />
                                                                        <Text className="prism-text-sm prism-text-bold" style={{ color: 'currentColor' }}>{displayName}</Text>
                                                                    </Tag>
                                                                </Tooltip>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="prism-full-width prism-padding-lg prism-rounded prism-border-dashed prism-text-center">
                                                            <Text type="secondary" italic className="prism-text-sm">No managed services reported</Text>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Runtimes Section */}
                                            {server.runtimes && server.runtimes.length > 0 && (
                                                <div className="prism-margin-lg">
                                                    <Space className="prism-margin-sm">
                                                        <SettingOutlined className="prism-text-sm prism-opacity-3" />
                                                        <Text strong className="prism-section-header">Runtime Environments</Text>
                                                    </Space>
                                                    <div className="prism-flex-wrap prism-gap-xs">
                                                        {server.runtimes.map(rt => (
                                                            <Tooltip title={`${rt.name} ${rt.version} detected at ${rt.path}`} key={rt.name}>
                                                                <Tag className="prism-rounded-sm prism-text-sm prism-bg-layout prism-border-secondary prism-padding-xs">
                                                                    <Text strong className="prism-text-primary">{rt.name}</Text>
                                                                    <Text type="secondary" className="prism-margin-left-xs prism-text-sm">{rt.version}</Text>
                                                                </Tag>
                                                            </Tooltip>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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

