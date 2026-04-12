/**
 * WebhooksPage - Webhook Management UI
 * 
 * Features:
 * - List all configured webhooks
 * - Create/edit/delete webhooks
 * - View delivery statistics
 * - Test webhook endpoint
 * - View recent deliveries
 */

import { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Space,
    Modal,
    Form,
    Input,
    Tag,
    Typography,
    Alert,
    Tooltip,
    Badge,
    message,
    Popconfirm,
    Select,
    Switch
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ReloadOutlined,
    LinkOutlined
} from '@ant-design/icons';
import { PageContainer, ContentCard, StatCard } from '../components/PageContainer';
import { useAuth } from '../contexts/AuthContext';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ============================================
// Types
// ============================================

interface Webhook {
    id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    contentType: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

interface WebhookStats {
    total: number;
    success: number;
    failed: number;
    pending: number;
    successRate: number;
}

interface WebhookDelivery {
    id: string;
    webhookId: string;
    event: string;
    status: 'pending' | 'success' | 'failed' | 'processing';
    statusCode?: number;
    attempts: number;
    lastError?: string;
    deliveredAt?: string;
    createdAt: string;
}

const EVENT_OPTIONS = [
    { value: '*', label: 'All Events' },
    { value: 'agent.connected', label: 'Agent Connected' },
    { value: 'agent.disconnected', label: 'Agent Disconnected' },
    { value: 'agent.approved', label: 'Agent Approved' },
    { value: 'agent.deleted', label: 'Agent Deleted' },
    { value: 'event.service_start', label: 'Service Started' },
    { value: 'event.service_stop', label: 'Service Stopped' },
    { value: 'event.service_restart', label: 'Service Restarted' },
    { value: 'event.config_change', label: 'Configuration Changed' },
    { value: 'event.security_alert', label: 'Security Alert' }
];

const apiBase = import.meta.env.VITE_API_URL || '';

// ============================================
// WebhooksPage Component
// ============================================

export function WebhooksPage() {
    const { token } = useAuth();
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [stats, setStats] = useState<WebhookStats>({ total: 0, success: 0, failed: 0, pending: 0, successRate: 0 });
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
    const [deliveriesOpen, setDeliveriesOpen] = useState(false);
    const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
    const [form] = Form.useForm();
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        fetchWebhooks();
        fetchStats();
    }, []);

    const fetchWebhooks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/webhooks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setWebhooks(data);
            }
        } catch (err) {
            message.error('Failed to fetch webhooks');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${apiBase}/api/webhooks/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            // Stats endpoint may not exist yet, use defaults
            setStats({ total: 0, success: 0, failed: 0, pending: 0, successRate: 0 });
        }
    };

    const handleSave = async (values: any) => {
        try {
            const payload = {
                name: values.name,
                url: values.url,
                secret: values.secret,
                events: values.events || ['*'],
                contentType: 'application/json',
                active: values.active ?? true
            };

            const method = editingWebhook ? 'PUT' : 'POST';
            const url = editingWebhook ? `${apiBase}/api/webhooks/${editingWebhook.id}` : `${apiBase}/api/webhooks`;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(editingWebhook ? 'Webhook updated' : 'Webhook created');
                setModalOpen(false);
                form.resetFields();
                setEditingWebhook(null);
                fetchWebhooks();
            } else {
                const error = await res.text();
                message.error(error || 'Failed to save webhook');
            }
        } catch (err) {
            message.error('Failed to save webhook');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`${apiBase}/api/webhooks/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                message.success('Webhook deleted');
                fetchWebhooks();
            }
        } catch (err) {
            message.error('Failed to delete webhook');
        }
    };

    const handleTest = async (url: string, secret: string) => {
        setTesting(true);
        try {
            const res = await fetch(`${apiBase}/api/webhooks/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url, secret })
            });
            const data = await res.json();
            if (data.success) {
                message.success('Webhook test successful!');
            } else {
                message.error(`Test failed: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            message.error('Failed to test webhook');
        } finally {
            setTesting(false);
        }
    };

    const fetchDeliveries = async (webhookId: string) => {
        try {
            const res = await fetch(`${apiBase}/api/webhooks/${webhookId}/deliveries`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDeliveries(data);
            }
        } catch (err) {
            message.error('Failed to fetch deliveries');
        }
    };

    const openDeliveries = (webhook: Webhook) => {
        setSelectedWebhook(webhook);
        setDeliveriesOpen(true);
        fetchDeliveries(webhook.id);
    };

    // ============================================
    // Table Columns
    // ============================================

    const columns: ColumnsType<Webhook> = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: Webhook) => (
                <Space>
                    <ThunderboltOutlined style={{ color: record.active ? '#52c41a' : '#8c8c8c' }} />
                    <Text strong>{name}</Text>
                </Space>
            )
        },
        {
            title: 'URL',
            dataIndex: 'url',
            key: 'url',
            ellipsis: true,
            render: (url: string) => (
                <Tooltip title={url}>
                    <Text code style={{ fontSize: 12 }}>{url}</Text>
                </Tooltip>
            )
        },
        {
            title: 'Events',
            dataIndex: 'events',
            key: 'events',
            render: (events: string[]) => (
                <Space wrap>
                    {events.slice(0, 3).map(event => (
                        <Tag key={event} color={event === '*' ? 'blue' : 'default'}>
                            {event === '*' ? 'All' : event}
                        </Tag>
                    ))}
                    {events.length > 3 && <Tag>+{events.length - 3}</Tag>}
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'active',
            key: 'active',
            render: (active: boolean) => (
                <Badge
                    status={active ? 'success' : 'default'}
                    text={active ? 'Active' : 'Inactive'}
                />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_: any, record: Webhook) => (
                <Space>
                    <Tooltip title="View Deliveries">
                        <Button
                            type="text"
                            icon={<LinkOutlined />}
                            onClick={() => openDeliveries(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Test Endpoint">
                        <Button
                            type="text"
                            icon={<ReloadOutlined />}
                            loading={testing}
                            onClick={() => handleTest(record.url, record.secret)}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setEditingWebhook(record);
                                form.setFieldsValue({
                                    ...record,
                                    events: record.events
                                });
                                setModalOpen(true);
                            }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Delete Webhook"
                        description="Are you sure you want to delete this webhook?"
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <PageContainer
            title="Webhooks"
            description="Manage webhook endpoints for event notifications. Webhooks allow external services to receive real-time updates from PRISM."
            extra={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                        setEditingWebhook(null);
                        form.resetFields();
                        setModalOpen(true);
                    }}
                >
                    New Webhook
                </Button>
            }
        >
            {/* Stats Cards */}
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Space style={{ width: '100%', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <StatCard
                            icon={<ThunderboltOutlined />}
                            title="Total Webhooks"
                            value={webhooks.length}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <StatCard
                            icon={<CheckCircleOutlined />}
                            title="Successful Deliveries"
                            value={stats.success}
                            trend="up"
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <StatCard
                            icon={<CloseCircleOutlined />}
                            title="Failed Deliveries"
                            value={stats.failed}
                            trend={stats.failed > 0 ? 'down' : 'stable'}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <StatCard
                            icon={<ReloadOutlined />}
                            title="Success Rate"
                            value={stats.successRate.toFixed(1)}
                            suffix="%"
                            trend={stats.successRate > 90 ? 'up' : 'down'}
                        />
                    </div>
                </Space>

                {/* Webhooks Table */}
                <ContentCard
                    title="Configured Webhooks"
                    extra={
                        <Button
                            type="text"
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchWebhooks();
                                fetchStats();
                            }}
                        >
                            Refresh
                        </Button>
                    }
                >
                    <Alert
                        message="Webhook Events"
                        description="Webhooks are automatically triggered for agent connections, disconnections, and audit events. Each delivery is tracked with retry logic (max 5 attempts)."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <Table
                        columns={columns}
                        dataSource={webhooks}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                </ContentCard>
            </Space>

            {/* Create/Edit Modal */}
            <Modal
                title={editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
                open={modalOpen}
                onCancel={() => {
                    setModalOpen(false);
                    form.resetFields();
                    setEditingWebhook(null);
                }}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{ active: true, events: ['*'] }}
                >
                    <Form.Item
                        name="name"
                        label="Webhook Name"
                        rules={[{ required: true, message: 'Please enter a name' }]}
                    >
                        <Input placeholder="e.g., Slack Notifications" />
                    </Form.Item>

                    <Form.Item
                        name="url"
                        label="Webhook URL"
                        rules={[
                            { required: true, message: 'Please enter a URL' },
                            { type: 'url', message: 'Please enter a valid URL' }
                        ]}
                    >
                        <Input placeholder="https://hooks.example.com/webhook" />
                    </Form.Item>

                    <Form.Item
                        name="secret"
                        label="Signing Secret (Optional)"
                        extra="Used to sign webhook payloads with HMAC-SHA256"
                    >
                        <Input.Password placeholder="Enter secret for payload verification" />
                    </Form.Item>

                    <Form.Item
                        name="events"
                        label="Subscribed Events"
                        rules={[{ required: true, message: 'Please select at least one event' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select events to subscribe to"
                            options={EVENT_OPTIONS}
                        />
                    </Form.Item>

                    <Form.Item
                        name="active"
                        label="Status"
                        valuePropName="checked"
                    >
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                {editingWebhook ? 'Update' : 'Create'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Deliveries Modal */}
            <Modal
                title={`Deliveries: ${selectedWebhook?.name || ''}`}
                open={deliveriesOpen}
                onCancel={() => setDeliveriesOpen(false)}
                footer={null}
                width={900}
            >
                <Table
                    dataSource={deliveries}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    columns={[
                        {
                            title: 'Event',
                            dataIndex: 'event',
                            key: 'event',
                            render: (event: string) => <Tag>{event}</Tag>
                        },
                        {
                            title: 'Status',
                            dataIndex: 'status',
                            key: 'status',
                            render: (status: string) => (
                                <Badge
                                    status={
                                        status === 'success' ? 'success' :
                                        status === 'failed' ? 'error' :
                                        status === 'processing' ? 'processing' : 'default'
                                    }
                                    text={status.charAt(0).toUpperCase() + status.slice(1)}
                                />
                            )
                        },
                        {
                            title: 'Attempts',
                            dataIndex: 'attempts',
                            key: 'attempts',
                            render: (attempts: number) => <Text>{attempts}/5</Text>
                        },
                        {
                            title: 'Last Error',
                            dataIndex: 'lastError',
                            key: 'lastError',
                            ellipsis: true,
                            render: (error?: string) => error ? (
                                <Tooltip title={error}>
                                    <Text type="danger" style={{ fontSize: 12 }}>{error.substring(0, 50)}...</Text>
                                </Tooltip>
                            ) : '-'
                        },
                        {
                            title: 'Created',
                            dataIndex: 'createdAt',
                            key: 'createdAt',
                            render: (date: string) => new Date(date).toLocaleString()
                        }
                    ]}
                />
            </Modal>
        </PageContainer>
    );
}
