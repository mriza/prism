import { useState } from 'react';
import {
    Table,
    Card,
    Typography,
    Space,
    Tag,
    Button,
    Input,
    Select,
    Modal,
    Form,
    message, theme
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer } from '../components/PageContainer';
import { usePermissions } from '../hooks/usePermissions';

const { Text } = Typography;

interface Permission {
    id: string;
    name: string;
    description: string;
    resourceType: string;
    action: string;
    createdAt: string;
}

export function RBACPage() {
    const { permissions, loading, fetchPermissions, createPermission, updatePermission, deletePermission } = usePermissions();
    const [searchText, setSearchText] = useState('');
    const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
    const [form] = Form.useForm();
    const { token } = theme.useToken();

    const filteredPermissions = permissions.filter(p =>
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.description.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns: ColumnsType<Permission> = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <Text code>{name}</Text>
        },
        {
            title: 'Resource Type',
            dataIndex: 'resourceType',
            key: 'resourceType',
            render: (type: string) => (
                <Tag color="blue">{type.toUpperCase()}</Tag>
            )
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            render: (action: string) => (
                <Tag color={action === '*' ? 'red' : 'green'}>{action}</Tag>
            )
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingPermission(record);
                            form.setFieldsValue(record);
                            setIsModalOpen(true);
                        }}
                    />
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={async () => {
                            if (confirm(`Delete permission "${record.name}"?`)) {
                                await deletePermission(record.id);
                                message.success('Permission deleted');
                            }
                        }}
                    />
                </Space>
            )
        }
    ];

    return (
        <PageContainer
            title="RBAC Permissions"
            description="Manage granular permissions for role-based access control"
            extra={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalOpen(true)}
                >
                    New Permission
                </Button>
            }
        >
            <Card>
                <Space wrap style={{ marginBottom: token.marginSM, justifyContent: 'space-between' }}>
                    <Space wrap>
                        <Input
                            placeholder="Search permissions..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 300 }}
                            allowClear
                        />
                        <Select
                            value={resourceTypeFilter}
                            onChange={setResourceTypeFilter}
                            style={{ width: 200 }}
                            options={[
                                { value: 'all', label: 'All Resource Types' },
                                { value: 'server', label: 'Server' },
                                { value: 'service', label: 'Service' },
                                { value: 'account', label: 'Account' },
                                { value: 'project', label: 'Project' },
                                { value: 'user', label: 'User' }
                            ]}
                        />
                    </Space>
                </Space>

                <Table
                    columns={columns}
                    dataSource={filteredPermissions}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} permissions`
                    }}
                />
            </Card>

            {/* Create/Edit Permission Modal */}
            <Modal
                title={editingPermission ? 'Edit Permission' : 'Create Permission'}
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    setEditingPermission(null);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={form}
                    onFinish={async (values) => {
                        try {
                            if (editingPermission) {
                                await updatePermission(editingPermission.id, {
                                    name: values.name,
                                    resourceType: values.resourceType,
                                    action: values.action,
                                    description: values.description || ''
                                });
                                message.success('Permission updated successfully');
                            } else {
                                await createPermission({
                                    name: values.name,
                                    resourceType: values.resourceType,
                                    action: values.action,
                                    description: values.description || ''
                                });
                                message.success('Permission created successfully');
                            }
                            setIsModalOpen(false);
                            setEditingPermission(null);
                            form.resetFields();
                            fetchPermissions(resourceTypeFilter === 'all' ? undefined : resourceTypeFilter);
                        } catch (err: any) {
                            message.error(`Failed to ${editingPermission ? 'update' : 'create'} permission: ${err.message}`);
                        }
                    }}
                    layout="vertical"
                    autoComplete="off"
                >
                    <Form.Item
                        name="name"
                        label="Permission Name"
                        rules={[{ required: true, message: 'Please enter permission name' }]}
                    >
                        <Input placeholder="e.g., server.read" />
                    </Form.Item>
                    <Form.Item
                        name="resourceType"
                        label="Resource Type"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="server">Server</Select.Option>
                            <Select.Option value="service">Service</Select.Option>
                            <Select.Option value="account">Account</Select.Option>
                            <Select.Option value="project">Project</Select.Option>
                            <Select.Option value="user">User</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="action"
                        label="Action"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="read">Read</Select.Option>
                            <Select.Option value="write">Write</Select.Option>
                            <Select.Option value="delete">Delete</Select.Option>
                            <Select.Option value="control">Control</Select.Option>
                            <Select.Option value="*">All (*)</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={3} placeholder="Permission description" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            Create Permission
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
}

export default RBACPage;
