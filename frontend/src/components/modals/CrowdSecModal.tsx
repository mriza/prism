import { useState, useEffect, useCallback } from 'react';
import { 
    Modal, 
    Table, 
    Button, 
    Space, 
    Typography, 
    theme, 
    Form, 
    Input, 
    Select, 
    Badge, 
    Popconfirm,
    Divider,
    Alert,
    Row,
    Col
} from 'antd';
import { 
    SafetyOutlined, 
    PlusOutlined, 
    DeleteOutlined, 
    ReloadOutlined, 
    WarningOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface Decision {
    id: number;
    origin: string;
    scope: string;
    value: string;
    reason: string;
    type: string;
    duration: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
}

async function controlAgent(agentId: string, action: string, options?: Record<string, unknown>) {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, service: 'crowdsec', action, options }),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
}

export function CrowdSecModal({ isOpen, onClose, agentId }: Props) {
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState('');
    const { token } = theme.useToken();
    const [form] = Form.useForm();

    const fetchDecisions = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await controlAgent(agentId, 'crowdsec_list');
            if (data.success) {
                let parsed = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
                if (!Array.isArray(parsed)) parsed = [];
                setDecisions(parsed);
            } else {
                setError(data.message || 'Failed to fetch decisions');
            }
        } catch {
            setError('Could not connect to agent');
        }
        setLoading(false);
    }, [agentId]);

    useEffect(() => {
        if (isOpen) {
            fetchDecisions();
        }
    }, [isOpen, fetchDecisions]);

    const handleAdd = async (values: any) => {
        setActionLoading('add');
        setError('');
        try {
            await controlAgent(agentId, 'crowdsec_add', {
                ip: values.ip,
                duration: values.duration,
                reason: values.reason || 'manual via PRISM',
                type: values.type,
            });
            form.resetFields();
            await fetchDecisions();
        } catch (err: any) {
            setError(err.message || 'Failed to add CrowdSec decision');
        }
        setActionLoading('');
    };

    const handleDelete = async (id: number) => {
        setActionLoading(`del-${id}`);
        setError('');
        try {
            await controlAgent(agentId, 'crowdsec_delete', { id: String(id) });
            await fetchDecisions();
        } catch (err: any) {
            setError(err.message || 'Failed to delete CrowdSec decision');
        }
        setActionLoading('');
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 60,
            render: (id: number) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: token.paddingSM }}>{id}</Text>
        },
        {
            title: 'Origin',
            dataIndex: 'origin',
            key: 'origin',
            render: (origin: string) => <Text strong style={{ fontSize: token.paddingSM, textTransform: 'uppercase', opacity: 0.5 }}>{origin}</Text>
        },
        {
            title: 'IP / Target',
            dataIndex: 'value',
            key: 'value',
            render: (value: string) => <Text strong style={{ color: token.colorWarning, fontFamily: 'monospace' }}>{value}</Text>
        },
        {
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason',
            render: (reason: string) => <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{reason}</Text>,
            ellipsis: true
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => (
                <Badge 
                    status={type === 'ban' ? 'error' : 'warning'} 
                    text={<Text strong style={{ fontSize: token.paddingSM, textTransform: 'uppercase' }}>{type}</Text>} 
                />
            )
        },
        {
            title: 'TTL',
            dataIndex: 'duration',
            key: 'duration',
            render: (d: string) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM }}>{d}</Text>
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: Decision) => (
                <Popconfirm
                    title="Delete Decision"
                    description="Remove this ban/decision?"
                    onConfirm={() => handleDelete(record.id)}
                    okText="Yes"
                    cancelText="No"
                    okButtonProps={{ danger: true }}
                >
                    <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        loading={actionLoading === `del-${record.id}`}
                    />
                </Popconfirm>
            )
        }
    ];

    return (
        <Modal 
            open={isOpen} 
            onCancel={onClose} 
            title={
                <Space size="middle">
                    <div style={{ 
                        padding: token.borderRadiusSM, 
                        borderRadius: token.paddingSM, 
                        backgroundColor: `${token.colorWarning}15`, 
                        color: token.colorWarning,
                        display: 'flex'
                    }}>
                        <SafetyOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.borderRadius }}>CrowdSec Firewall</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.borderRadiusSM }}>
                            Managing active security decisions for node <Text code>{agentId}</Text>
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={900}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <div style={{ marginTop: token.paddingLG }}>
                {error && (
                    <Alert
                        message="Security Node Unreachable"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: token.paddingLG, borderRadius: token.borderRadiusSM }}
                    />
                )}

                <div style={{ marginBottom: token.paddingLG, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: token.borderRadiusSM, textTransform: 'uppercase', opacity: 0.5 }}>
                        {decisions.length} Active Decisions
                    </Text>
                    <Button 
                        icon={<ReloadOutlined spin={loading} />} 
                        onClick={fetchDecisions}
                        style={{ borderRadius: token.borderRadiusSM }}
                    >
                        Refresh
                    </Button>
                </div>

                {/* List Table */}
                <div style={{ 
                    borderRadius: token.borderRadius, 
                    overflow: 'hidden', 
                    border: `1px solid ${token.colorBorderSecondary}`,
                    marginBottom: token.marginLG
                }}>
                    <Table 
                        dataSource={decisions}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        loading={loading}
                        locale={{ emptyText: 'No active security decisions found.' }}
                        size="small"
                    />
                </div>

                {/* Add Form */}
                <Divider titlePlacement="left" style={{ margin: '0 0 24px 0' }}>
                    <Space>
                        <WarningOutlined style={{ color: token.colorWarning, fontSize: token.borderRadiusSM }} />
                        <Text strong style={{ fontSize: token.paddingSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Manual Decision (BAN)</Text>
                    </Space>
                </Divider>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleAdd}
                    initialValues={{ duration: '4h', type: 'ban' }}
                >
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="ip" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>IP / Range</Text>} rules={[{ required: true }]}>
                                <Input placeholder="e.g. 1.2.3.4" style={{ borderRadius: token.borderRadiusSM, fontFamily: 'monospace' }} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="duration" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>TTL</Text>} rules={[{ required: true }]}>
                                <Input placeholder="4h" style={{ borderRadius: token.borderRadiusSM }} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="type" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Action</Text>} rules={[{ required: true }]}>
                                <Select options={[{ value: 'ban', label: 'BAN' }, { value: 'captcha', label: 'CAPTCHA' }, { value: 'throttle', label: 'THROTTLE' }]} style={{ borderRadius: token.borderRadiusSM }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="reason" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Reason</Text>}>
                                <Input placeholder="e.g. repeated failed logins" style={{ borderRadius: token.borderRadiusSM }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Button 
                        type="primary"
                        htmlType="submit"
                        block
                        icon={<PlusOutlined />}
                        loading={actionLoading === 'add'}
                        style={{ height: 'auto', borderRadius: token.paddingSM, fontWeight: token.fontWeightStrong, backgroundColor: token.colorWarning, borderColor: 'transparent' }}
                    >
                        Apply Decision
                    </Button>
                </Form>
            </div>
        </Modal>
    );
}
