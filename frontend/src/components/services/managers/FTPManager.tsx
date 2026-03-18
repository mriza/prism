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
    Switch
} from 'antd';
import {
    CloudServerOutlined,
    PlusOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SettingOutlined,
    UserOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface FTPManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
}

export function FTPManager({ sendCommand }: FTPManagerProps) {
    const [users, setUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [form] = Form.useForm();
    const [creatingUser, setCreatingUser] = useState(false);
    const { token } = theme.useToken();

    useEffect(() => {
        fetchData();
        loadSettings();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await sendCommand('ftp_list_users');
            if (res?.success) {
                const parsed = typeof res.output === 'string' ? JSON.parse(res.output) : (res.output ?? []);
                setUsers(Array.isArray(parsed) ? parsed : []);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch FTP users');
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

    const handleCreateUser = async (values: any) => {
        setCreatingUser(true);
        try {
            const res = await sendCommand('ftp_create_user', {
                username: values.username,
                password: values.password,
                root_path: values.root_path || '',
                quota: values.quota ? parseInt(values.quota) : 0,
                quota_enabled: values.quota_enabled || false
            });
            if (res?.success) {
                message.success('User created successfully');
                fetchData();
                form.resetFields(['username', 'password', 'root_path', 'quota', 'quota_enabled']);
            } else {
                message.error(res?.error || 'Failed to create user');
            }
        } finally {
            setCreatingUser(false);
        }
    };

    const handleDeleteUser = async (username: string) => {
        const res = await sendCommand('ftp_delete_user', { username });
        if (res?.success) {
            message.success('User deleted');
            fetchData();
        } else {
            message.error(res?.error || 'Failed to delete user');
        }
    };

    const userColumns = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
            render: (username: string) => (
                <Space>
                    <UserOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>{username}</Text>
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
            render: (_: any, record: { username: string }) => (
                <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteUser(record.username)}
                />
            )
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
                                    <CloudServerOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '15px', display: 'block' }}>FTP Server Management</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Manage FTP users and server configuration.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: '8px' }}>Refresh</Button>
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
                            <Col span={8}>
                                <Form.Item
                                    name="port"
                                    label={<Text strong style={{ fontSize: '12px' }}>FTP Port</Text>}
                                    help="Port for FTP connections (default: 21)"
                                >
                                    <Input placeholder="21" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="local_root"
                                    label={<Text strong style={{ fontSize: '12px' }}>Default Root Path</Text>}
                                    help="Default FTP root directory"
                                >
                                    <Input placeholder="/var/ftp" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="anonymous_enable"
                                    label={<Text strong style={{ fontSize: '12px' }}>Anonymous Login</Text>}
                                    help="Allow anonymous FTP login (YES/NO)"
                                >
                                    <Input placeholder="NO" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="local_enable"
                                    label={<Text strong style={{ fontSize: '12px' }}>Local Users</Text>}
                                    help="Allow local users to login (YES/NO)"
                                >
                                    <Input placeholder="YES" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="write_enable"
                                    label={<Text strong style={{ fontSize: '12px' }}>Write Access</Text>}
                                    help="Allow write operations (YES/NO)"
                                >
                                    <Input placeholder="YES" style={{ borderRadius: '8px' }} />
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

                {/* Users Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>FTP Users</Text>
                </Divider>

                <Table
                    columns={userColumns}
                    dataSource={users.map((u, i) => ({ key: i, username: u }))}
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
                        <Row gutter={16}>
                            <Col span={24}>
                                <Text strong style={{ display: 'block', marginBottom: '12px' }}>Create New FTP User</Text>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="username" label="Username" required>
                                    <Input placeholder="Enter username" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="password" label="Password" required>
                                    <Input.Password placeholder="Enter password" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="root_path" label="Root Path">
                                    <Input placeholder="/var/ftp/virtual_users/username" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={4}>
                                <Form.Item name="quota" label="Quota (MB)">
                                    <Input type="number" placeholder="0 = unlimited" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={2}>
                                <Form.Item name="quota_enabled" label="Quota" valuePropName="checked">
                                    <Switch style={{ marginTop: '6px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={creatingUser}
                                    icon={<PlusOutlined />}
                                    style={{ borderRadius: '8px' }}
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
