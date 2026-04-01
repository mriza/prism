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
    Input,
    Row,
    Col,
    Tag,
    Form,
    message,
    Modal,
    Statistic,
    Select
} from 'antd';
import {
    DatabaseOutlined,
    PlusOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SettingOutlined,
    KeyOutlined,
    HddOutlined,
    DashboardOutlined,
    UserOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface CacheManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
}

interface CacheKeyData {
    key: string;
    type: string;
    ttl: number;
    value?: string;
    members?: string[];
    fields?: Record<string, string>;
}

interface CacheClient {
    id: string;
    addr: string;
    age: number;
    idle: number;
}

export function CacheManager({ sendCommand }: CacheManagerProps) {
    const [users, setUsers] = useState<string[]>([]);
    const [keys, setKeys] = useState<CacheKeyData[]>([]);
    const [clients, setClients] = useState<CacheClient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [form] = Form.useForm();
    const [metrics, setMetrics] = useState<Record<string, number>>({});
    const [keyPattern, setKeyPattern] = useState('*');
    const [viewingKey, setViewingKey] = useState<CacheKeyData | null>(null);
    const [creatingKey, setCreatingKey] = useState(false);
    const { token } = theme.useToken();

    useEffect(() => {
        fetchData();
        loadSettings();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const userRes = await sendCommand('cache_list_users');
            if (userRes?.success) {
                setUsers(typeof userRes.message === 'string' ? JSON.parse(userRes.message) : userRes.message);
            }

            const keysRes = await sendCommand('cache_list_keys', { pattern: keyPattern });
            if (keysRes?.success) {
                setKeys(typeof keysRes.message === 'string' ? JSON.parse(keysRes.message) : keysRes.message);
            }

            const clientsRes = await sendCommand('cache_list_clients');
            if (clientsRes?.success) {
                setClients(typeof clientsRes.message === 'string' ? JSON.parse(clientsRes.message) : clientsRes.message);
            }

            const metricsRes = await sendCommand('cache_metrics');
            if (metricsRes?.success) {
                setMetrics(typeof metricsRes.message === 'string' ? JSON.parse(metricsRes.message) : metricsRes.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch cache data');
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

    const handleCreateUser = async (values: any) => {
        const res = await sendCommand('cache_create_user', {
            name: values.username,
            password: values.password,
            role: values.role || 'read'
        });
        if (res?.success) {
            message.success('User created successfully');
            fetchData();
        }
    };

    const handleDeleteUser = async (username: string) => {
        const res = await sendCommand('cache_delete_user', { name: username });
        if (res?.success) {
            message.success('User deleted successfully');
            fetchData();
        }
    };

    const handleViewKey = async (key: string) => {
        const res = await sendCommand('cache_get_key', { key });
        if (res?.success) {
            const keyData = typeof res.message === 'string' ? JSON.parse(res.message) : res.message;
            setViewingKey(keyData);
        }
    };

    const handleDeleteKey = async (key: string) => {
        const res = await sendCommand('cache_delete_key', { key });
        if (res?.success) {
            message.success('Key deleted successfully');
            fetchData();
        }
    };

    const handleCreateKey = async (values: any) => {
        setCreatingKey(true);
        try {
            const res = await sendCommand('cache_set_key', {
                key: values.key,
                value: values.value,
                ttl: values.ttl ? parseInt(values.ttl) : 0
            });
            if (res?.success) {
                message.success('Key created successfully');
                fetchData();
            }
        } finally {
            setCreatingKey(false);
        }
    };

    const handleKillClient = async (addr: string) => {
        const res = await sendCommand('cache_kill_client', { addr });
        if (res?.success) {
            message.success('Client disconnected');
            fetchData();
        }
    };

    const handleFlushDB = async () => {
        Modal.confirm({
            title: 'Flush Database',
            content: 'Are you sure you want to delete all keys in the current database? This action cannot be undone.',
            okText: 'Flush',
            okType: 'danger',
            onOk: async () => {
                const res = await sendCommand('cache_flush_db');
                if (res?.success) {
                    message.success('Database flushed successfully');
                    fetchData();
                }
            }
        });
    };

    const keyColumns = [
        {
            title: 'Key',
            dataIndex: 'key',
            key: 'key',
            render: (key: string) => (
                <Space>
                    <KeyOutlined style={{ color: token.colorPrimary }} />
                    <Text code>{key}</Text>
                </Space>
            )
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => (
                <Tag color={type === 'string' ? 'green' : type === 'hash' ? 'blue' : type === 'list' ? 'orange' : 'purple'}>
                    {type}
                </Tag>
            )
        },
        {
            title: 'TTL',
            dataIndex: 'ttl',
            key: 'ttl',
            render: (ttl: number) => (
                <Text>{ttl === -1 ? '∞' : ttl === -2 ? 'expired' : `${ttl}s`}</Text>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: CacheKeyData) => (
                <Space>
                    <Button
                        size="small"
                        type="text"
                        onClick={() => handleViewKey(record.key)}
                    >
                        View
                    </Button>
                    <Button
                        size="small"
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteKey(record.key)}
                    />
                </Space>
            )
        }
    ];

    const clientColumns = [
        {
            title: 'Client ID',
            dataIndex: 'id',
            key: 'id',
            render: (id: string) => <Text code>{id}</Text>
        },
        {
            title: 'Address',
            dataIndex: 'addr',
            key: 'addr',
            render: (addr: string) => <Text>{addr}</Text>
        },
        {
            title: 'Age',
            dataIndex: 'age',
            key: 'age',
            render: (age: number) => <Text>{age}s</Text>
        },
        {
            title: 'Idle',
            dataIndex: 'idle',
            key: 'idle',
            render: (idle: number) => <Text>{idle}s</Text>
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: CacheClient) => (
                <Button
                    size="small"
                    danger
                    type="text"
                    onClick={() => handleKillClient(record.addr)}
                >
                    Disconnect
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: `${token.paddingXXS}px 0` }}>
            {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header */}
                <Card
                    style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter }}
                    styles={{ body: { padding: token.paddingLG } }}
                >
                    <Row gutter={24} align="middle">
                        <Col span={16}>
                            <Space size="middle">
                                <div style={{
                                    padding: token.paddingSM,
                                    borderRadius: token.borderRadiusLG,
                                    backgroundColor: `${token.colorSuccess}15`,
                                    color: token.colorSuccess,
                                    fontSize: token.paddingLG,
                                    display: 'flex'
                                }}>
                                    <DatabaseOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: token.fontSize, display: 'block' }}>Cache Engine Management</Text>
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>In-memory data store management and configuration.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: token.borderRadius }}>Refresh</Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

                {/* Metrics */}
                {Object.keys(metrics).length > 0 && (
                    <Row gutter={16}>
                        <Col span={6}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Connected Clients"
                                    value={metrics.connected_clients || 0}
                                    prefix={<UserOutlined />}
                                    valueStyle={{ fontSize: token.paddingLG }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Used Memory"
                                    value={metrics.used_memory ? (metrics.used_memory / (1024 * 1024)).toFixed(1) : 0}
                                    suffix="MB"
                                    prefix={<HddOutlined />}
                                    valueStyle={{ fontSize: token.paddingLG }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Total Keys"
                                    value={metrics.total_keys || 0}
                                    prefix={<KeyOutlined />}
                                    valueStyle={{ fontSize: token.paddingLG }}
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Ops/sec"
                                    value={metrics.ops_per_sec || 0}
                                    prefix={<DashboardOutlined />}
                                    valueStyle={{ fontSize: token.paddingLG }}
                                />
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* Settings Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: '0 0 16px 0' }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Service Settings</Text>
                </Divider>

                <Card
                    loading={loadingSettings}
                    style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                    styles={{ body: { padding: token.paddingLG } }}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdateSettings}
                        initialValues={settings}
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Form.Item
                                    name="port"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Listen Port</Text>}
                                    help="Port number (default: 6379)"
                                >
                                    <Input placeholder="6379" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="bind"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Bind Address</Text>}
                                    help="IP address to bind to"
                                >
                                    <Input placeholder="0.0.0.0" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="maxmemory"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Max Memory</Text>}
                                    help="Maximum memory (e.g., 256mb, 1gb)"
                                >
                                    <Input placeholder="256mb" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="maxmemory_policy"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Eviction Policy</Text>}
                                    help="Key eviction policy"
                                >
                                    <Input placeholder="allkeys-lru" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="appendonly"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>AOF Persistence</Text>}
                                    help="Enable AOF (yes/no)"
                                >
                                    <Input placeholder="yes" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="appendfsync"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Append Fsync</Text>}
                                    help="Fsync policy (always/everysec/no)"
                                >
                                    <Input placeholder="everysec" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="config_path"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Config Path</Text>}
                                    help="Path to config file"
                                >
                                    <Input placeholder="/etc/valkey/valkey.conf" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="dir"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Working Directory</Text>}
                                    help="Path for RDB/AOF files"
                                >
                                    <Input placeholder="/var/lib/valkey" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={updatingSettings}
                            icon={<SettingOutlined />}
                            style={{ borderRadius: token.borderRadius }}
                        >
                            Save Settings
                        </Button>
                    </Form>
                </Card>

                {/* Keys Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Keys</Text>
                </Divider>

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Row gutter={16}>
                        <Col flex="auto">
                            <Input
                                placeholder="Key pattern (e.g., user:*)"
                                value={keyPattern}
                                onChange={(e) => setKeyPattern(e.target.value)}
                                onPressEnter={fetchData}
                                style={{ borderRadius: token.borderRadius }}
                            />
                        </Col>
                        <Col>
                            <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: token.borderRadius }}>Search</Button>
                        </Col>
                    </Row>
                </Card>

                <Table
                    columns={keyColumns}
                    dataSource={keys.map((k) => ({ ...k, key: k.key }))}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
                />

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="inline"
                        onFinish={handleCreateKey}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle" style={{ width: '100%' }}>
                            <Col flex="auto">
                                <Space wrap>
                                    <Form.Item name="key" label="Key" required>
                                        <Input placeholder="my:key" style={{ borderRadius: token.borderRadius }} />
                                    </Form.Item>
                                    <Form.Item name="value" label="Value" required>
                                        <Input placeholder="value" style={{ borderRadius: token.borderRadius }} />
                                    </Form.Item>
                                    <Form.Item name="ttl" label="TTL (seconds)">
                                        <Input type="number" placeholder="0" style={{ borderRadius: token.borderRadius, width: 100 }} />
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={creatingKey}
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: token.borderRadius }}
                                >
                                    Create Key
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                <Space style={{ marginTop: token.padding }}>
                    <Button danger onClick={handleFlushDB}>Flush Database</Button>
                </Space>

                {/* Users Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>ACL Users</Text>
                </Divider>

                <div style={{ display: 'flex', gap: token.paddingSM, flexWrap: 'wrap', marginBottom: token.marginSM }}>
                    {users.length === 0 ? (
                        <Text type="secondary" italic>No ACL users configured.</Text>
                    ) : (
                        users.map((u, i) => (
                            <Tag key={i} color="processing" style={{ borderRadius: token.paddingXXS, padding: `${token.paddingXXS}px ${token.paddingSM}px` }}>
                                <Space>
                                    <UserOutlined />
                                    <Text strong style={{ fontSize: token.fontSizeSM }}>{u}</Text>
                                    {u !== 'default' && (
                                        <Button
                                            size="small"
                                            danger
                                            type="text"
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleDeleteUser(u)}
                                        />
                                    )}
                                </Space>
                            </Tag>
                        ))
                    )}
                </div>

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="inline"
                        onFinish={handleCreateUser}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle" style={{ width: '100%' }}>
                            <Col flex="auto">
                                <Space wrap>
                                    <Form.Item name="username" label="Username" required>
                                        <Input placeholder="username" style={{ borderRadius: token.borderRadius }} />
                                    </Form.Item>
                                    <Form.Item name="password" label="Password" required>
                                        <Input.Password placeholder="••••••••" style={{ borderRadius: token.borderRadius }} />
                                    </Form.Item>
                                    <Form.Item name="role" label="Role" initialValue="read">
                                        <Select style={{ width: 100, borderRadius: token.borderRadius }}>
                                            <option value="read">Read</option>
                                            <option value="write">Write</option>
                                            <option value="admin">Admin</option>
                                        </Select>
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: token.borderRadius }}
                                >
                                    Create User
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card>

                {/* Connected Clients */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Connected Clients</Text>
                </Divider>

                <Table
                    columns={clientColumns}
                    dataSource={clients.map((c, i) => ({ ...c, key: i }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
                />

                {/* Key View Modal */}
                <Modal
                    title={<Space><KeyOutlined /> Key: <Text code>{viewingKey?.key}</Text></Space>}
                    open={!!viewingKey}
                    onCancel={() => setViewingKey(null)}
                    footer={null}
                    width={600}
                >
                    {viewingKey && (
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <div>
                                <Text strong>Type: </Text>
                                <Tag>{viewingKey.type}</Tag>
                            </div>
                            <div>
                                <Text strong>TTL: </Text>
                                <Text>{viewingKey.ttl === -1 ? 'No expiration' : `${viewingKey.ttl}s`}</Text>
                            </div>
                            {viewingKey.type === 'string' && viewingKey.value && (
                                <div>
                                    <Text strong>Value: </Text>
                                    <Text code>{viewingKey.value}</Text>
                                </div>
                            )}
                            {viewingKey.type === 'list' && viewingKey.members && (
                                <div>
                                    <Text strong>Members: </Text>
                                    <ul>
                                        {viewingKey.members.map((m, i) => <li key={i}>{m}</li>)}
                                    </ul>
                                </div>
                            )}
                            {viewingKey.type === 'hash' && viewingKey.fields && (
                                <div>
                                    <Text strong>Fields: </Text>
                                    <pre style={{ background: token.colorFillAlter, padding: token.paddingSM, borderRadius: token.borderRadius }}>
                                        {JSON.stringify(viewingKey.fields, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </Space>
                    )}
                </Modal>
            </Space>
        </div>
    );
}
