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
    Table,
    Input,
    Row,
    Col,
    Tag,
    Badge,
    Form,
    message
} from 'antd';
import {
    GlobalOutlined,
    PlusOutlined,
    DeleteOutlined,
    LinkOutlined,
    ReloadOutlined,
    SettingOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface WebServerManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
    serviceName: string;
}

export function WebServerManager({ sendCommand, serviceName }: WebServerManagerProps) {
    const [sites, setSites] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const [proxyPort, setProxyPort] = useState('');
    const [form] = Form.useForm();
    const { token } = theme.useToken();

    const isNginx = serviceName === 'nginx' || serviceName === 'web-nginx';

    useEffect(() => {
        fetchSites();
        if (isNginx) loadSettings();
    }, []);

    const fetchSites = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await sendCommand('web_list_sites');
            if (data?.success) {
                const list = typeof data.output === 'string' ? JSON.parse(data.output) : (data.output ?? []);
                setSites(Array.isArray(list) ? list : []);
            } else {
                setError(data?.error || 'Failed to list sites');
            }
        } catch (err: any) {
            setError(err.message || 'Connection failed');
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
            log.error('Failed to load settings', err); message.error('Failed to load settings');
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleUpdateSettings = async (values: any) => {
        setUpdatingSettings(true);
        try {
            const res = await sendCommand('service_update_settings', values);
            if (res?.success) {
                message.success('Settings saved and nginx reloaded');
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

    const handleCreateProxy = async (domain: string, port: string) => {
        if (!domain || !port) {
            setError('Domain and port are required');
            return;
        }
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            setError('Invalid port number');
            return;
        }
        setActionLoading('create');
        try {
            const data = await sendCommand('proxy_create', { domain, port: portNum });
            if (data?.success) {
                fetchSites();
                setProxyPort('');
            } else {
                setError(data?.error || 'Failed to create proxy');
            }
        } catch (err: any) {
            setError(err.message || 'Command failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteSite = async (name: string) => {
        setActionLoading(`delete-${name}`);
        try {
            const data = await sendCommand('web_delete_site', { name });
            if (data?.success) {
                fetchSites();
            } else {
                setError(data?.error || 'Failed to delete site');
            }
        } catch (err: any) {
            setError(err.message || 'Command failed');
        } finally {
            setActionLoading(null);
        }
    };

    const columns = [
        {
            title: 'Virtual Host / Site',
            key: 'site',
            render: (_: any, record: { name: string }) => {
                const site = record.name;
                const parts = site.match(/^(.+) \((.+)\)$/);
                const name = parts ? parts[1] : site;
                const status = parts ? parts[2] : 'unknown';
                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{name}</Text>
                        <Tag style={{ borderRadius: token.paddingXXS, border: 'none', fontSize: token.fontSizeSM, backgroundColor: token.colorFillAlter }}>
                            {status}
                        </Tag>
                    </Space>
                );
            }
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, record: { name: string }) => {
                const isDown = record.name.includes('offline') || record.name.includes('down');
                return <Badge status={isDown ? 'error' : 'success'} text={isDown ? 'Halt' : 'Active'} />;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: { name: string }) => {
                const siteName = record.name.split(' ')[0];
                return (
                    <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteSite(siteName)}
                        loading={actionLoading === `delete-${siteName}`}
                    >
                        Delete
                    </Button>
                );
            }
        }
    ];

    const dataSource = sites.map((s, i) => ({ key: i, name: s }));

    return (
        <div style={{ padding: `${token.paddingXXS}px 0` }}>
            {error && (
                <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
                                    <GlobalOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: token.fontSize, display: 'block' }}>Gateway Management ({serviceName})</Text>
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Configure reverse proxy entries and virtual hosts.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchSites} style={{ borderRadius: token.borderRadius }}>Refresh State</Button>
                        </Col>
                    </Row>
                </Card>

                {/* Nginx-specific settings — Caddy handles these automatically */}
                {isNginx && (
                    <>
                        <Divider titlePlacement="left" orientationMargin={0} style={{ margin: '0 0 16px 0' }}>
                            <Space>
                                <SettingOutlined style={{ opacity: 0.5 }} />
                                <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Default Site Configuration</Text>
                            </Space>
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
                                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>HTTP Port</Text>}
                                            help="Port for HTTP connections (default: 80)"
                                        >
                                            <Input placeholder="80" style={{ borderRadius: token.borderRadius }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={16}>
                                        <Form.Item
                                            name="docroot"
                                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Document Root</Text>}
                                            help="Path to website files directory"
                                        >
                                            <Input placeholder="/var/www/html" style={{ borderRadius: token.borderRadius, fontFamily: token.fontFamilyCode }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            name="ssl_cert"
                                            label={<Space><SafetyCertificateOutlined /><Text strong style={{ fontSize: token.fontSizeSM }}>SSL Certificate Path</Text></Space>}
                                            help="Path to TLS/SSL certificate file (.crt or .pem)"
                                        >
                                            <Input placeholder="/etc/ssl/certs/server.crt" style={{ borderRadius: token.borderRadius, fontFamily: token.fontFamilyCode }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            name="ssl_key"
                                            label={<Space><SafetyCertificateOutlined /><Text strong style={{ fontSize: token.fontSizeSM }}>SSL Key Path</Text></Space>}
                                            help="Path to TLS/SSL private key file"
                                        >
                                            <Input placeholder="/etc/ssl/private/server.key" style={{ borderRadius: token.borderRadius, fontFamily: token.fontFamilyCode }} />
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
                                    Save & Reload Nginx
                                </Button>
                            </Form>
                        </Card>
                    </>
                )}

                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: '0 0 16px 0' }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Active Virtual Hosts</Text>
                </Divider>

                <Table
                    columns={columns}
                    dataSource={dataSource}
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
                />

                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Add Reverse Proxy</Text>
                </Divider>

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Row gutter={12}>
                        <Col flex="auto">
                            <Input
                                placeholder="Domain (e.g. app.example.com)"
                                prefix={<LinkOutlined style={{ opacity: 0.3 }} />}
                                style={{ borderRadius: token.borderRadius, height: token.paddingLG }}
                                id="new-site-domain"
                            />
                        </Col>
                        <Col style={{ width: '100%' }}>
                            <Input
                                placeholder="Upstream port"
                                type="number"
                                min={1}
                                max={65535}
                                value={proxyPort}
                                onChange={(e) => setProxyPort(e.target.value)}
                                style={{ borderRadius: token.borderRadius, height: token.paddingLG }}
                            />
                        </Col>
                        <Col>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                loading={actionLoading === 'create'}
                                onClick={() => {
                                    const input = document.getElementById('new-site-domain') as HTMLInputElement;
                                    handleCreateProxy(input.value, proxyPort);
                                }}
                                style={{ borderRadius: token.borderRadius, height: token.paddingLG, fontWeight: token.fontWeightStrong, padding: '0 24px' }}
                            >
                                Provision Route
                            </Button>
                        </Col>
                    </Row>
                </Card>
            </Space>
        </div>
    );
}
