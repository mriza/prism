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
    const res = await fetch(`/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, service: 'crowdsec', action, options }),
    });
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
        await controlAgent(agentId, 'crowdsec_add', {
            ip: values.ip,
            duration: values.duration,
            reason: values.reason || 'manual via PRISM',
            type: values.type,
        });
        form.resetFields();
        await fetchDecisions();
        setActionLoading('');
    };

    const handleDelete = async (id: number) => {
        setActionLoading(`del-${id}`);
        await controlAgent(agentId, 'crowdsec_delete', { id: String(id) });
        await fetchDecisions();
        setActionLoading('');
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 60,
            render: (id: number) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: '10px' }}>{id}</Text>
        },
        {
            title: 'Origin',
            dataIndex: 'origin',
            key: 'origin',
            render: (origin: string) => <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5 }}>{origin}</Text>
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
            render: (reason: string) => <Text type="secondary" style={{ fontSize: '11px' }}>{reason}</Text>,
            ellipsis: true
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => (
                <Badge 
                    status={type === 'ban' ? 'error' : 'warning'} 
                    text={<Text strong style={{ fontSize: '10px', textTransform: 'uppercase' }}>{type}</Text>} 
                />
            )
        },
        {
            title: 'TTL',
            dataIndex: 'duration',
            key: 'duration',
            render: (d: string) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{d}</Text>
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
                        padding: '8px', 
                        borderRadius: '10px', 
                        backgroundColor: `${token.colorWarning}15`, 
                        color: token.colorWarning,
                        display: 'flex'
                    }}>
                        <SafetyOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>CrowdSec Firewall</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            Managing active security decisions for node <Text code>{agentId}</Text>
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={900}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            <div style={{ marginTop: '24px' }}>
                {error && (
                    <Alert
                        message="Security Node Unreachable"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: '24px', borderRadius: '12px' }}
                    />
                )}

                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.5 }}>
                        {decisions.length} Active Decisions
                    </Text>
                    <Button 
                        icon={<ReloadOutlined spin={loading} />} 
                        onClick={fetchDecisions}
                        style={{ borderRadius: '8px' }}
                    >
                        Refresh
                    </Button>
                </div>

                {/* List Table */}
                <div style={{ 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: `1px solid ${token.colorBorderSecondary}`,
                    marginBottom: '32px'
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
                <Divider orientation={"left" as any} style={{ margin: '0 0 24px 0' }}>
                    <Space>
                        <WarningOutlined style={{ color: token.colorWarning, fontSize: '12px' }} />
                        <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Manual Decision (BAN)</Text>
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
                            <Form.Item name="ip" label={<Text strong style={{ fontSize: '12px' }}>IP / Range</Text>} rules={[{ required: true }]}>
                                <Input placeholder="e.g. 1.2.3.4" style={{ borderRadius: '8px', fontFamily: 'monospace' }} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="duration" label={<Text strong style={{ fontSize: '12px' }}>TTL</Text>} rules={[{ required: true }]}>
                                <Input placeholder="4h" style={{ borderRadius: '8px' }} />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="type" label={<Text strong style={{ fontSize: '12px' }}>Action</Text>} rules={[{ required: true }]}>
                                <Select options={[{ value: 'ban', label: 'BAN' }, { value: 'captcha', label: 'CAPTCHA' }, { value: 'throttle', label: 'THROTTLE' }]} style={{ borderRadius: '8px' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="reason" label={<Text strong style={{ fontSize: '12px' }}>Reason</Text>}>
                                <Input placeholder="e.g. repeated failed logins" style={{ borderRadius: '8px' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        block 
                        icon={<PlusOutlined />}
                        loading={actionLoading === 'add'}
                        style={{ height: '40px', borderRadius: '10px', fontWeight: 600, backgroundColor: token.colorWarning, borderColor: 'transparent' }}
                    >
                        Apply Decision
                    </Button>
                </Form>
            </div>
        </Modal>
    );
}
