import { useState, useEffect } from 'react';
import { log } from '../../../utils/log';
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
            log.error('Failed to load settings', err); message.error('Failed to load settings');
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
        } catch {
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
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteUser(record.name)}
                />
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
                                    backgroundColor: `${token.colorInfo}15`,
                                    color: token.colorInfo,
                                    fontSize: token.paddingLG,
                                    display: 'flex'
                                }}>
                                    <WifiOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: token.fontSize, display: 'block' }}>MQTT Broker Configuration</Text>
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Manage MQTT users and broker settings.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: token.borderRadius }}>Refresh</Button>
                                <Button icon={<CloudServerOutlined />} style={{ borderRadius: token.borderRadius }}>Broker Logs</Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>

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
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>MQTT Port</Text>}
                                    help="Port for MQTT connections (default: 1883)"
                                >
                                    <Input placeholder="1883" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="persistence"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Persistence</Text>}
                                    help="Enable message persistence (true/false)"
                                >
                                    <Input placeholder="true" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="persistence_location"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Persistence Path</Text>}
                                    help="Path to store persistent messages"
                                >
                                    <Input placeholder="/var/lib/mosquitto/" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="config_path"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Config Path</Text>}
                                    help="Path to mosquitto.conf file"
                                >
                                    <Input placeholder="/etc/mosquitto/mosquitto.conf" style={{ borderRadius: token.borderRadius }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="log_path"
                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Log Path</Text>}
                                    help="Path to log file"
                                >
                                    <Input placeholder="/var/log/mosquitto/mosquitto.log" style={{ borderRadius: token.borderRadius }} />
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

                {/* Users Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>MQTT Users</Text>
                </Divider>

                <Table
                    columns={userColumns}
                    dataSource={users.map((u, i) => ({ key: i, name: u }))}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
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
                                    <Form.Item name="username" label="Username" required style={{ marginBottom: 0 }}>
                                        <Input placeholder="Enter username" style={{ borderRadius: token.borderRadius, width: 200 }} />
                                    </Form.Item>
                                    <Form.Item name="password" label="Password" required style={{ marginBottom: 0 }}>
                                        <Input.Password placeholder="Enter password" style={{ borderRadius: token.borderRadius, width: 200 }} />
                                    </Form.Item>
                                </Space>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={creatingUser}
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
