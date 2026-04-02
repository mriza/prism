import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Layout, Typography, Button, Divider, theme, Dropdown, Avatar, Badge, type MenuProps } from 'antd';
import {
    DashboardOutlined,
    ProjectOutlined,
    KeyOutlined,
    CloudServerOutlined,
    AppstoreOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    UserOutlined,
    LogoutOutlined,
    ThunderboltFilled,
    UnorderedListOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useAgentsContext } from '../contexts/AgentsContext';
import { ProfileModal } from '../components/modals/ProfileModal';
import { useState } from 'react';

const { Sider } = Layout;
const { Text, Title } = Typography;

export function Sidebar({ collapsed }: { collapsed: boolean }) {
    const { user, logout } = useAuth();
    const { agents } = useAgentsContext();
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = theme.useToken();
    const [profileOpen, setProfileOpen] = useState(false);

    const pendingCount = agents.filter(a => a.status === 'pending').length;

    const menuItems = [
        { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
        { key: '/accounts', icon: <KeyOutlined />, label: 'Accounts' },
        { key: '/applications', icon: <AppstoreOutlined />, label: 'Applications' },
        { 
            key: '/servers', 
            icon: <CloudServerOutlined />, 
            label: (
                <Badge count={pendingCount} size="small" color="warning" style={{ display: 'flex' }}>
                    <span>Servers</span>
                </Badge>
            )
        },
        { key: '/security', icon: <SafetyCertificateOutlined />, label: 'Security' },
        { key: '/logs', icon: <UnorderedListOutlined />, label: 'Activity Logs' },
        { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
        ...(user?.role === 'admin' ? [{ key: '/users', icon: <UserOutlined />, label: 'Users' }] : []),
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        navigate(key);
    };

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
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            width={260}
            theme="light"
            style={{
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                zIndex: 100,
            }}
        >
            <div style={{ padding: token.padding, display: 'flex', alignItems: 'center', gap: token.paddingSM, overflow: 'hidden' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: token.borderRadiusLG,
                    background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${token.colorPrimary}33`
                }}>
                    <ThunderboltFilled style={{ fontSize: token.fontSizeLG, color: token.colorWhite }} />
                </div>
                {!collapsed && (
                    <div style={{ whiteSpace: 'nowrap' }}>
                        <Title level={4} style={{ margin: 0, fontSize: token.fontSizeHeading5, fontWeight: token.fontWeightStrong }}>PRISM</Title>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Infra Manager
                        </Text>
                    </div>
                )}
            </div>

            <Divider style={{ margin: `${token.marginXXS}px 0 ${token.marginSM}px 0` }} />

            <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                items={menuItems}
                onClick={handleMenuClick}
                style={{ borderRight: 0 }}
            />

            <div style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                borderTop: `1px solid ${token.colorBorderSecondary}`
            }}>
                {/* User Profile Section - Split into user icon and logout */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: `${token.paddingXS}px ${token.padding}`,
                    gap: token.paddingXS
                }}>
                    {/* User Profile Dropdown */}
                    {!collapsed && (
                        <Dropdown menu={{ items: userMenuItems }} placement="topRight" arrow>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: token.paddingXS,
                                cursor: 'pointer',
                                flex: 1,
                                padding: token.paddingXXS,
                                borderRadius: token.borderRadius,
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = token.colorBgTextHover}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Avatar
                                    size="small"
                                    icon={<UserOutlined />}
                                    style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }}
                                />
                                <div style={{ overflow: 'hidden' }}>
                                    <Text strong style={{ fontSize: token.fontSizeSM, display: 'block' }}>{user?.username}</Text>
                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>{user?.role}</Text>
                                </div>
                            </div>
                        </Dropdown>
                    )}

                    {/* Logout Button */}
                    <Button
                        type="text"
                        danger
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                        style={{ flexShrink: 0 }}
                        title="Logout"
                    />
                </div>

                {!collapsed && (
                    <div style={{ textAlign: 'center', padding: `0 0 ${token.paddingSM}px 0` }}>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, opacity: 0.5 }}>v0.4.7</Text>
                    </div>
                )}

                <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
            </div>
        </Sider>
    );
}


