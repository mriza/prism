import { useState } from 'react';
import {
    Table,
    Tag,
    Space,
    Button,
    Tooltip,
    Typography,
    Empty,
    Card,
    theme,
    Badge,
    Input,
    Select,
    Popconfirm,
    Alert
} from 'antd';
import {
    UserOutlined,
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    SearchOutlined,
    ProjectOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ServiceAccount } from '../../types';

const { Text } = Typography;
const { Search } = Input;

interface ApplicationAccountsTabProps {
    agentId: string;
    serviceName: string;
    serviceType: string;
    accounts: ServiceAccount[];
    onCreateAccount: () => void;
    onEditAccount: (account: ServiceAccount) => void;
    onDeleteAccount: (id: string) => void;
}

export function ApplicationAccountsTab({
    accounts,
    onCreateAccount,
    onEditAccount,
    onDeleteAccount
}: ApplicationAccountsTabProps) {
    const { token } = theme.useToken();
    const [searchText, setSearchText] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'project' | 'independent'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Filter accounts
    const filteredAccounts = accounts.filter(account => {
        const matchesSearch = account.username?.toLowerCase().includes(searchText.toLowerCase()) ||
                             account.name.toLowerCase().includes(searchText.toLowerCase()) ||
                             (account.projectName || '').toLowerCase().includes(searchText.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || account.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const getCategoryTagColor = (category: string) => {
        return category === 'project' ? 'blue' : 'default';
    };

    const getStatusBadgeStatus = (status: string) => {
        return status === 'active' ? 'success' : 'default';
    };

    const columns: ColumnsType<ServiceAccount> = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
            width: 180,
            render: (username: string, record: ServiceAccount) => (
                <Space>
                    <Text code style={{ fontFamily: 'monospace' }}>
                        {showPasswords[record.id] ? username : '****' + username.slice(-4)}
                    </Text>
                    <Tooltip title={showPasswords[record.id] ? 'Hide' : 'Show'}>
                        <Button
                            type="text"
                            size="small"
                            onClick={() => togglePassword(record.id)}
                        >
                            {showPasswords[record.id] ? '🙈' : '👁️'}
                        </Button>
                    </Tooltip>
                </Space>
            )
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            width: 150,
            render: (name: string) => <Text strong>{name}</Text>
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: 120,
            render: (category: string, record: ServiceAccount) => (
                <Space>
                    <Tag color={getCategoryTagColor(category)}>
                        {category === 'project' ? <ProjectOutlined /> : <UserOutlined />}
                        {category.toUpperCase()}
                    </Tag>
                    {category === 'project' && record.projectName && (
                        <Text type="secondary" style={{ fontSize: 12 }}>{record.projectName}</Text>
                    )}
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => (
                <Badge status={getStatusBadgeStatus(status)} text={status.toUpperCase()} />
            )
        },
        {
            title: 'Permissions',
            dataIndex: 'permissions',
            key: 'permissions',
            width: 150,
            ellipsis: true,
            render: (permissions?: string) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {permissions || 'Read-only'}
                </Text>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_: any, record: ServiceAccount) => (
                <Space size="small">
                    <Tooltip title="Edit Account">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => onEditAccount(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Delete Account"
                        description={`Are you sure you want to delete account "${record.username}"?`}
                        onConfirm={() => onDeleteAccount(record.id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Tooltip title="Delete Account">
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: `${token.paddingSM}px 0` }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* Header with filters */}
                <Card style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Space wrap>
                            <Search
                                placeholder="Search accounts..."
                                prefix={<SearchOutlined />}
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 250 }}
                                allowClear
                            />
                            <Select
                                value={categoryFilter}
                                onChange={setCategoryFilter}
                                style={{ width: 150 }}
                                options={[
                                    { value: 'all', label: 'All Categories' },
                                    { value: 'project', label: 'Project-based' },
                                    { value: 'independent', label: 'Independent' }
                                ]}
                            />
                            <Select
                                value={statusFilter}
                                onChange={setStatusFilter}
                                style={{ width: 120 }}
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'active', label: 'Active' },
                                    { value: 'disabled', label: 'Disabled' }
                                ]}
                            />
                        </Space>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={onCreateAccount}
                        >
                            New Account
                        </Button>
                    </Space>
                </Card>

                {/* Accounts table */}
                {filteredAccounts.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <Space direction="vertical" align="center">
                                <Text>
                                    {accounts.length === 0
                                        ? 'No application accounts for this service'
                                        : 'No accounts match your filters'}
                                </Text>
                                {accounts.length === 0 && (
                                    <Button type="primary" icon={<UserOutlined />} onClick={onCreateAccount}>
                                        Create First Account
                                    </Button>
                                )}
                            </Space>
                        }
                    />
                ) : (
                    <Card style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}>
                        <Table
                            columns={columns}
                            dataSource={filteredAccounts}
                            rowKey="id"
                            pagination={{
                                pageSize: 10,
                                showSizeChanger: true,
                                showTotal: (total) => `Total ${total} accounts`
                            }}
                            size="middle"
                            scroll={{ x: 800 }}
                        />
                    </Card>
                )}

                {/* Info footer */}
                <Alert
                    message="Application Accounts"
                    description="These are user/service accounts created for your applications. They are separate from Management Credentials used by PRISM Agent."
                    type="info"
                    showIcon
                    style={{ borderRadius: 8 }}
                />
            </Space>
        </div>
    );
}
