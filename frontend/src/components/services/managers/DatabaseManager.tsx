import { useState, useEffect } from 'react';
import {
    Button,
    Space,
    Typography,
    theme,
    Alert,
    Divider,
    Card,
    Table,
    Input,
    Row,
    Col,
    Tag,
    Popconfirm
} from 'antd';
import { handleError } from '../../../utils/log';
import { 
    DatabaseOutlined, 
    PlusOutlined, 
    DeleteOutlined,
    TableOutlined,
    SafetyCertificateOutlined,
    ReloadOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface DatabaseManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any>;
}

interface DatabaseUser {
    name: string;
    [key: string]: unknown;
}

export function DatabaseManager({ sendCommand }: DatabaseManagerProps) {
    const [databases, setDatabases] = useState<string[]>([]);
    const [users, setUsers] = useState<DatabaseUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { token } = theme.useToken();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const dbRes = await sendCommand('database_list_dbs');
            if (dbRes?.success) {
                setDatabases(typeof dbRes.message === 'string' ? JSON.parse(dbRes.message) : dbRes.message);
            }

            const userRes = await sendCommand('database_list_users');
            if (userRes?.success) {
                setUsers(typeof userRes.message === 'string' ? JSON.parse(userRes.message) : userRes.message);
            }
        } catch (err: any) {
            handleError(() => { throw err; }, err.message || 'Failed to fetch data', { 
                showToast: false,
                onError: () => setError(err.message || 'Failed to fetch database information')
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDB = async (name: string) => {
        if (!name) return;
        setActionLoading('create-db');
        try {
            const res = await sendCommand('database_create_db', { db_name: name });
            if (res?.success) fetchData();
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteDB = async (name: string) => {
        setActionLoading(`delete-db-${name}`);
        try {
            const res = await sendCommand('database_delete_db', { db_name: name });
            if (res?.success) fetchData();
        } finally {
            setActionLoading(null);
        }
    };

    const dbColumns = [
        {
            title: 'Database Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => (
                <Space>
                    <TableOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>{name}</Text>
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: { name: string }) => (
                <Popconfirm title={`Drop database ${record.name}?`} onConfirm={() => handleDeleteDB(record.name)} okText="Yes" cancelText="No" okButtonProps={{ danger: true }}>
                    <Button 
                        size="small" 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        loading={actionLoading === `delete-db-${record.name}`}
                    />
                </Popconfirm>
            )
        }
    ];

    return (
        <div style={{ padding: `${token.paddingXXS}px 0` }}>
            {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header card */}
                <Card 
                    style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter }}
                    styles={{ body: { padding: token.paddingLG } }}
                >
                    <Row gutter={24} align="middle">
                        <Col span={16}>
                            <Space size="middle">
                                <div style={{ 
                                    padding: token.paddingSM, 
                                    borderRadius: token.borderRadiusLG, 
                                    backgroundColor: `${token.colorPrimary}15`, 
                                    color: token.colorPrimary,
                                    fontSize: token.paddingLG,
                                    display: 'flex'
                                }}>
                                    <DatabaseOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: token.fontSize, display: 'block' }}>Engine Management</Text>
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Operational health and entity provisioning.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: token.borderRadius }}>Refresh State</Button>
                        </Col>
                    </Row>
                </Card>

                {/* Databases Section */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: '0 0 16px 0' }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Active Databases</Text>
                </Divider>

                <Table 
                    columns={dbColumns} 
                    dataSource={databases.map(db => ({ key: db, name: db }))} 
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
                />

                {/* User Privileges */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>User Privileges</Text>
                </Divider>

                <div style={{ display: 'flex', gap: token.paddingSM, flexWrap: 'wrap' }}>
                    {users.length === 0 ? (
                        <Text type="secondary" italic>No specific user grants discovered.</Text>
                    ) : (
                        users.map((u, i) => {
                            const userName = typeof u === 'string' ? u : (u.user as string) || u.name;
                            return (
                                <Tag key={i} color="processing" style={{ borderRadius: token.paddingXXS, padding: `${token.paddingXXS}px ${token.paddingSM}px` }}>
                                    <Space>
                                        <SafetyCertificateOutlined />
                                        <Text strong style={{ fontSize: token.fontSizeSM }}>{userName}</Text>
                                    </Space>
                                </Tag>
                            );
                        })
                    )}
                </div>

                {/* DB Provisioning card */}
                <Divider titlePlacement="left" orientationMargin={0} style={{ margin: `${token.marginLG}px 0 ${token.marginSM}px 0` }}>
                    <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Entity Provisioning</Text>
                </Divider>

                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Row gutter={16}>
                        <Col flex="auto">
                            <Input placeholder="Enter database name..." id="new-db-name" style={{ borderRadius: token.borderRadius, height: token.paddingLG }} />
                        </Col>
                        <Col>
                            <Button 
                                type="primary" 
                                icon={<PlusOutlined />} 
                                loading={actionLoading === 'create-db'}
                                onClick={() => {
                                    const input = document.getElementById('new-db-name') as HTMLInputElement;
                                    handleCreateDB(input.value);
                                }}
                                style={{ borderRadius: token.borderRadius, height: token.paddingLG, fontWeight: token.fontWeightStrong, padding: '0 24px' }}
                            >
                                Provision DB
                            </Button>
                        </Col>
                    </Row>
                </Card>
            </Space>
        </div>
    );
}
