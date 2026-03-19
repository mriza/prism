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

export function DatabaseManager({ sendCommand }: DatabaseManagerProps) {
    const [databases, setDatabases] = useState<string[]>([]);
    const [users, setUsers] = useState<any[]>([]);
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
            setError(err.message || 'Failed to fetch database information');
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
        <div style={{ padding: '4px 0' }}>
            {error && (
                <Alert message={error} type="error" showIcon style={{ marginBottom: '24px', borderRadius: '12px' }} />
            )}

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header card */}
                <Card 
                    style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter }}
                    bodyStyle={{ padding: '20px' }}
                >
                    <Row gutter={24} align="middle">
                        <Col span={16}>
                            <Space size="middle">
                                <div style={{ 
                                    padding: '10px', 
                                    borderRadius: '12px', 
                                    backgroundColor: `${token.colorPrimary}15`, 
                                    color: token.colorPrimary,
                                    fontSize: '20px',
                                    display: 'flex'
                                }}>
                                    <DatabaseOutlined />
                                </div>
                                <div>
                                    <Text strong style={{ fontSize: '15px', display: 'block' }}>Engine Management</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>Operational health and entity provisioning.</Text>
                                </div>
                            </Space>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} style={{ borderRadius: '8px' }}>Refresh State</Button>
                        </Col>
                    </Row>
                </Card>

                {/* Databases Section */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '0 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Active Databases</Text>
                </Divider>

                <Table 
                    columns={dbColumns} 
                    dataSource={databases.map(db => ({ key: db, name: db }))} 
                    loading={loading}
                    pagination={false}
                    size="small"
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '12px', overflow: 'hidden' }}
                />

                {/* User Privileges */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>User Privileges</Text>
                </Divider>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {users.length === 0 ? (
                        <Text type="secondary" italic>No specific user grants discovered.</Text>
                    ) : (
                        users.map((u, i) => (
                            <Tag key={i} color="processing" style={{ borderRadius: '6px', padding: '4px 10px' }}>
                                <Space>
                                    <SafetyCertificateOutlined />
                                    <Text strong style={{ fontSize: '12px' }}>{typeof u === 'string' ? u : u.user}</Text>
                                </Space>
                            </Tag>
                        ))
                    )}
                </div>

                {/* DB Provisioning card */}
                <Divider orientation={'left' as any} orientationMargin={0} style={{ margin: '24px 0 16px 0' }}>
                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Entity Provisioning</Text>
                </Divider>

                <Card style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Row gutter={16}>
                        <Col flex="auto">
                            <Input placeholder="Enter database name..." id="new-db-name" style={{ borderRadius: '8px', height: '40px' }} />
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
                                style={{ borderRadius: '8px', height: '40px', fontWeight: 600, padding: '0 24px' }}
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
