import { useState, useEffect } from 'react';
import {
    Modal,
    Tabs,
    Space,
    Typography,
    theme,
    Alert,
    Result,
    Descriptions,
    Row,
    Col,
    Card,
    Spin,
    Empty,
    Tag
} from 'antd';
import {
    ControlOutlined,
    PlayCircleOutlined,
    StopOutlined,
    ReloadOutlined,
    InfoCircleOutlined,
    DatabaseOutlined,
    CloudServerOutlined,
    GlobalOutlined,
    HddOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    WifiOutlined,
    FireOutlined,
    KeyOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { DatabaseManager } from './services/managers/DatabaseManager';
import { RabbitMQManager } from './services/managers/RabbitMQManager';
import { WebServerManager } from './services/managers/WebServerManager';
import { StorageManager } from './services/managers/StorageManager';
import { CacheManager } from './services/managers/CacheManager';
import { MQTTManager } from './services/managers/MQTTManager';
import { FTPManager } from './services/managers/FTPManager';
import { ManagementCredentialsTab } from './services/ManagementCredentialsTab';
import { ApplicationAccountsTab } from './services/ApplicationAccountsTab';
import { ConfigurationTab } from './services/ConfigurationTab';
import { LogsTab } from './services/LogsTab';
import { useAccounts } from '../hooks/useAccounts';
import type { ServiceType } from '../types';

const { Text } = Typography;

const SERVICE_NAME_TO_TYPE: Record<string, ServiceType> = {
    mongodb: 'mongodb', mongod: 'mongodb',
    mysql: 'mysql', mariadb: 'mysql',
    postgresql: 'postgresql', postgres: 'postgresql',
    rabbitmq: 'rabbitmq',
    mosquitto: 'mqtt-mosquitto',
    minio: 's3-minio',
    garage: 's3-garage',
    vsftpd: 'ftp-vsftpd',
    sftpgo: 'ftp-sftpgo',
    caddy: 'web-caddy',
    nginx: 'web-nginx',
    pm2: 'pm2',
    supervisor: 'supervisor',
    systemd: 'systemd',
    crowdsec: 'security-crowdsec',
    valkey: 'valkey-cache',
};

interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    serviceName: string;
}

