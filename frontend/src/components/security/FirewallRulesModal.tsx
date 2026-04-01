import { useState, useEffect } from 'react';
import { 
    Modal, 
    Table, 
    Button, 
    Form, 
    Input, 
    Select, 
    Space, 
    Tag, 
    Typography, 
    theme, 
    Alert, 
    Popconfirm
} from 'antd';
import { 
    DeleteOutlined, 
    PlusOutlined, 
    SafetyCertificateOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;

interface FirewallRule {
    ID: string;
    Action: string;       // "ALLOW", "DENY"
    ToPorts: string;      // "80/tcp", "any"
    FromIP: string;       // "Anywhere", "192.168.1.0/24"
    Direction: string;    // "IN", "OUT"
    Description: string;
}

interface FirewallRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
    activeFirewallName: string; // 'ufw', 'firewalld', 'iptables', 'nftables'
}

export function FirewallRulesModal({ isOpen, onClose, agentId, agentName, activeFirewallName }: FirewallRulesModalProps) {
    const [rules, setRules] = useState<FirewallRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { token } = useAuth();
    const { token: themeToken } = theme.useToken();
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && agentId) {
            fetchRules();
        } else {
            setRules([]);
            setError('');
            form.resetFields();
        }
    }, [isOpen, agentId]);

    const fetchRules = async () => {
        setLoading(true);
        setError('');
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: activeFirewallName,
                    action: 'firewall_list'
                })
            });

            if (!res.ok) throw new Error('Failed to fetch rules');
            const data = await res.json();
            
            if (data.success !== undefined && data.success === false) {
                throw new Error(data.message || 'Error executing firewall_list');
            }

            if (data.message && data.message !== "OK") {
                const parsedRules = JSON.parse(data.message);
                setRules(parsedRules || []);
            } else {
                setRules([]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to communicate with agent');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRule = async (values: any) => {
        setSubmitting(true);
        setError('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: activeFirewallName,
                    action: 'firewall_add',
                    options: {
                        port: parseInt(values.port, 10),
                        protocol: values.protocol,
                        action: values.action
                    }
                })
            });

            if (!res.ok) throw new Error('Failed to add rule');
            const data = await res.json();
            if (data.success === false) {
                 throw new Error(data.message || 'Error executing firewall_add');
            }

            form.resetFields();
            await fetchRules();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add rule');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        setLoading(true);
        setError('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: activeFirewallName,
                    action: 'firewall_delete',
                    options: {
                        rule_id: ruleId
                    }
                })
            });

            if (!res.ok) throw new Error('Failed to delete rule');
            const data = await res.json();
            if (data.success === false) {
                 throw new Error(data.message || 'Error executing firewall_delete');
            }

            await fetchRules();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to delete rule');
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'ID',
            key: 'ID',
            render: (text: string) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: themeToken.fontSizeSM }}>{text || '-'}</Text>
        },
        {
            title: 'Action',
            dataIndex: 'Action',
            key: 'Action',
            render: (action: string) => (
                <Tag color={action.toUpperCase().includes('ALLOW') ? 'success' : 'error'} style={{ fontWeight: 800 }}>
                    {action.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'To Ports',
            dataIndex: 'ToPorts',
            key: 'ToPorts',
            render: (text: string) => <Text strong style={{ fontFamily: 'monospace' }}>{text}</Text>
        },
        {
            title: 'From',
            dataIndex: 'FromIP',
            key: 'FromIP',
            render: (text: string) => <Text type="secondary" style={{ fontFamily: 'monospace' }}>{text}</Text>
        },
        {
            title: 'Controls',
            key: 'controls',
            align: 'right' as const,
            render: (_: any, record: FirewallRule) => (
                <Popconfirm
                    title="Delete Rule"
                    description="Are you sure you want to delete this firewall rule?"
                    onConfirm={() => handleDeleteRule(record.ID)}
                    okText="Yes"
                    cancelText="No"
                    okButtonProps={{ danger: true }}
                >
                    <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        disabled={loading}
                    />
                </Popconfirm>
            )
        }
    ];

    return (
        <Modal
            title={<Space><SafetyCertificateOutlined /> <Text strong>Firewall Rules Management</Text></Space>}
            open={isOpen}
            onCancel={onClose}
            width={850}
            footer={null}
            styles={{ body: { padding: '24px 0 0 0' } }}
            style={{ borderRadius: themeToken.paddingLG, overflow: 'hidden' }}
        >
            <div style={{ padding: '0 24px 24px 24px' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: themeToken.marginLG }}>
                    Managing <Text strong style={{ color: themeToken.colorPrimary, textTransform: 'uppercase' }}>{activeFirewallName}</Text> on server <Text strong>{agentName}</Text>
                </Text>

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: themeToken.marginLG, borderRadius: themeToken.borderRadiusLG }}
                    />
                )}

                <div style={{ backgroundColor: themeToken.colorFillAlter, padding: themeToken.paddingLG, borderRadius: themeToken.padding, marginBottom: themeToken.marginLG }}>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleAddRule}
                        initialValues={{ action: 'allow', protocol: 'tcp' }}
                    >
                        <Space align="end" size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Form.Item name="action" label={<Text strong style={{ fontSize: themeToken.fontSizeSM, textTransform: 'uppercase' }}>Action</Text>} style={{ marginBottom: 0 }}>
                                <Select style={{ width: 120 }}>
                                    <Select.Option value="allow">ALLOW</Select.Option>
                                    <Select.Option value="deny">DENY</Select.Option>
                                </Select>
                            </Form.Item>
                            
                            <Form.Item 
                                name="port" 
                                label={<Text strong style={{ fontSize: themeToken.fontSizeSM, textTransform: 'uppercase' }}>Port</Text>} 
                                rules={[{ required: true, message: 'Required' }]}
                                style={{ marginBottom: 0, flex: 1 }}
                            >
                                <Input placeholder="8080" style={{ fontFamily: 'monospace' }} />
                            </Form.Item>

                            <Form.Item name="protocol" label={<Text strong style={{ fontSize: themeToken.fontSizeSM, textTransform: 'uppercase' }}>Protocol</Text>} style={{ marginBottom: 0 }}>
                                <Select style={{ width: 100 }}>
                                    <Select.Option value="tcp">TCP</Select.Option>
                                    <Select.Option value="udp">UDP</Select.Option>
                                </Select>
                            </Form.Item>

                            <Form.Item style={{ marginBottom: 0 }}>
                                <Button 
                                    type="primary" 
                                    htmlType="submit" 
                                    icon={<PlusOutlined />} 
                                    loading={submitting}
                                    style={{ height: themeToken.marginLG, fontWeight: 600 }}
                                >
                                    Add Rule
                                </Button>
                            </Form.Item>
                        </Space>
                    </Form>
                </div>

                <div style={{ border: `1px solid ${themeToken.colorBorderSecondary}`, borderRadius: themeToken.borderRadiusLG, overflow: 'hidden' }}>
                    <Table
                        columns={columns}
                        dataSource={rules}
                        loading={loading}
                        rowKey={(record, index) => record.ID || index || 0}
                        pagination={{ pageSize: 5, hideOnSinglePage: true }}
                    />
                </div>
            </div>
        </Modal>
    );
}
