import { useState, useEffect } from 'react';
import {
    Button,
    Space,
    Typography,
    theme,
    Alert,
    Divider,
    Card,
    Table,
    Row,
    Col,
    Tag,
    Badge,
    Input,
    Select,
    Form,
    message
} from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    GlobalOutlined,
    InteractionOutlined,
    ArrowRightOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    SettingOutlined,
    SwapOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

interface RabbitMQManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
}

interface Exchange {
    name: string;
    vhost: string;
    type: string;
}

interface Queue {
    name: string;
    vhost: string;
    messages: number;
    state: string;
}

interface Binding {
    source: string;
    destination: string;
    routing_key: string;
    vhost: string;
}

export function RabbitMQManager({ sendCommand }: RabbitMQManagerProps) {
    const [vhosts, setVhosts] = useState<string[]>([]);
    const [queues, setQueues] = useState<Queue[]>([]);
    const [exchanges, setExchanges] = useState<Exchange[]>([]);
    const [bindings, setBindings] = useState<Binding[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [form] = Form.useForm();
    const { token } = theme.useToken();

    useEffect(() => {
        fetchData();
        loadSettings();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const vhRes = await sendCommand('rabbitmq_list_vhosts');
            if (vhRes?.success) {
                setVhosts(typeof vhRes.message === 'string' ? JSON.parse(vhRes.message) : vhRes.message);
            }

            const qRes = await sendCommand('rabbitmq_list_queues');
            if (qRes?.success) {
                setQueues(typeof qRes.message === 'string' ? JSON.parse(qRes.message) : qRes.message);
            }

            const exRes = await sendCommand('rabbitmq_list_exchanges');
            if (exRes?.success) {
                setExchanges(typeof exRes.message === 'string' ? JSON.parse(exRes.message) : exRes.message);
            }

            const bindRes = await sendCommand('rabbitmq_list_bindings');
            if (bindRes?.success) {
                setBindings(typeof bindRes.message === 'string' ? JSON.parse(bindRes.message) : bindRes.message);
            }

            const userRes = await sendCommand('rabbitmq_list_users');
            if (userRes?.success) {
                setUsers(typeof userRes.message === 'string' ? JSON.parse(userRes.message) : userRes.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch RabbitMQ data');
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        setLoadingSettings(true);
        try {
            const res = await sendCommand('get_settings');
            if (res?.success) {
                const settingsData = typeof res.message === 'string' ? JSON.parse(res.message) : res.message;
                setSettings(settingsData);
                form.setFieldsValue(settingsData);
            }
        } catch (err: any) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleUpdateSettings = async (values: any) => {
        setUpdatingSettings(true);
        try {
            const res = await sendCommand('update_settings', values);
            if (res?.success) {
                message.success('Settings updated successfully');
                loadSettings();
            }
        } catch (err: any) {
            message.error('Failed to update settings');
        } finally {
            setUpdatingSettings(false);
        }
    };

    const handleCreateVHost = async (name: string) => {
        if (!name) return;
        const res = await sendCommand('rabbitmq_add_vhost', { vhost: name });
        if (res?.success) {
            message.success(`VHost ${name} created successfully`);
            fetchData();
        }
    };

    const handleDeleteVHost = async (name: string) => {
        const res = await sendCommand('rabbitmq_delete_vhost', { vhost: name });
        if (res?.success) {
            message.success(`VHost ${name} deleted successfully`);
            fetchData();
        }
    };

    const handleCreateExchange = async (values: any) => {
        const res = await sendCommand('rabbitmq_declare_exchange', {
            vhost: values.vhost || '/',
            name: values.name,
            kind: values.type || 'direct'
        });
        if (res?.success) {
            message.success('Exchange created successfully');
            fetchData();
        }
    };

    const handleCreateQueue = async (values: any) => {
        const res = await sendCommand('rabbitmq_declare_queue', {
            vhost: values.vhost || '/',
            name: values.name
        });
        if (res?.success) {
            message.success('Queue created successfully');
            fetchData();
        }
    };

    const handleCreateBinding = async (values: any) => {
        const res = await sendCommand('rabbitmq_create_binding', {
            vhost: values.vhost || '/',
            sourceExchange: values.exchange,
            destinationQueue: values.queue,
            routingKey: values.routing_key || ''
        });
        if (res?.success) {
            message.success('Binding created successfully');
            fetchData();
        }
    };

    const queueColumns = [
        {
            title: 'Queue Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <Text strong>{name}</Text>
        },
        {
            title: 'VHost',
            dataIndex: 'vhost',
            key: 'vhost',
            render: (vh: string) => <Tag color="blue">{vh}</Tag>
        },
        {
            title: 'Status',
            dataIndex: 'state',
            key: 'state',
            render: (state: string) => (
                <Badge status={state === 'running' ? 'success' : 'default'} text={<Text style={{ fontSize: '12px' }}>{state}</Text>} />
            )
        },
        {
            title: 'Messages',
            dataIndex: 'messages',
            key: 'messages',
            render: (count: number) => <Text code>{count || 0}</Text>
        }
    ];

    const exchangeColumns = [
        {
            title: 'Exchange Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => (
                <Space>
                    <SwapOutlined style={{ color: token.colorWarning }} />
                    <Text strong>{name}</Text>
                </Space>
            )
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => (
                <Tag color={type === 'direct' ? 'green' : type === 'fanout' ? 'purple' : 'orange'}>
                    {type}
                </Tag>
            )
        },
        {
            title: 'VHost',
            dataIndex: 'vhost',
            key: 'vhost',
            render: (vh: string) => <Tag color="blue">{vh}</Tag>
        }
    ];

    const bindingColumns = [
        {
            title: 'Source',
            dataIndex: 'source',
            key: 'source',
            render: (source: string) => <Text code>{source}</Text>
        },
        {
            title: '',
            key: 'arrow',
            render: () => <ArrowRightOutlined style={{ opacity: 0.5 }} />
        },
        {
            title: 'Destination',
            dataIndex: 'destination',
            key: 'destination',
            render: (dest: string) => <Text code>{dest}</Text>
        },
        {
            title: 'Routing Key',
            dataIndex: 'routing_key',
            key: 'routing_key',
            render: (key: string) => <Tag>{key || '*'}</Tag>
        },
        {
            title: 'VHost',
            dataIndex: 'vhost',
            key: 'vhost',
            render: (vh: string) => <Tag color="blue">{vh}</Tag>
        }
    ];

    return (
        <div style={{ padding: '4px 0' }}>
            {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: '24px', borderRadius: '12px' }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header */}
                <Card
                    style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter }}
                    bodyStyle={{ padding: '20px' }}
                >
                    <Row gutter={24} align="middle">
                        <Col span={16}>
                            <Space size="middle">
                                <div style={{
                                    padding: '10px',
                                    borderRadius: '12px',
                                    backgroundColor: `${token.colorWarning}15`,
                                    color: token.colorWarning,
                                    fontSize: '20px',
                                    display: 'flex'
                                }}>
                                    <InteractionOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '15px', display: 'block' }}>Message Broker Configuration</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Manage Virtual Hosts, Queues, Exchanges, and Routing policies.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: '8px' }}>Refresh</Button>
                                <Button icon={<InfoCircleOutlined />} style={{ borderRadius: '8px' }}>Broker Logs</Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

                {/* Settings Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '0 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Service Settings</Text>
                </Divider>

                <Card
                    loading={loadingSettings}
                    style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}
                    bodyStyle={{ padding: '24px' }}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdateSettings}
                        initialValues={settings}
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Form.Item
                                    name="port"
                                    label={<Text strong style={{ fontSize: '12px' }}>AMQP Port</Text>}
                                    help="Port for AMQP connections (default: 5672)"
                                >
                                    <Input placeholder="5672" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="management_port"
                                    label={<Text strong style={{ fontSize: '12px' }}>Management Port</Text>}
                                    help="Port for web management interface (default: 15672)"
                                >
                                    <Input placeholder="15672" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item
                                    name="config_path"
                                    label={<Text strong style={{ fontSize: '12px' }}>Config Path</Text>}
                                    help="Path to rabbitmq.conf file"
                                >
                                    <Input placeholder="/etc/rabbitmq/rabbitmq.conf" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="admin_username"
                                    label={<Text strong style={{ fontSize: '12px' }}>Admin Username</Text>}
                                    help="Default administrator username"
                                >
                                    <Input placeholder="admin" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="admin_password"
                                    label={<Text strong style={{ fontSize: '12px' }}>Admin Password</Text>}
                                    help="Leave blank to keep current password"
                                >
                                    <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item
                                    name="enabled_plugins"
                                    label={<Text strong style={{ fontSize: '12px' }}>Enabled Plugins</Text>}
                                    help="Comma-separated list of enabled plugins"
                                >
                                    <Input placeholder="rabbitmq_management,rabbitmq_peer_discovery_localnode" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={updatingSettings}
                            icon={<SettingOutlined />}
                            style={{ borderRadius: '8px' }}
                        >
                            Save Settings
                        </Button>
                    </Form>
                </Card>

                {/* VHosts Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Virtual Hosts</Text>
                </Divider>

                <Row gutter={[16, 16]}>
                    {vhosts.map(vh => (
                        <Col xs={12} sm={8} md={6} key={vh}>
                            <Card
                                size="small"
                                style={{ borderRadius: '12px', border: `1px solid ${token.colorBorderSecondary}` }}
                                bodyStyle={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <Space>
                                    <GlobalOutlined style={{ color: token.colorPrimary }} />
                                    <Text strong>{vh}</Text>
                                </Space>
                                {vh !== '/' && (
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDeleteVHost(vh)}
                                    />
                                )}
                            </Card>
                        </Col>
                    ))}
                    <Col xs={12} sm={8} md={6}>
                        <Button
                            block
                            type="dashed"
                            icon={<PlusOutlined />}
                            style={{ height: '100%', borderRadius: '12px', minHeight: '42px' }}
                            onClick={() => {
                                const name = prompt('Enter new VHost name:');
                                if (name) handleCreateVHost(name);
                            }}
                        >
                            Add VHost
                        </Button>
                    </Col>
                </Row>

                {/* Exchanges Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Exchanges</Text>
                </Divider>

                <Table
                    columns={exchangeColumns}
                    dataSource={exchanges.map((e, i) => ({ ...e, key: i }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '12px', overflow: 'hidden' }}
                />

                <Card style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="inline"
                        onFinish={handleCreateExchange}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle" style={{ width: '100%' }}>
                            <Col flex="auto">
                                <Space wrap>
                                    <Form.Item name="name" label="Exchange Name">
                                        <Input placeholder="my-exchange" style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                    <Form.Item name="type" label="Type" initialValue="direct">
                                        <Select style={{ width: 120, borderRadius: '8px' }}>
                                            <Option value="direct">Direct</Option>
                                            <Option value="fanout">Fanout</Option>
                                            <Option value="topic">Topic</Option>
                                            <Option value="headers">Headers</Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item name="vhost" label="VHost" initialValue="/">
                                        <Select style={{ width: 100, borderRadius: '8px' }}>
                                            {vhosts.map(vh => <Option key={vh} value={vh}>{vh}</Option>)}
                                        </Select>
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: '8px' }}
                                >
                                    Create Exchange
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                {/* Queues Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Active Queues</Text>
                </Divider>

                <Table
                    columns={queueColumns}
                    dataSource={queues.map((q, i) => ({ ...q, key: i }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '12px', overflow: 'hidden' }}
                />

                <Card style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="inline"
                        onFinish={handleCreateQueue}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle" style={{ width: '100%' }}>
                            <Col flex="auto">
                                <Space wrap>
                                    <Form.Item name="name" label="Queue Name">
                                        <Input placeholder="my-queue" style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                    <Form.Item name="vhost" label="VHost" initialValue="/">
                                        <Select style={{ width: 100, borderRadius: '8px' }}>
                                            {vhosts.map(vh => <Option key={vh} value={vh}>{vh}</Option>)}
                                        </Select>
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: '8px' }}
                                >
                                    Create Queue
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                {/* Bindings Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Queue Bindings</Text>
                </Divider>

                <Table
                    columns={bindingColumns}
                    dataSource={bindings.map((b, i) => ({ ...b, key: i }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '12px', overflow: 'hidden' }}
                />

                <Card style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="inline"
                        onFinish={handleCreateBinding}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle" style={{ width: '100%' }}>
                            <Col flex="auto">
                                <Space wrap>
                                    <Form.Item name="exchange" label="Exchange">
                                        <Input placeholder="my-exchange" style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                    <Form.Item name="queue" label="Queue">
                                        <Input placeholder="my-queue" style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                    <Form.Item name="routing_key" label="Routing Key">
                                        <Input placeholder="#" style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                    <Form.Item name="vhost" label="VHost" initialValue="/">
                                        <Select style={{ width: 100, borderRadius: '8px' }}>
                                            {vhosts.map(vh => <Option key={vh} value={vh}>{vh}</Option>)}
                                        </Select>
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: '8px' }}
                                >
                                    Create Binding
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                {/* Users Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Users</Text>
                </Divider>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {users.length === 0 ? (
                        <Text type="secondary" italic>No users configured.</Text>
                    ) : (
                        users.map((u, i) => (
                            <Tag key={i} color="processing" style={{ borderRadius: '6px', padding: '4px 10px' }}>
                                <Space>
                                    <InteractionOutlined />
                                    <Text strong style={{ fontSize: '12px' }}>{typeof u === 'string' ? u : u.name}</Text>
                                    {typeof u === 'object' && u.tags && (
                                        <Tag color="orange" style={{ marginLeft: '4px' }}>{u.tags}</Tag>
                                    )}
                                </Space>
                            </Tag>
                        ))
                    )}
                </div>
            </Space>
        </div>
    );
}
