import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { 
    Button, 
    Card, 
    Space, 
    Typography, 
    Tag, 
    Tooltip, 
    theme, 
    Row, 
    Col, 
    Avatar,
    Popconfirm,
    Empty,
    Spin
} from 'antd';
import { 
    PlusOutlined, 
    DeleteOutlined, 
    SafetyOutlined, 
    UserOutlined, 
    KeyOutlined, 
    EditOutlined, 
    MailOutlined, 
    PhoneOutlined, 
    CalendarOutlined 
} from '@ant-design/icons';
import type { User } from '../types';
import { UserFormModal } from '../components/modals/UserFormModal';
import { PageContainer } from '../components/PageContainer';

const { Text } = Typography;

export function UsersPage() {
    const { users, loading, createUser, updateUser, deleteUser } = useUsers();
    const { user: currentUser } = useAuth();
    const [showAdd, setShowAdd] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const { token } = theme.useToken();

    const isAdmin = currentUser?.role === 'admin';

    return (
        <PageContainer
            title="Identity & Access"
            description="Manage administrative credentials, assign hierarchical roles, and control fleet-wide access policies."
            extra={
                isAdmin && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)} size="large" style={{ borderRadius: '12px' }}>
                        Add User
                    </Button>
                )
            }
        >
            {loading && users.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '16px' }}>
                    <Spin size="large" />
                    <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hydrating user directory...</Text>
                </div>
            ) : users.length === 0 ? (
                <Empty description="No users found in the directory" />
            ) : (
                <Row gutter={[24, 24]}>
                    {users.map(u => {
                        const isSelf = u.id === currentUser?.userId;
                        const RoleIcon = u.role === 'admin' ? SafetyOutlined : u.role === 'manager' ? KeyOutlined : UserOutlined;

                        return (
                            <Col xs={24} sm={24} md={12} lg={8} key={u.id}>
                                <Card 
                                    hoverable
                                    style={{ borderRadius: '20px', overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}
                                    bodyStyle={{ padding: '24px' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                        <Space size="middle">
                                            <Avatar 
                                                size={56} 
                                                icon={<RoleIcon />} 
                                                style={{ 
                                                    backgroundColor: u.role === 'admin' ? `${token.colorError}15` : u.role === 'manager' ? `${token.colorWarning}15` : `${token.colorSuccess}15`,
                                                    color: u.role === 'admin' ? token.colorError : u.role === 'manager' ? token.colorWarning : token.colorSuccess,
                                                    border: `1px solid ${u.role === 'admin' ? `${token.colorError}30` : u.role === 'manager' ? `${token.colorWarning}30` : `${token.colorSuccess}30`}`,
                                                    borderRadius: '16px'
                                                }}
                                            />
                                            <div>
                                                <Space>
                                                    <Text strong style={{ fontSize: '16px' }}>{u.username}</Text>
                                                    {isSelf && <Tag color="blue" style={{ borderRadius: '4px', fontSize: '9px', textTransform: 'uppercase' }}>Me</Tag>}
                                                </Space>
                                                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: token.colorTextDisabled, fontWeight: 700 }}>
                                                    {u.role} Authority
                                                </div>
                                            </div>
                                        </Space>
                                        
                                        {isAdmin && (
                                            <Space>
                                                <Tooltip title="Edit Profile">
                                                    <Button type="text" icon={<EditOutlined />} onClick={() => setEditUser(u)} />
                                                </Tooltip>
                                                <Popconfirm
                                                    title="Delete User"
                                                    description={`Authorize permanent deletion of user "${u.username}"?`}
                                                    onConfirm={() => deleteUser(u.id)}
                                                    okText="Delete"
                                                    cancelText="Cancel"
                                                    okButtonProps={{ danger: true }}
                                                    disabled={isSelf}
                                                >
                                                    <Tooltip title={isSelf ? "Self-termination is restricted" : "Delete User"}>
                                                        <Button type="text" danger icon={<DeleteOutlined />} disabled={isSelf} />
                                                    </Tooltip>
                                                </Popconfirm>
                                            </Space>
                                        )}
                                    </div>

                                    <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <UserOutlined style={{ color: token.colorTextDisabled }} />
                                            <Text style={{ fontSize: '13px' }}>{u.fullName}</Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <MailOutlined style={{ color: token.colorTextDisabled }} />
                                            <Text style={{ fontSize: '13px' }}>{u.email}</Text>
                                        </div>
                                        {u.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <PhoneOutlined style={{ color: token.colorTextDisabled }} />
                                                <Text style={{ fontSize: '13px' }}>{u.phone}</Text>
                                            </div>
                                        )}
                                    </Space>

                                    <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space size={4} style={{ color: token.colorTextDisabled, fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>
                                            <CalendarOutlined />
                                            <span>Enrolled {new Date(u.createdAt).toLocaleDateString()}</span>
                                        </Space>
                                        <Tag style={{ margin: 0, borderRadius: '6px', fontSize: '10px', backgroundColor: token.colorFillAlter, border: 'none', color: token.colorTextDisabled }}>
                                            <UserOutlined style={{ marginRight: '4px' }} />
                                            {u.id.substring(0, 8)}
                                        </Tag>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}

            {showAdd && (
                <UserFormModal 
                    isOpen={true} 
                    onClose={() => setShowAdd(false)} 
                    onSave={createUser} 
                />
            )}
            
            {editUser && (
                <UserFormModal 
                    isOpen={true} 
                    onClose={() => setEditUser(null)} 
                    onSave={(data) => updateUser(editUser.id, data)}
                    initial={editUser} 
                />
            )}
        </PageContainer>
    );
}

export default UsersPage;
