/**
 * RolesPage - Role Management UI for Advanced RBAC
 * 
 * Features:
 * - List all roles (system + custom)
 * - Create/edit/delete custom roles
 * - Permission matrix editor
 * - View users assigned to each role
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
    Checkbox,
    message,
    Popconfirm,
    Divider
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SafetyOutlined,
    LockOutlined,
    TeamOutlined
} from '@ant-design/icons';
import { PageContainer, ContentCard } from '../components/PageContainer';
import { useAuth } from '../contexts/AuthContext';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ============================================
// Types
// ============================================

interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

const RESOURCE_TYPES = [
    { key: 'servers', label: 'Servers' },
    { key: 'agents', label: 'Agents' },
    { key: 'projects', label: 'Projects' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'users', label: 'Users' },
    { key: 'settings', label: 'Settings' },
    { key: 'webhooks', label: 'Webhooks' }
];

const ACTIONS = [
    { key: 'read', label: 'Read', color: 'blue' },
    { key: 'create', label: 'Create', color: 'green' },
    { key: 'update', label: 'Update', color: 'orange' },
    { key: 'delete', label: 'Delete', color: 'red' },
    { key: 'manage', label: 'Manage', color: 'purple' }
];

const apiBase = import.meta.env.VITE_API_URL || '';

// ============================================
// RolesPage Component
// ============================================

export function RolesPage() {
    const { token } = useAuth();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [form] = Form.useForm();
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/roles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRoles(data);
            }
        } catch (err) {
            message.error('Failed to fetch roles');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        try {
            const payload = {
                name: values.name,
                description: values.description,
                permissions: selectedPermissions
            };

            const method = editingRole ? 'PUT' : 'POST';
            const url = editingRole ? `${apiBase}/api/roles/${editingRole.id}` : `${apiBase}/api/roles`;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(editingRole ? 'Role updated' : 'Role created');
                setModalOpen(false);
                form.resetFields();
                setEditingRole(null);
                setSelectedPermissions([]);
                fetchRoles();
            } else {
                const error = await res.text();
                message.error(error || 'Failed to save role');
            }
        } catch (err) {
            message.error('Failed to save role');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`${apiBase}/api/roles/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                message.success('Role deleted');
                fetchRoles();
            } else {
                const error = await res.text();
                message.error(error || 'Failed to delete role');
            }
        } catch (err) {
            message.error('Failed to delete role');
        }
    };

    const togglePermission = (resource: string, action: string) => {
        const permission = `${resource}:${action}`;
        const wildcard = `${resource}:*`;
        
        setSelectedPermissions(prev => {
            const hasWildcard = prev.includes(wildcard);
            
            if (action === 'manage') {
                // Toggle all permissions for this resource
                const resourcePerms = prev.filter(p => !p.startsWith(`${resource}:`));
                if (hasWildcard) return resourcePerms;
                return [...resourcePerms, wildcard];
            }
            
            const hasPermission = prev.includes(permission);
            const withoutThis = prev.filter(p => p !== permission && p !== wildcard);
            
            if (hasPermission) return withoutThis;
            return [...withoutThis, permission];
        });
    };

    const hasPermission = (resource: string, action: string): boolean => {
        const permission = `${resource}:${action}`;
        const wildcard = `${resource}:*`;
        return selectedPermissions.includes(permission) || selectedPermissions.includes(wildcard);
    };

    const hasWildcardForResource = (resource: string): boolean => {
        return selectedPermissions.includes(`${resource}:*`);
    };

    // ============================================
    // Table Columns
    // ============================================

    const columns: ColumnsType<Role> = [
        {
            title: 'Role',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: Role) => (
                <Space>
                    {record.isSystem ? (
                        <LockOutlined style={{ color: '#faad14' }} />
                    ) : (
                        <SafetyOutlined style={{ color: '#52c41a' }} />
                    )}
                    <div>
                        <Text strong>{name}</Text>
                        {record.description && (
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
                            </div>
                        )}
                    </div>
                </Space>
            )
        },
        {
            title: 'Type',
            key: 'type',
            render: (_: any, record: Role) => (
                <Badge
                    status={record.isSystem ? 'warning' : 'success'}
                    text={record.isSystem ? 'System' : 'Custom'}
                />
            )
        },
        {
            title: 'Permissions',
            key: 'permissions',
            render: (_: any, record: Role) => (
                <Space wrap>
                    {record.permissions.slice(0, 5).map(perm => (
                        <Tag key={perm} color="blue">
                            {perm === '*' ? 'All' : perm}
                        </Tag>
                    ))}
                    {record.permissions.length > 5 && (
                        <Tooltip title={record.permissions.join(', ')}>
                            <Tag>+{record.permissions.length - 5}</Tag>
                        </Tooltip>
                    )}
                </Space>
            )
        },
        {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_: any, record: Role) => (
                <Space>
                    {!record.isSystem && (
                        <>
                            <Tooltip title="Edit">
                                <Button
                                    type="text"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                        setEditingRole(record);
                                        form.setFieldsValue(record);
                                        setSelectedPermissions(record.permissions);
                                        setModalOpen(true);
                                    }}
                                />
                            </Tooltip>
                            <Popconfirm
                                title="Delete Role"
                                description="Are you sure you want to delete this role?"
                                onConfirm={() => handleDelete(record.id)}
                            >
                                <Tooltip title="Delete">
                                    <Button type="text" danger icon={<DeleteOutlined />} />
                                </Tooltip>
                            </Popconfirm>
                        </>
                    )}
                    {record.isSystem && (
                        <Tooltip title="System roles cannot be modified">
                            <Text type="secondary" style={{ fontSize: 12 }}>Read Only</Text>
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ];

    return (
        <PageContainer
            title="Roles & Permissions"
            description="Manage custom roles and define granular permission matrices for your team members."
            extra={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                        setEditingRole(null);
                        form.resetFields();
                        setSelectedPermissions([]);
                        setModalOpen(true);
                    }}
                >
                    New Role
                </Button>
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                    message="Advanced RBAC"
                    description="System roles (admin, manager, user, auditor) provide baseline permissions. Create custom roles with specific permissions for fine-grained access control."
                    type="info"
                    showIcon
                />

                <ContentCard
                    title="Role Directory"
                    extra={
                        <Button
                            type="text"
                            icon={<TeamOutlined />}
                            onClick={fetchRoles}
                        >
                            Refresh
                        </Button>
                    }
                >
                    <Table
                        columns={columns}
                        dataSource={roles}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                </ContentCard>
            </Space>

            {/* Create/Edit Role Modal */}
            <Modal
                title={editingRole ? 'Edit Role' : 'Create Role'}
                open={modalOpen}
                onCancel={() => {
                    setModalOpen(false);
                    form.resetFields();
                    setEditingRole(null);
                    setSelectedPermissions([]);
                }}
                footer={null}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                >
                    <Form.Item
                        name="name"
                        label="Role Name"
                        rules={[{ required: true, message: 'Please enter a role name' }]}
                    >
                        <Input placeholder="e.g., Security Auditor" />
                    </Form.Item>

                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} placeholder="Describe what this role is for" />
                    </Form.Item>

                    <Divider>Permission Matrix</Divider>

                    <Table
                        dataSource={RESOURCE_TYPES}
                        rowKey="key"
                        pagination={false}
                        size="small"
                        columns={[
                            {
                                title: 'Resource',
                                key: 'resource',
                                render: (_: any, record: typeof RESOURCE_TYPES[0]) => (
                                    <Space>
                                        <LockOutlined />
                                        <Text strong>{record.label}</Text>
                                        {hasWildcardForResource(record.key) && (
                                            <Tag color="blue">Full Access</Tag>
                                        )}
                                    </Space>
                                )
                            },
                            ...ACTIONS.map(action => ({
                                title: action.label,
                                key: action.key,
                                render: (_: any, record: typeof RESOURCE_TYPES[0]) => (
                                    <Checkbox
                                        checked={hasPermission(record.key, action.key)}
                                        onChange={() => togglePermission(record.key, action.key)}
                                    />
                                )
                            }))
                        ]}
                    />

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
                        <Space>
                            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                {editingRole ? 'Update' : 'Create'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </PageContainer>
    );
}
