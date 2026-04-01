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
    CalendarOutlined,
    KeyOutlined as KeyResetOutlined
} from '@ant-design/icons';
import type { User } from '../types';
import { UserFormModal } from '../components/modals/UserFormModal';
import { ResetPasswordModal } from '../components/modals/ResetPasswordModal';
import { PageContainer } from '../components/PageContainer';

const { Text } = Typography;

export function UsersPage() {
    const { users, loading, createUser, updateUser, deleteUser } = useUsers();
    const { user: currentUser } = useAuth();
    const [showAdd, setShowAdd] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
    const { token } = theme.useToken();

    const isAdmin = currentUser?.role === 'admin';

    return (
        <PageContainer
            title="Identity & Access"
            description="Manage administrative credentials, assign hierarchical roles, and control fleet-wide access policies."
            extra={
                isAdmin && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)} size="large" style={{ borderRadius: token.borderRadiusLG }}>
                        Add User
                    </Button>
                )
            }
        >
            {loading && users.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${token.paddingXL * 4}px 0`, gap: token.marginSM }}>
                    <Spin size="large" />
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hydrating user directory...</Text>
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
                                    style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}
                                    styles={{ body: { padding: token.paddingLG } }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: token.marginLG }}>
                                        <Space size="middle">
                                            <Avatar
                                                size={56}
                                                icon={<RoleIcon />}
                                                style={{
                                                    backgroundColor: u.role === 'admin' ? `${token.colorError}15` : u.role === 'manager' ? `${token.colorWarning}15` : `${token.colorSuccess}15`,
                                                    color: u.role === 'admin' ? token.colorError : u.role === 'manager' ? token.colorWarning : token.colorSuccess,
                                                    border: `1px solid ${u.role === 'admin' ? `${token.colorError}30` : u.role === 'manager' ? `${token.colorWarning}30` : `${token.colorSuccess}30`}`,
                                                    borderRadius: token.borderRadiusLG
                                                }}
                                            />
                                            <div>
                                                <Space>
                                                    <Text strong style={{ fontSize: token.fontSizeHeading5 }}>{u.username}</Text>
                                                    {isSelf && <Tag color="blue" style={{ borderRadius: token.borderRadiusSM, fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>Me</Tag>}
                                                </Space>
                                                <div style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', color: token.colorTextDisabled, fontWeight: 700 }}>
                                                    {u.role} Authority
                                                </div>
                                            </div>
                                        </Space>
                                        
                                        {isAdmin && (
                                            <Space>
                                                <Tooltip title="Reset Password">
                                                    <Button 
                                                        type="text" 
                                                        icon={<KeyResetOutlined />} 
                                                        onClick={() => setResetPasswordUser(u)}
                                                        style={{ color: token.colorWarning }}
                                                    />
                                                </Tooltip>
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

                                    <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: token.marginLG }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                                            <UserOutlined style={{ color: token.colorTextDisabled }} />
                                            <Text style={{ fontSize: token.fontSize }}>{u.fullName}</Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                                            <MailOutlined style={{ color: token.colorTextDisabled }} />
                                            <Text style={{ fontSize: token.fontSize }}>{u.email}</Text>
                                        </div>
                                        {u.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                                                <PhoneOutlined style={{ color: token.colorTextDisabled }} />
                                                <Text style={{ fontSize: token.fontSize }}>{u.phone}</Text>
                                            </div>
                                        )}
                                    </Space>

                                    <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: token.padding, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space size={4} style={{ color: token.colorTextDisabled, fontSize: token.fontSizeSM, textTransform: 'uppercase', fontWeight: 600 }}>
                                            <CalendarOutlined />
                                            <span>Enrolled {new Date(u.createdAt).toLocaleDateString()}</span>
                                        </Space>
                                        <Tag style={{ margin: 0, borderRadius: token.borderRadiusSM, fontSize: token.fontSizeSM, backgroundColor: token.colorFillAlter, border: 'none', color: token.colorTextDisabled }}>
                                            <UserOutlined style={{ marginRight: token.marginXXS }} />
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

            {resetPasswordUser && (
                <ResetPasswordModal
                    isOpen={true}
                    user={resetPasswordUser}
                    onClose={() => setResetPasswordUser(null)}
                    onSuccess={() => {
                        // Refresh users list
                        window.location.reload();
                    }}
                />
            )}
        </PageContainer>
    );
}

export default UsersPage;
