import { useState, useEffect } from 'react';
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
    message
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer } from '../components/PageContainer';

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
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (resourceTypeFilter !== 'all') {
                params.append('resourceType', resourceTypeFilter);
            }
            const res = await fetch(`${apiBase}/api/permissions?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPermissions(data);
            }
        } catch (err) {
            message.error('Failed to fetch permissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, [resourceTypeFilter]);

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
            render: () => (
                <Space size="small">
                    <Button type="text" size="small" icon={<EditOutlined />} />
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
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
                <Space wrap style={{ marginBottom: 16, justifyContent: 'space-between' }}>
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

            {/* Create Permission Modal */}
            <Modal
                title="Create Permission"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
            >
                <Form
                    onFinish={(values) => {
                        console.log('Create permission:', values);
                        message.success('Permission created (demo)');
                        setIsModalOpen(false);
                    }}
                    layout="vertical"
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
