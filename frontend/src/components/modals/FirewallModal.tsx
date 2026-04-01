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
    Dropdown,
    Row,
    Col
} from 'antd';
import { 
    SafetyCertificateOutlined, 
    PlusOutlined, 
    DeleteOutlined, 
    ReloadOutlined, 
    SafetyOutlined, 
    StopOutlined, 
    DownOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface FirewallRule {
    id: string;
    description: string;
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
        body: JSON.stringify({ agent_id: agentId, service: 'ufw', action, options }),
    });
    return res.json();
}

export function FirewallModal({ isOpen, onClose, agentId }: Props) {
    const [rules, setRules] = useState<FirewallRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState('');
    const { token } = theme.useToken();
    const [form] = Form.useForm();

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await controlAgent(agentId, 'ufw_list');
            if (data.success) {
                const parsed = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
                setRules(parsed || []);
            } else {
                setError(data.message || 'Failed to fetch rules');
            }
        } catch {
            setError('Could not connect to agent');
        }
        setLoading(false);
    }, [agentId]);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                fetchRules();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isOpen, fetchRules]);

    const handleAdd = async (values: any) => {
        setActionLoading('add');
        await controlAgent(agentId, 'ufw_add', {
            port: parseFloat(values.port),
            protocol: values.protocol,
            action: values.action,
        });
        form.resetFields();
        await fetchRules();
        setActionLoading('');
    };

    const handleDelete = async (ruleId: string) => {
        setActionLoading(`del-${ruleId}`);
        await controlAgent(agentId, 'ufw_delete', { rule_id: ruleId });
        await fetchRules();
        setActionLoading('');
    };

    const handleDefaultPolicy = async (policy: string) => {
        setActionLoading(`default-${policy}`);
        await controlAgent(agentId, 'ufw_default', { policy, direction: 'incoming' });
        await fetchRules();
        setActionLoading('');
    };

    const parseRule = (desc: string) => {
        const parts = desc.split(/\s{2,}/);
        return {
            to: parts[0]?.trim() || '',
            action: parts[1]?.trim() || '',
            from: parts[2]?.trim() || '',
        };
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 60,
            render: (id: string) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: token.paddingSM }}>{id}</Text>
        },
        {
            title: 'Destination',
            key: 'to',
            render: (_: any, record: FirewallRule) => {
                const parsed = parseRule(record.description);
                return <Text strong style={{ fontFamily: 'monospace' }}>{parsed.to}</Text>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, record: FirewallRule) => {
                const parsed = parseRule(record.description);
                const isAllow = parsed.action.includes('ALLOW');
                const isDeny = parsed.action.includes('DENY') || parsed.action.includes('REJECT');
                
                let status: 'success' | 'error' | 'warning' = 'warning';
                if (isAllow) status = 'success';
                if (isDeny) status = 'error';

                return <Badge status={status} text={<Text strong style={{ fontSize: token.paddingSM, textTransform: 'uppercase' }}>{parsed.action}</Text>} />;
            }
        },
        {
            title: 'Source / From',
            key: 'from',
            render: (_: any, record: FirewallRule) => {
                const parsed = parseRule(record.description);
                return <Text type="secondary" style={{ fontSize: token.borderRadiusSM }}>{parsed.from}</Text>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: FirewallRule) => (
                <Popconfirm
                    title="Delete Rule"
                    description="Are you sure you want to delete this firewall rule?"
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
                        backgroundColor: `${token.colorSuccess}15`, 
                        color: token.colorSuccess,
                        display: 'flex'
                    }}>
                        <SafetyCertificateOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.borderRadius }}>Firewall Configuration</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.borderRadiusSM }}>
                            Managing inbound traffic rules for node <Text code>{agentId}</Text>
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={800}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <div style={{ marginTop: token.paddingLG }}>
                {error && (
                    <Alert
                        message="Connection Error"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: token.paddingLG, borderRadius: token.borderRadiusSM }}
                    />
                )}

                <div style={{ marginBottom: token.paddingLG, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: token.borderRadiusSM, textTransform: 'uppercase', opacity: 0.5 }}>
                        {rules.length} Active Rules
                    </Text>
                    <Space>
                        <Button 
                            icon={<ReloadOutlined spin={loading} />} 
                            onClick={fetchRules}
                            style={{ borderRadius: token.borderRadiusSM }}
                        >
                            Refresh
                        </Button>
                        <Dropdown
                            menu={{
                                items: [
                                    { key: 'allow', label: 'Allow All Incoming', icon: <SafetyOutlined />, onClick: () => handleDefaultPolicy('allow') },
                                    { key: 'deny', label: 'Deny All Incoming', icon: <StopOutlined />, danger: true, onClick: () => handleDefaultPolicy('deny') }
                                ]
                            }}
                        >
                            <Button style={{ borderRadius: token.borderRadiusSM }}>
                                Default Policy <DownOutlined />
                            </Button>
                        </Dropdown>
                    </Space>
                </div>

                {/* List Table */}
                <div style={{ 
                    borderRadius: token.borderRadius, 
                    overflow: 'hidden', 
                    border: `1px solid ${token.colorBorderSecondary}`,
                    marginBottom: '32px'
                }}>
                    <Table 
                        dataSource={rules}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        loading={loading}
                        locale={{ emptyText: 'No firewall rules discovered.' }}
                        size="small"
                    />
                </div>

                {/* Add Form */}
                <Divider titlePlacement="left" style={{ margin: '0 0 24px 0' }}>
                    <Space>
                        <PlusOutlined style={{ color: token.colorPrimary, fontSize: token.borderRadiusSM }} />
                        <Text strong style={{ fontSize: token.paddingSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Create Inbound Rule</Text>
                    </Space>
                </Divider>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleAdd}
                    initialValues={{ protocol: 'tcp', action: 'allow' }}
                >
                    <Row gutter={16} align="bottom">
                        <Col span={6}>
                            <Form.Item name="port" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Port</Text>} rules={[{ required: true }]}>
                                <Input placeholder="8080" style={{ borderRadius: token.borderRadiusSM }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="protocol" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Protocol</Text>} rules={[{ required: true }]}>
                                <Select options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} style={{ borderRadius: token.borderRadiusSM }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="action" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Action</Text>} rules={[{ required: true }]}>
                                <Select options={[{ value: 'allow', label: 'Allow' }, { value: 'deny', label: 'Deny' }, { value: 'reject', label: 'Reject' }]} style={{ borderRadius: token.borderRadiusSM }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item>
                                <Button 
                                    type="primary" 
                                    htmlType="submit" 
                                    block 
                                    icon={<PlusOutlined />}
                                    loading={actionLoading === 'add'}
                                    style={{ height: 'auto', borderRadius: token.paddingSM, fontWeight: 600 }}
                                >
                                    Add Rule
                                </Button>
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </div>
        </Modal>
    );
}
