import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Button, theme, Space, Badge, Dropdown, Avatar, Typography, type MenuProps } from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    UserOutlined,
    LogoutOutlined,
    SettingOutlined,
    EnvironmentOutlined
} from '@ant-design/icons';
import { Sidebar } from './Sidebar';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../contexts/AuthContext';
import { ProfileModal } from '../components/modals/ProfileModal';

const { Header, Content } = Layout;
const { Text } = Typography;

export function AppLayout() {
    const { agents, error } = useAgents();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const {
        token
    } = theme.useToken();

    const { colorBgContainer, colorBgLayout, borderRadiusLG } = token;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'profile',
            label: 'My Profile',
            icon: <UserOutlined />,
            onClick: () => setProfileOpen(true),
        },
        {
            key: 'settings',
            label: 'Settings',
            icon: <SettingOutlined />,
            onClick: () => navigate('/settings'),
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            label: 'Sign Out',
            icon: <LogoutOutlined />,
            danger: true,
            onClick: handleLogout,
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: colorBgLayout }}>
            <Sidebar collapsed={collapsed} />
            <Layout style={{ 
                marginLeft: collapsed ? 80 : 260, 
                transition: 'margin-left 0.2s',
                minHeight: '100vh',
                background: colorBgLayout
            }}>
                <Header style={{ 
                    padding: 0, 
                    background: colorBgContainer, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    paddingRight: '24px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 99,
                    borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
                }}>
                    <Space size="middle">
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{
                                fontSize: '16px',
                                width: 64,
                                height: 64,
                            }}
                        />
                        <Space className="hidden sm:flex">
                             <EnvironmentOutlined style={{ color: token.colorTextSecondary }} />
                             <Text type="secondary" style={{ fontSize: '14px' }}>Local Infrastructure</Text>
                        </Space>
                    </Space>
                    
                    <Space size="large">
                        {/* Agent status badge */}
                        <div className="hidden md:block">
                             {error || agents.length === 0 ? (
                                <Badge status="error" text="No Agents Online" />
                            ) : (
                                <Badge status="success" text={`${agents.length} Agent${agents.length !== 1 ? 's' : ''} Online`} />
                            )}
                        </div>

                        {/* User Profile Dropdown */}
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
                            <Space style={{ cursor: 'pointer' }}>
                                <Avatar 
                                    size="small" 
                                    icon={<UserOutlined />} 
                                    style={{ backgroundColor: token.colorPrimary }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }} className="hidden xs:flex">
                                    <Text strong style={{ fontSize: '12px' }}>{user?.username}</Text>
                                    <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>{user?.role}</Text>
                                </div>
                            </Space>
                        </Dropdown>
                    </Space>
                </Header>

                <Content
                    style={{
                        margin: '24px 24px',
                        minHeight: 280,
                        borderRadius: borderRadiusLG,
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>

            <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        </Layout>
    );
}

