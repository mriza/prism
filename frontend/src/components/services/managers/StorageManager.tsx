import { useState, useEffect } from 'react';
import {
    Button,
    Space,
    Typography,
    theme,
    Alert,
    Divider,
    Card,
    Input,
    Row,
    Col,
    Form,
    message,
    Table,
    Badge,
    Statistic
} from 'antd';
import {
    HddOutlined,
    PlusOutlined,
    DeleteOutlined,
    CloudServerOutlined,
    FolderOpenOutlined,
    SearchOutlined,
    ReloadOutlined,
    SettingOutlined,
    UserOutlined,
    KeyOutlined,
    DashboardOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface StorageManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
}

interface StorageUser {
    accessKey: string;
    secretKey?: string;
    status?: string;
}

export function StorageManager({ sendCommand }: StorageManagerProps) {
    const [buckets, setBuckets] = useState<string[]>([]);
    const [users, setUsers] = useState<StorageUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [form] = Form.useForm();
    const [metrics, setMetrics] = useState<Record<string, number>>({});
    const { token } = theme.useToken();

    useEffect(() => {
        fetchData();
        loadSettings();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const bucketRes = await sendCommand('storage_list_buckets');
            if (bucketRes?.success) {
                const list = typeof bucketRes.output === 'string' ? JSON.parse(bucketRes.output) : (bucketRes.output ?? []);
                setBuckets(Array.isArray(list) ? list : []);
            }

            const userRes = await sendCommand('storage_list_users');
            if (userRes?.success) {
                const userList = typeof userRes.output === 'string' ? JSON.parse(userRes.output) : (userRes.output ?? []);
                setUsers(Array.isArray(userList) ? userList : []);
            }

            const factsRes = await sendCommand('get_facts');
            if (factsRes?.success) {
                try {
                    const facts = typeof factsRes.output === 'string' ? JSON.parse(factsRes.output) : (factsRes.output ?? {});
                    if (facts && typeof facts === 'object') setMetrics(facts);
                } catch { /* ignore */ }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch storage data');
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        setLoadingSettings(true);
        try {
            const res = await sendCommand('service_get_settings');
            if (res?.success) {
                const data = typeof res.output === 'string' ? JSON.parse(res.output) : (res.output ?? {});
                setSettings(data);
                form.setFieldsValue(data);
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
            const res = await sendCommand('service_update_settings', values);
            if (res?.success) {
                message.success('Settings updated successfully');
                loadSettings();
            } else {
                message.error(res?.error || 'Failed to update settings');
            }
        } catch {
            message.error('Failed to update settings');
        } finally {
            setUpdatingSettings(false);
        }
    };

    const handleCreateBucket = async (bucketName: string) => {
        if (!bucketName) return;
        const res = await sendCommand('storage_create_bucket', { name: bucketName });
        if (res?.success) {
            message.success('Bucket created successfully');
            fetchData();
        } else {
            setError(res?.error || 'Failed to create bucket');
        }
    };

    const handleDeleteBucket = async (bucketName: string) => {
        const res = await sendCommand('storage_delete_bucket', { name: bucketName });
        if (res?.success) {
            message.success('Bucket deleted successfully');
            fetchData();
        } else {
            setError(res?.error || 'Failed to delete bucket');
        }
    };

    const handleCreateUser = async (values: any) => {
        const res = await sendCommand('storage_create_user', {
            access_key: values.access_key,
            secret_key: values.secret_key || ''
        });
        if (res?.success) {
            message.success('User created successfully');
            fetchData();
        }
    };

    const handleDeleteUser = async (accessKey: string) => {
        const res = await sendCommand('storage_delete_user', { access_key: accessKey });
        if (res?.success) {
            message.success('User deleted successfully');
            fetchData();
        }
    };

    const bucketColumns = [
        {
            title: 'Bucket Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => (
                <Space>
                    <FolderOpenOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>{name}</Text>
                </Space>
            )
        },
        {
            title: 'Status',
            key: 'status',
            render: () => (
                <Badge status="success" text={<Text style={{ fontSize: token.fontSizeSM }}>Active</Text>} />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: { name: string }) => (
                <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteBucket(record.name)}
                >
                    Delete
                </Button>
            )
        }
    ];

    const userColumns = [
        {
            title: 'Access Key',
            dataIndex: 'accessKey',
            key: 'accessKey',
            render: (key: string) => (
                <Space>
                    <KeyOutlined style={{ color: token.colorPrimary }} />
                    <Text code>{key}</Text>
                </Space>
            )
        },
        {
            title: 'Secret Key',
            key: 'secretKey',
            render: (_: any, record: StorageUser) => (
                <Text type="secondary">{record.secretKey ? '••••••••' : 'N/A'}</Text>
            )
        },
        {
            title: 'Status',
            key: 'status',
            render: () => (
                <Badge status="success" text={<Text style={{ fontSize: token.fontSizeSM }}>Active</Text>} />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: StorageUser) => (
                <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteUser(record.accessKey)}
                />
            )
        }
    ];

    const dataSource = buckets.map(b => ({ key: b, name: b }));

    return (
        <div style={{ padding: `${token.paddingXXS}px 0` }}>
            {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header Info */}
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
                                    backgroundColor: `${token.colorPrimary}15`,
                                    color: token.colorPrimary,
                                    fontSize: token.paddingLG,
                                    display: 'flex'
                                }}>
                                    <HddOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: token.fontSize, display: 'block' }}>Object Storage Management</Text>
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Provision buckets and manage data lifecycle.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: token.borderRadius }}>Refresh</Button>
                                <Button icon={<CloudServerOutlined />} style={{ borderRadius: token.borderRadius }}>Storage Nodes</Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

                {/* Metrics */}
                {Object.keys(metrics).length > 0 && (
                    <Row gutter={16}>
                        <Col span={8}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Total Buckets"
                                    value={buckets.length}
                                    prefix={<FolderOpenOutlined />}
                                    valueStyle={{ fontSize: token.paddingLG }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Total Users"
                                    value={users.length}
                                    prefix={<UserOutlined />}
                                    valueStyle={{ fontSize: token.paddingLG }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card style={{ borderRadius: token.borderRadiusLG }}>
                                <Statistic
                                    title="Total Objects"
                                    value={metrics.total_objects || 0}
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
                            <Col span={16}>
                                <Form.Item
                                    name="endpoint"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>API Endpoint</Text>}
                                    help="S3 API endpoint URL (e.g. http://localhost:9000)"
                                >
                                    <Input placeholder="http://localhost:9000" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="access_key"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Admin Access Key</Text>}
                                    help="Administrator access key"
                                >
                                    <Input placeholder="minioadmin" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item
                                    name="secret_key"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Admin Secret Key</Text>}
                                    help="Leave blank to keep current secret"
                                >
                                    <Input.Password placeholder="••••••••" style={{ borderRadius: token.borderRadius }} />
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

                {/* Buckets Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Active Buckets</Text>
                </Divider>

                <Table
                    columns={bucketColumns}
                    dataSource={dataSource}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusLG,
                        overflow: 'hidden'
                    }}
                />

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Row gutter={16}>
                        <Col flex="auto">
                            <Input
                                placeholder="Enter bucket name..."
                                prefix={<SearchOutlined style={{ opacity: 0.3 }} />}
                                style={{ borderRadius: token.borderRadius, height: token.paddingLG }}
                                id="new-bucket-name"
                            />
                        </Col>
                        <Col>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    const input = document.getElementById('new-bucket-name') as HTMLInputElement;
                                    handleCreateBucket(input.value);
                                }}
                                style={{ borderRadius: token.borderRadius, height: token.paddingLG, fontWeight: 600, padding: '0 24px' }}
                            >
                                Provision Bucket
                            </Button>
                        </Col>
                    </Row>
                </Card>

                {/* Users Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Storage Users</Text>
                </Divider>

                <Table
                    columns={userColumns}
                    dataSource={users.map((u, i) => ({ ...u, key: i }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusLG,
                        overflow: 'hidden'
                    }}
                />

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="vertical"
                        onFinish={handleCreateUser}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle">
                            <Col flex="auto">
                                <Space wrap style={{ width: '100%' }}>
                                    <Form.Item name="access_key" label="Access Key" required style={{ marginBottom: 0 }}>
                                        <Input placeholder="Enter access key" style={{ borderRadius: token.borderRadius, width: 200 }} />
                                    </Form.Item>
                                    <Form.Item name="secret_key" label="Secret Key" style={{ marginBottom: 0 }}>
                                        <Input.Password placeholder="Leave empty to auto-generate" style={{ borderRadius: token.borderRadius, width: 250 }} />
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: token.borderRadius, marginTop: `${token.marginSM}px` }}
                                >
                                    Create User
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card>
            </Space>
        </div>
    );
}
