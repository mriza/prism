import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { AccountFormModal } from '../components/modals/AccountFormModal';
import { 
    Button, 
    Card, 
    Space, 
    Typography, 
    Tag, 
    Tooltip, 
    theme, 
    Empty, 
    Alert,
    Row,
    Col
} from 'antd';
import { 
    PlusOutlined, 
    KeyOutlined, 
    DeleteOutlined, 
    CloudServerOutlined, 
    CheckOutlined, 
    CopyOutlined, 
    EyeOutlined, 
    EyeInvisibleOutlined, 
    SyncOutlined, 
    EditOutlined,
    FilterOutlined
} from '@ant-design/icons';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../types';
import type { ServiceType, ServiceAccount } from '../types';
import { PageContainer } from '../components/PageContainer';

const { Text } = Typography;

export function AccountsPage() {
    const { independentAccounts, createAccount, updateAccount, deleteAccount } = useAccounts();
    const [showAdd, setShowAdd] = useState(false);
    const [editAccount, setEditAccount] = useState<ServiceAccount | null>(null);
    const [filterType, setFilterType] = useState<ServiceType | 'all'>('all');
    const { user } = useAuth();
    const { token } = theme.useToken();

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [provisioningId, setProvisioningId] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const allTypes = Object.values(SERVICE_TYPE_CATEGORIES).flat() as ServiceType[];

    const displayed = filterType === 'all'
        ? independentAccounts
        : independentAccounts.filter(a => a.type === filterType);

    return (
        <PageContainer
            title="Independent Accounts"
            description="Service accounts not linked to any project. Use these for standalone assets."
            extra={
                user?.role !== 'user' && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)}>
                        Add Account
                    </Button>
                )
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Filters */}
                {independentAccounts.length > 0 && (
                    <Space wrap style={{ marginBottom: token.marginXS }}>
                        <Text type="secondary" style={{ marginRight: token.marginXS }}><FilterOutlined /> Filter by type:</Text>
                        <Button
                            type={filterType === 'all' ? 'primary' : 'default'}
                            shape="round"
                            size="small"
                            onClick={() => setFilterType('all')}
                        >
                            All ({independentAccounts.length})
                        </Button>
                        {allTypes.filter(t => independentAccounts.some(a => a.type === t)).map(t => (
                            <Button
                                key={t}
                                type={filterType === t ? 'primary' : 'default'}
                                shape="round"
                                size="small"
                                onClick={() => setFilterType(t)}
                            >
                                {SERVICE_TYPE_LABELS[t]}
                            </Button>
                        ))}
                    </Space>
                )}

                {independentAccounts.length === 0 ? (
                    <Empty description="No independent accounts found" />
                ) : displayed.length === 0 ? (
                    <Empty description={`No accounts of type "${filterType}" match your criteria.`} />
                ) : (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {displayed.map(a => {
                            const type = a.type.toLowerCase();
                            const isDb = type.includes('mongodb') || type.includes('mysql') || type.includes('postgresql');
                            const isStorage = type.includes('s3') || type.includes('minio');

                            return (
                                <Card
                                    key={a.id}
                                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}
                                    styles={{ body: { padding: `${token.paddingMD}px ${token.paddingLG}` } }}
                                >
                                    <Row gutter={24} align="middle">
                                        <Col flex="0 0 250px">
                                            <Space direction="vertical" size={2}>
                                                <Text strong style={{ fontSize: token.fontSize }}>{a.name}</Text>
                                                <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{SERVICE_TYPE_LABELS[a.type]}</Text>
                                                <Space style={{ marginTop: token.marginXXS }}>
                                                    <Tag icon={<CloudServerOutlined />} style={{ borderRadius: token.borderRadiusSM }}>{a.agentId || 'External'}</Tag>
                                                </Space>
                                            </Space>
                                        </Col>

                                        <Col flex="auto">
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                {isDb && a.username && a.password && a.host && (
                                                    <Alert
                                                        style={{ padding: `${token.paddingXS}px ${token.paddingSM}` }}
                                                        message={
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <code style={{ fontSize: token.fontSizeSM, color: token.colorSuccess }}>
                                                                    {type.includes('mongodb')
                                                                        ? `mongodb://${a.username}:${showPasswords[a.id] ? a.password : '••••••••'}@${a.host}:${a.port || 27017}/${a.database}`
                                                                        : `${a.type.split('-')[0]}://${a.username}:${showPasswords[a.id] ? a.password : '••••••••'}@${a.host}:${a.port}/${a.database}`
                                                                    }
                                                                </code>
                                                                <Space>
                                                                    <Button type="text" size="small" icon={showPasswords[a.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => togglePassword(a.id)} />
                                                                    <Button 
                                                                        type="text" 
                                                                        size="small" 
                                                                        icon={copiedId === a.id ? <CheckOutlined style={{ color: token.colorSuccess }} /> : <CopyOutlined />} 
                                                                        onClick={async () => {
                                                                            const prefix = type.includes('mongodb') ? 'mongodb' : a.type.split('-')[0];
                                                                            const uri = `${prefix}://${encodeURIComponent(a.username!)}:${encodeURIComponent(a.password!)}@${a.host}:${a.port || (prefix === 'mongodb' ? 27017 : 3306)}/${encodeURIComponent(a.database!)}`;
                                                                            await navigator.clipboard.writeText(uri);
                                                                            setCopiedId(a.id);
                                                                            setTimeout(() => setCopiedId(null), 2000);
                                                                        }}
                                                                    />
                                                                </Space>
                                                            </div>
                                                        }
                                                    />
                                                )}

                                                {isStorage && a.accessKey && (
                                                    <Alert
                                                        className="storage-details"
                                                        style={{ padding: `${token.paddingXS}px ${token.paddingSM}` }}
                                                        message={
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <Space split={<Text type="secondary" style={{ opacity: 0.3 }}>|</Text>}>
                                                                    <Text style={{ fontSize: token.fontSizeSM }}>
                                                                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', marginRight: token.marginXXS }}>Key</Text>
                                                                        <code style={{ fontWeight: 600 }}>{a.accessKey}</code>
                                                                    </Text>
                                                                    <Text style={{ fontSize: token.fontSizeSM }}>
                                                                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', marginRight: token.marginXXS }}>Secret</Text>
                                                                        <code style={{ fontWeight: 600 }}>{showPasswords[a.id] ? a.secretKey : '••••••••••••••••'}</code>
                                                                    </Text>
                                                                </Space>
                                                                <Space>
                                                                    <Button type="text" size="small" icon={showPasswords[a.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => togglePassword(a.id)} />
                                                                </Space>
                                                            </div>
                                                        }
                                                    />
                                                )}

                                                <Space wrap style={{ fontSize: token.fontSizeSM }}>
                                                    {a.host && <Text type="secondary"><CloudServerOutlined style={{ marginRight: token.marginXXS }} />{a.host}:{a.port}</Text>}
                                                    {a.database && <Text type="secondary"><KeyOutlined style={{ marginRight: token.marginXXS }} />{a.database}</Text>}
                                                    {a.bucket && <Text type="secondary"><KeyOutlined style={{ marginRight: token.marginXXS }} />{a.bucket}</Text>}
                                                </Space>
                                            </Space>
                                        </Col>

                                        <Col flex="0 0 120px">
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                {user?.role !== 'user' && (
                                                    <Space>
                                                        {isDb && (
                                                            <Tooltip title="Sync with Agent">
                                                                <Button 
                                                                    type="text" 
                                                                    icon={provisioningId === a.id ? <SyncOutlined spin /> : <SyncOutlined />} 
                                                                    onClick={async () => {
                                                                        setProvisioningId(a.id);
                                                                        await updateAccount(a.id, a);
                                                                        setProvisioningId(null);
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip title="Edit">
                                                            <Button type="text" icon={<EditOutlined />} onClick={() => setEditAccount(a)} />
                                                        </Tooltip>
                                                        <Tooltip title="Delete">
                                                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => { if (confirm(`Delete account "${a.name}"?`)) deleteAccount(a.id); }} />
                                                        </Tooltip>
                                                    </Space>
                                                )}
                                            </div>
                                        </Col>
                                    </Row>
                                </Card>
                            );
                        })}
                    </Space>
                )}
            </Space>

            <AccountFormModal
                isOpen={showAdd}
                onClose={() => setShowAdd(false)}
                onSave={data => createAccount({ ...data, projectId: undefined })}
            />
            {editAccount && (
                <AccountFormModal
                    isOpen={true}
                    onClose={() => setEditAccount(null)}
                    onSave={data => updateAccount(editAccount.id, data)}
                    initial={editAccount}
                />
            )}
        </PageContainer>
    );
}