export function ServiceModal({ isOpen, onClose, agentId, serviceName }: ServiceModalProps) {
    const [activeTab, setActiveTab] = useState('overview');
    const [facts, setFacts] = useState<Record<string, any> | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionOutput, setActionOutput] = useState<string | null>(null);
    const { token } = theme.useToken();
    const { managementAccountsByService, accounts } = useAccounts();

    const serviceType = SERVICE_NAME_TO_TYPE[serviceName.toLowerCase()];
    const mgmtAccounts = serviceType ? managementAccountsByService(agentId, serviceType) : [];
    
    // Filter application accounts for this service
    const appAccounts = accounts.filter(a => 
        a.agentId === agentId && 
        a.type === serviceType &&
        a.category !== 'management'
    );

    const isDatabase = ['mysql', 'mariadb', 'postgresql'].includes(serviceName);
    const isRabbitMQ = serviceName === 'rabbitmq';
    const isWebServer = ['caddy', 'nginx', 'web-caddy', 'web-nginx'].includes(serviceName);
    const isStorage = ['minio', 'garage', 'seaweedfs', 's3-minio', 's3-garage'].includes(serviceName);
    const isCache = ['valkey', 'redis', 'cache-valkey', 'cache-redis', 'valkey-cache', 'valkey-broker', 'valkey-nosql'].includes(serviceName);
    const isMQTT = ['mosquitto', 'mqtt-mosquitto'].includes(serviceName);
    const isFTP = ['vsftpd', 'ftp-vsftpd'].includes(serviceName);

    useEffect(() => {
        if (isOpen) {
            fetchFacts();
            setActiveTab('overview');
            setActionOutput(null);
            setError(null);
        }
    }, [isOpen, agentId, serviceName]);

    const sendCommand = async (action: string, options: Record<string, unknown> = {}) => {
        setLoading(true);
        setError(null);
        setActionOutput(null);
        try {
            const response = await fetch(`/api/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: serviceName,
                    action: action,
                    options: options
                })
            });

            if (!response.ok) throw new Error('Command failed');

            const data = await response.json();
            if (!data.success && data.message) {
                throw new Error(data.message);
            }
            return data;
        } catch (err: any) {
            setError(err.message || String(err));
            return null;
        } finally {
            setLoading(false);
        }
    };

    const fetchFacts = async () => {
        const data = await sendCommand('get_facts');
        if (data && data.message) {
            try {
                setFacts(JSON.parse(data.message));
            } catch {
                setFacts({ raw: data.message });
            }
        }
    };

    const tabItems = [
        {
            key: 'overview',
            label: <Space><InfoCircleOutlined />Overview</Space>,
            children: (
                <div style={{ padding: `${token.paddingSM}px 0` }}>
                    {facts ? (
                        <Card
                            style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter }}
                            styles={{ body: { padding: token.paddingLG } }}
                        >
                            <Descriptions
                                column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                                bordered
                                size="small"
                                style={{ borderRadius: token.borderRadius, overflow: 'hidden' }}
                            >
                                {Object.entries(facts).map(([key, value]) => (
                                    <Descriptions.Item
                                        key={key}
                                        label={<Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', opacity: 0.6 }}>{key.replace(/_/g, ' ')}</Text>}
                                    >
                                        <Text code style={{ fontSize: token.fontSizeSM, border: 'none', background: 'transparent' }}>{String(value)}</Text>
                                    </Descriptions.Item>
                                ))}
                            </Descriptions>
                        </Card>
                    ) : (
                        <Result
                            icon={<InfoCircleOutlined style={{ color: token.colorTextDescription }} />}
                            title="No diagnostic facts available"
                            subTitle="We couldn't retrieve specific metrics for this service at this time."
                        />
                    )}
                </div>
            )
        },
        {
            key: 'control',
            label: <Space><ControlOutlined />Control</Space>,
            children: (
                <div style={{ padding: `${token.paddingLG}px 0` }}>
                    <Row gutter={24}>
                        <Col span={8}>
                            <Card
                                hoverable
                                onClick={() => sendCommand('start').then(res => res && setActionOutput("Service Started Successfully"))}
                                styles={{ body: { textAlign: 'center', padding: `${token.paddingLG}px ${token.paddingSM}` } }}
                                style={{ borderRadius: token.borderRadiusLG }}
                            >
                                <div style={{ fontSize: token.fontSizeHeading1, color: token.colorSuccess, marginBottom: token.marginSM }}><PlayCircleOutlined /></div>
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Start</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card
                                hoverable
                                onClick={() => sendCommand('stop').then(res => res && setActionOutput("Service Stopped Successfully"))}
                                styles={{ body: { textAlign: 'center', padding: '32px 16px' } }}
                                style={{ borderRadius: token.borderRadiusLG }}
                            >
                                <div style={{ fontSize: token.fontSizeHeading1, color: token.colorError, marginBottom: token.marginSM }}><StopOutlined /></div>
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Stop</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card
                                hoverable
                                onClick={() => sendCommand('restart').then(res => res && setActionOutput("Service Restarted Successfully"))}
                                styles={{ body: { textAlign: 'center', padding: '32px 16px' } }}
                                style={{ borderRadius: token.borderRadiusLG }}
                            >
                                <div style={{ fontSize: token.fontSizeHeading1, color: token.colorWarning, marginBottom: token.marginSM }}><ReloadOutlined /></div>
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Restart</Text>
                            </Card>
                        </Col>
                    </Row>
                    {actionOutput && (
                        <Alert
                            message={actionOutput}
                            type="success"
                            showIcon
                            icon={<CheckCircleOutlined />}
                            style={{ marginTop: token.marginLG, borderRadius: token.borderRadius }}
                        />
                    )}
                </div>
            )
        }
    ];

    // Add Accounts tab with nested tabs for Management Credentials and Application Accounts
    tabItems.push({
        key: 'accounts',
        label: <Space><KeyOutlined />Accounts</Space>,
        children: (
            <Tabs
                type="card"
                items={[
                    {
                        key: 'management',
                        label: 'Management Credentials',
                        children: (
                            <ManagementCredentialsTab
                                agentId={agentId}
                                serviceId=""
                                serviceName={serviceName}
                                serviceType={serviceType as any}
                            />
                        )
                    },
                    {
                        key: 'application',
                        label: `Application Accounts (${appAccounts.length})`,
                        children: (
                            <ApplicationAccountsTab
                                agentId={agentId}
                                serviceName={serviceName}
                                serviceType={serviceType}
                                accounts={appAccounts}
                                onCreateAccount={() => {/* TODO */}}
                                onEditAccount={() => {/* TODO */}}
                                onDeleteAccount={() => {/* TODO */}}
                            />
                        )
                    }
                ]}
            />
        )
    });

    // Add Configuration tab
    tabItems.push({
        key: 'configuration',
        label: <Space><SettingOutlined />Configuration</Space>,
        children: (
            <ConfigurationTab
                _agentId={agentId}
                _serviceName={serviceName}
                _serviceType={serviceType}
            />
        )
    });

    // Add Logs tab
    tabItems.push({
        key: 'logs',
        label: <Space><FireOutlined />Logs</Space>,
        children: (
            <LogsTab
                _agentId={agentId}
                _serviceName={serviceName}
            />
        )
    });

    if (isDatabase) {
        tabItems.push({
            key: 'database',
            label: <Space><DatabaseOutlined />Database</Space>,
            children: <DatabaseManager sendCommand={sendCommand} />
        });
    }

    if (isRabbitMQ) {
        tabItems.push({
            key: 'rabbitmq',
            label: <Space><CloudServerOutlined />RabbitMQ</Space>,
            children: <RabbitMQManager sendCommand={sendCommand} />
        });
    }

    if (isWebServer) {
        tabItems.push({
            key: 'sites',
            label: <Space><GlobalOutlined />Sites</Space>,
            children: <WebServerManager sendCommand={sendCommand} serviceName={serviceName} />
        });
    }

    if (isStorage) {
        tabItems.push({
            key: 'storage',
            label: <Space><HddOutlined />Storage</Space>,
            children: <StorageManager sendCommand={sendCommand} />
        });
    }

    if (isCache) {
        tabItems.push({
            key: 'cache',
            label: <Space><FireOutlined />Cache</Space>,
            children: <CacheManager sendCommand={sendCommand} />
        });
    }

    if (isMQTT) {
        tabItems.push({
            key: 'mqtt',
            label: <Space><WifiOutlined />MQTT</Space>,
            children: <MQTTManager sendCommand={sendCommand} />
        });
    }

    if (isFTP) {
        tabItems.push({
            key: 'ftp',
            label: <Space><CloudServerOutlined />FTP</Space>,
            children: <FTPManager sendCommand={sendCommand} />
        });
    }

    tabItems.push({
        key: 'mgmt-account',
        label: <Space><KeyOutlined />Management Account</Space>,
        children: (
            <div style={{ padding: `${token.paddingSM}px 0` }}>
                {mgmtAccounts.length === 0 ? (
                    <Empty
                        description="No management account configured for this service"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                ) : (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {mgmtAccounts.map(a => (
                            <Card
                                key={a.id}
                                style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                                styles={{ body: { padding: `${token.paddingMD}px ${token.paddingLG}` } }}
                            >
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Space>
                                        <Text strong style={{ fontSize: token.fontSize }}>{a.name}</Text>
                                        <Tag color="orange" style={{ borderRadius: token.borderRadiusSM, fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>Management</Tag>
                                    </Space>
                                    <Descriptions size="small" column={2} bordered style={{ marginTop: token.marginSM }}>
                                        {a.host && <Descriptions.Item label="Host"><Text code>{a.host}</Text></Descriptions.Item>}
                                        {a.port && <Descriptions.Item label="Port"><Text code>{a.port}</Text></Descriptions.Item>}
                                        {a.username && <Descriptions.Item label="Username"><Text code>{a.username}</Text></Descriptions.Item>}
                                        {a.databases && a.databases.length > 0 && (
                                            <Descriptions.Item label="Databases" span={2}>
                                                <Space wrap>{a.databases.map(db => <Tag key={db}>{db}</Tag>)}</Space>
                                            </Descriptions.Item>
                                        )}
                                        {a.accessKey && <Descriptions.Item label="Access Key"><Text code>{a.accessKey}</Text></Descriptions.Item>}
                                        {a.bucket && <Descriptions.Item label="Bucket"><Text code>{a.bucket}</Text></Descriptions.Item>}
                                        {a.rootPath && <Descriptions.Item label="Root Path"><Text code>{a.rootPath}</Text></Descriptions.Item>}
                                    </Descriptions>
                                </Space>
                            </Card>
                        ))}
                    </Space>
                )}
            </div>
        )
    });

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            title={
                <Space size="middle">
                    <div style={{
                        padding: '8px',
                        borderRadius: '10px',
                        backgroundColor: `${token.colorPrimary}15`,
                        color: token.colorPrimary,
                        display: 'flex'
                    }}>
                        <CloudServerOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5, textTransform: 'uppercase' }}>{serviceName}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM }}>
                            Agent: <Text code>{agentId}</Text>
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={1000}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <div style={{ marginTop: token.marginLG }}>
                {error && (
                    <Alert message={error} type="error" showIcon style={{ marginBottom: token.marginLG, borderRadius: token.borderRadius }} />
                )}

                {loading ? (
                    <div style={{ padding: `${token.paddingXL}px 0`, textAlign: 'center' }}>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} tip="Executing operation..." />
                    </div>
                ) : (
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                        type="card"
                    />
                )}
            </div>
        </Modal>
    );
}
