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
    Badge
} from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    ReloadOutlined,
    SettingOutlined,
    WifiOutlined,
    UserOutlined,
    CloudServerOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface MQTTManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
}

export function MQTTManager({ sendCommand }: MQTTManagerProps) {
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
            const userRes = await sendCommand('mqtt_list_users');
            if (userRes?.success) {
                setUsers(typeof userRes.message === 'string' ? JSON.parse(userRes.message) : userRes.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch MQTT data');
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
        setCreatingUser(true);
        try {
            const res = await sendCommand('mqtt_create_user', {
                username: values.username,
                password: values.password
            });
            if (res?.success) {
                message.success('User created successfully');
                fetchData();
                form.resetFields(['username', 'password']);
            }
        } finally {
            setCreatingUser(false);
        }
    };

    const handleDeleteUser = async (username: string) => {
        const res = await sendCommand('mqtt_delete_user', { username });
        if (res?.success) {
            message.success('User deleted successfully');
            fetchData();
        }
    };

    const userColumns = [
        {
            title: 'Username',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => (
                <Space>
                    <UserOutlined style={{ color: token.colorPrimary }} />
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
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteUser(record.name)}
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
                                    backgroundColor: `${token.colorInfo}15`,
                                    color: token.colorInfo,
                                    fontSize: '20px',
                                    display: 'flex'
                                }}>
                                    <WifiOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '15px', display: 'block' }}>MQTT Broker Configuration</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Manage MQTT users and broker settings.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: '8px' }}>Refresh</Button>
                                <Button icon={<CloudServerOutlined />} style={{ borderRadius: '8px' }}>Broker Logs</Button>
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
                            <Col span={8}>
                                <Form.Item
                                    name="port"
                                    label={<Text strong style={{ fontSize: '12px' }}>MQTT Port</Text>}
                                    help="Port for MQTT connections (default: 1883)"
                                >
                                    <Input placeholder="1883" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="persistence"
                                    label={<Text strong style={{ fontSize: '12px' }}>Persistence</Text>}
                                    help="Enable message persistence (true/false)"
                                >
                                    <Input placeholder="true" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="persistence_location"
                                    label={<Text strong style={{ fontSize: '12px' }}>Persistence Path</Text>}
                                    help="Path to store persistent messages"
                                >
                                    <Input placeholder="/var/lib/mosquitto/" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="config_path"
                                    label={<Text strong style={{ fontSize: '12px' }}>Config Path</Text>}
                                    help="Path to mosquitto.conf file"
                                >
                                    <Input placeholder="/etc/mosquitto/mosquitto.conf" style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="log_path"
                                    label={<Text strong style={{ fontSize: '12px' }}>Log Path</Text>}
                                    help="Path to log file"
                                >
                                    <Input placeholder="/var/log/mosquitto/mosquitto.log" style={{ borderRadius: '8px' }} />
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
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>MQTT Users</Text>
                </Divider>

                <Table
                    columns={userColumns}
                    dataSource={users.map((u, i) => ({ key: i, name: u }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '12px', overflow: 'hidden' }}
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
                                    <Form.Item name="username" label="Username" required style={{ marginBottom: 0 }}>
                                        <Input placeholder="Enter username" style={{ borderRadius: '8px', width: 200 }} />
                                    </Form.Item>
                                    <Form.Item name="password" label="Password" required style={{ marginBottom: 0 }}>
                                        <Input.Password placeholder="Enter password" style={{ borderRadius: '8px', width: 200 }} />
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={creatingUser}
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
