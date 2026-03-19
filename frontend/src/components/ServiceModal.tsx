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
    Spin
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
    FireOutlined
} from '@ant-design/icons';
import { DatabaseManager } from './services/managers/DatabaseManager';
import { RabbitMQManager } from './services/managers/RabbitMQManager';
import { WebServerManager } from './services/managers/WebServerManager';
import { StorageManager } from './services/managers/StorageManager';
import { CacheManager } from './services/managers/CacheManager';
import { MQTTManager } from './services/managers/MQTTManager';
import { FTPManager } from './services/managers/FTPManager';

const { Text } = Typography;

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

    const isDatabase = ['mysql', 'mariadb', 'postgresql'].includes(serviceName);
    const isRabbitMQ = serviceName === 'rabbitmq';
    const isWebServer = ['caddy', 'nginx', 'web-caddy', 'web-nginx'].includes(serviceName);
    const isStorage = ['minio', 'garage', 'seaweedfs', 's3-minio', 's3-garage'].includes(serviceName);
    const isCache = ['valkey', 'redis', 'cache-valkey', 'cache-redis'].includes(serviceName);
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
                <div style={{ padding: '12px 0' }}>
                    {facts ? (
                        <Card
                            style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter }}
                            bodyStyle={{ padding: '24px' }}
                        >
                            <Descriptions
                                column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                                bordered
                                size="small"
                                style={{ borderRadius: '12px', overflow: 'hidden' }}
                            >
                                {Object.entries(facts).map(([key, value]) => (
                                    <Descriptions.Item
                                        key={key}
                                        label={<Text strong style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.6 }}>{key.replace(/_/g, ' ')}</Text>}
                                    >
                                        <Text code style={{ fontSize: '12px', border: 'none', background: 'transparent' }}>{String(value)}</Text>
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
                <div style={{ padding: '24px 0' }}>
                    <Row gutter={24}>
                        <Col span={8}>
                            <Card
                                hoverable
                                onClick={() => sendCommand('start').then(res => res && setActionOutput("Service Started Successfully"))}
                                bodyStyle={{ textAlign: 'center', padding: '32px 16px' }}
                                style={{ borderRadius: '20px' }}
                            >
                                <div style={{ fontSize: '32px', color: token.colorSuccess, marginBottom: '16px' }}><PlayCircleOutlined /></div>
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Start</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card
                                hoverable
                                onClick={() => sendCommand('stop').then(res => res && setActionOutput("Service Stopped Successfully"))}
                                bodyStyle={{ textAlign: 'center', padding: '32px 16px' }}
                                style={{ borderRadius: '20px' }}
                            >
                                <div style={{ fontSize: '32px', color: token.colorError, marginBottom: '16px' }}><StopOutlined /></div>
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Stop</Text>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card
                                hoverable
                                onClick={() => sendCommand('restart').then(res => res && setActionOutput("Service Restarted Successfully"))}
                                bodyStyle={{ textAlign: 'center', padding: '32px 16px' }}
                                style={{ borderRadius: '20px' }}
                            >
                                <div style={{ fontSize: '32px', color: token.colorWarning, marginBottom: '16px' }}><ReloadOutlined /></div>
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
                            style={{ marginTop: '24px', borderRadius: '12px' }}
                        />
                    )}
                </div>
            )
        }
    ];

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
                        <Text strong style={{ fontSize: '16px', textTransform: 'uppercase' }}>{serviceName}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            Agent: <Text code>{agentId}</Text>
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={1000}
            style={{ borderRadius: '24px', overflow: 'hidden' }}
        >
            <div style={{ marginTop: '24px' }}>
                {error && (
                    <Alert message={error} type="error" showIcon style={{ marginBottom: '24px', borderRadius: '12px' }} />
                )}

                {loading ? (
                    <div style={{ padding: '60px 0', textAlign: 'center' }}>
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
