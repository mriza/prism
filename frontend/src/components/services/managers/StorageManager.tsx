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
                <Badge status="success" text={<Text style={{ fontSize: '12px' }}>Active</Text>} />
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
                <Badge status="success" text={<Text style={{ fontSize: '12px' }}>Active</Text>} />
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
        <div style={{ padding: '4px 0' }}>
            {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: '24px', borderRadius: '12px' }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header Info */}
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
                                    backgroundColor: `${token.colorPrimary}15`,
                                    color: token.colorPrimary,
                                    fontSize: '20px',
                                    display: 'flex'
                                }}>
                                    <HddOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '15px', display: 'block' }}>Object Storage Management</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Provision buckets and manage data lifecycle.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: '8px' }}>Refresh</Button>
                                <Button icon={<CloudServerOutlined />} style={{ borderRadius: '8px' }}>Storage Nodes</Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

                {/* Metrics */}
                {Object.keys(metrics).length > 0 && (
                    <Row gutter={16}>
                        <Col span={8}>
                            <Card style={{ borderRadius: '12px' }}>
                                <Statistic
                                    title="Total Buckets"
                                    value={buckets.length}
                                    prefix={<FolderOpenOutlined />}
                                    valueStyle={{ fontSize: '20px' }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card style={{ borderRadius: '12px' }}>
                                <Statistic
                                    title="Total Users"
                                    value={users.length}
                                    prefix={<UserOutlined />}
                                    valueStyle={{ fontSize: '20px' }}
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card style={{ borderRadius: '12px' }}>
                                <Statistic
                                    title="Total Objects"
                                    value={metrics.total_objects || 0}
                                    prefix={<DashboardOutlined />}
                                    valueStyle={{ fontSize: '20px' }}
                                />
                            </Card>
                        </Col>
                    </Row>
                )}

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
                            <Col span={16}>
                                <Form.Item
                                    name="endpoint"
                                    label={<Text strong style={{ fontSize: '12px' }}>API Endpoint</Text>}
                                    help="S3 API endpoint URL (e.g. http://localhost:9000)"
                                >
                                    <Input placeholder="http://localhost:9000" style={{ borderRadius: '8px', fontFamily: 'monospace' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="access_key"
                                    label={<Text strong style={{ fontSize: '12px' }}>Admin Access Key</Text>}
                                    help="Administrator access key"
                                >
                                    <Input placeholder="minioadmin" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item
                                    name="secret_key"
                                    label={<Text strong style={{ fontSize: '12px' }}>Admin Secret Key</Text>}
                                    help="Leave blank to keep current secret"
                                >
                                    <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
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

                {/* Buckets Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Active Buckets</Text>
                </Divider>

                <Table
                    columns={bucketColumns}
                    dataSource={dataSource}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: '12px',
                        overflow: 'hidden'
                    }}
                />

                <Card style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Row gutter={16}>
                        <Col flex="auto">
                            <Input
                                placeholder="Enter bucket name..."
                                prefix={<SearchOutlined style={{ opacity: 0.3 }} />}
                                style={{ borderRadius: '8px', height: '40px' }}
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
                                style={{ borderRadius: '8px', height: '40px', fontWeight: 600, padding: '0 24px' }}
                            >
                                Provision Bucket
                            </Button>
                        </Col>
                    </Row>
                </Card>

                {/* Users Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Storage Users</Text>
                </Divider>

                <Table
                    columns={userColumns}
                    dataSource={users.map((u, i) => ({ ...u, key: i }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: '12px',
                        overflow: 'hidden'
                    }}
                />

                <Card style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Form
                        layout="vertical"
                        onFinish={handleCreateUser}
                        style={{ width: '100%' }}
                    >
                        <Row gutter={16} align="middle">
                            <Col flex="auto">
                                <Space wrap style={{ width: '100%' }}>
                                    <Form.Item name="access_key" label="Access Key" required style={{ marginBottom: 0 }}>
                                        <Input placeholder="Enter access key" style={{ borderRadius: '8px', width: 200 }} />
                                    </Form.Item>
                                    <Form.Item name="secret_key" label="Secret Key" style={{ marginBottom: 0 }}>
                                        <Input.Password placeholder="Leave empty to auto-generate" style={{ borderRadius: '8px', width: 250 }} />
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: '8px', marginTop: '19px' }}
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
