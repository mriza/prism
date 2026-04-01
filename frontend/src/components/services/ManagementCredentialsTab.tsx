import { useState, useEffect } from 'react';
import {
    Table,
    Tag,
    Space,
    Button,
    Tooltip,
    Typography,
    Empty,
    Alert,
    Card,
    theme,
    Badge,
    Modal,
    Form,
    Input,
    Select,
    message,
    Spin
} from 'antd';
import {
    EyeOutlined,
    EyeInvisibleOutlined,
    EditOutlined,
    SafetyCertificateOutlined,
    LockOutlined,
    DeleteOutlined,
    PlusOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useManagementCredentials, type ManagementCredential } from '../../hooks/useManagementCredentials';

const { Text } = Typography;
const { Option } = Select;

interface ManagementCredentialsTabProps {
    agentId: string;
    serviceId: string;
    serviceName: string;
    serviceType: string;
}

export function ManagementCredentialsTab(props: ManagementCredentialsTabProps) {
    const { serviceId } = props;
    const { token } = theme.useToken();
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCredential, setEditingCredential] = useState<ManagementCredential | null>(null);
    const [form] = Form.useForm();
    
    // Action loading states
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const {
        credentials,
        loading,
        fetchCredentials,
        createCredential,
        updateCredential,
        deleteCredential,
        verifyCredential
    } = useManagementCredentials();

    useEffect(() => {
        if (serviceId) {
            fetchCredentials(serviceId);
        }
    }, [serviceId, fetchCredentials]);

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAdd = () => {
        setEditingCredential(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const handleEdit = (record: ManagementCredential) => {
        setEditingCredential(record);
        form.resetFields();
        form.setFieldsValue({
            credentialType: record.credentialType,
            // We can't set password currently because it's masked/encrypted
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Delete Management Credential',
            content: 'Are you sure you want to delete this credential? This action cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                const success = await deleteCredential(id);
                if (success) {
                    message.success('Credential deleted successfully');
                } else {
                    message.error('Failed to delete credential');
                }
            }
        });
    };

    const handleVerify = async (id: string) => {
        setVerifyingId(id);
        const success = await verifyCredential(id, props.agentId, props.serviceName);
        if (success) {
            message.success('Connection verified successfully');
        } else {
            message.error('Failed to verify connection');
        }
        setVerifyingId(null);
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const payload = {
                serviceId,
                credentialType: values.credentialType,
                usernameEncrypted: values.username,
                passwordEncrypted: values.password,
                connectionParamsEncrypted: values.connectionParams || ''
            };

            if (editingCredential) {
                // If update, we might not send username/password if they are empty
                const updatePayload: Partial<ManagementCredential> = {
                    credentialType: values.credentialType
                };
                if (values.username) updatePayload.usernameEncrypted = values.username;
                if (values.password) updatePayload.passwordEncrypted = values.password;
                if (values.connectionParams) updatePayload.connectionParamsEncrypted = values.connectionParams;

                await updateCredential(editingCredential.id, updatePayload);
                message.success('Credential updated successfully');
            } else {
                await createCredential(payload);
                message.success('Credential created successfully');
            }
            setIsModalOpen(false);
            form.resetFields();
        } catch (error: any) {
            message.error(error.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const columns: ColumnsType<ManagementCredential> = [
        {
            title: 'Type',
            dataIndex: 'credentialType',
            key: 'type',
            width: 120,
            render: (type: string) => (
                <Tag color={type === 'root' ? 'red' : type === 'admin' ? 'orange' : 'blue'}>
                    <LockOutlined /> {type.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Username',
            dataIndex: 'usernameMasked',
            key: 'username',
            width: 150,
            render: (username: string, record: ManagementCredential) => (
                <Space>
                    <Text code>{showPasswords[record.id] ? '(Hidden)' : username}</Text>
                    <Tooltip title={showPasswords[record.id] ? 'Hide' : 'Show'}>
                        <Button
                            type="text"
                            size="small"
                            icon={showPasswords[record.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            onClick={() => togglePassword(record.id)}
                            disabled
                        />
                    </Tooltip>
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => (
                <Badge
                    status={status === 'active' ? 'success' : status === 'inactive' ? 'default' : 'error'}
                    text={status.toUpperCase()}
                />
            )
        },
        {
            title: 'Last Verified',
            dataIndex: 'lastVerifiedAt',
            key: 'lastVerifiedAt',
            width: 180,
            render: (date?: string) => date ? new Date(date).toLocaleString() : 'Never'
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_: any, record: ManagementCredential) => (
                <Space size="small">
                    <Tooltip title="Verify Connection">
                        <Button
                            type="text"
                            size="small"
                            icon={<SafetyCertificateOutlined />}
                            loading={verifyingId === record.id}
                            onClick={() => handleVerify(record.id)}
                            style={{ color: token.colorSuccess }}
                        />
                    </Tooltip>
                    <Tooltip title="Edit Credential">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Delete Credential">
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record.id)}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    if (loading && credentials.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: `${token.paddingXL}px` }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}><Text type="secondary">Loading credentials...</Text></div>
            </div>
        );
    }

    return (
        <div style={{ padding: `${token.paddingSM}px 0` }}>
            <Alert
                message={
                    <Space>
                        <LockOutlined />
                        <Text strong>Management Credentials</Text>
                    </Space>
                }
                description="These are service-level root/admin accounts used by PRISM Agent to manage the service. They are encrypted at rest using AES-256-GCM."
                type="warning"
                showIcon
                style={{ marginBottom: 16, borderRadius: 8 }}
                action={
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
                        Add Credential
                    </Button>
                }
            />

            {credentials.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No management credentials configured"
                />
            ) : (
                <Card style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }} styles={{ body: { padding: 0 } }}>
                    <Table
                        columns={columns}
                        dataSource={credentials}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                    />
                </Card>
            )}

            <Modal
                title={editingCredential ? "Edit Management Credential" : "Add Management Credential"}
                open={isModalOpen}
                onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ credentialType: 'admin' }}
                >
                    <Form.Item
                        name="credentialType"
                        label="Credential Type"
                        rules={[{ required: true, message: 'Please select credential type' }]}
                    >
                        <Select>
                            <Option value="root">Root (Full System Access)</Option>
                            <Option value="admin">Admin (Service Administrator)</Option>
                            <Option value="default">Default</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[{ required: !editingCredential, message: 'Please input username' }]}
                        help={editingCredential ? "Leave blank to keep existing username" : ""}
                    >
                        <Input placeholder="e.g. root, postgres, admin" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[{ required: !editingCredential, message: 'Please input password' }]}
                        help={editingCredential ? "Leave blank to keep existing password" : ""}
                    >
                        <Input.Password placeholder="••••••••" />
                    </Form.Item>

                    <Form.Item
                        name="connectionParams"
                        label="Connection Parameters (Optional)"
                        help="Additional parameters like connection string, port overrides, or options"
                    >
                        <Input.TextArea placeholder={'e.g. ?sslmode=disable or { "authSource": "admin" }'} rows={3} />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={submitting}>
                                {editingCredential ? 'Update' : 'Create'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
