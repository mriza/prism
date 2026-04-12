/**
 * NewLayout - Modern Application Layout
 * 
 * A modern, theme-aware layout system with:
 * - Collapsible sidebar with smooth animations
 * - Modern header with user profile, notifications, and theme toggle
 * - Dynamic breadcrumbs
 * - Responsive design
 * - Full light/dark theme support
 */

import { useState, useCallback, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, theme, Button, Space, Avatar, Dropdown, Badge, Typography, Tooltip, Divider } from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    BellOutlined,
    UserOutlined,
    SettingOutlined,
    LogoutOutlined,
    QuestionCircleOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { SidebarNav } from './SidebarNav';
import { BreadcrumbNav } from './BreadcrumbNav';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

// ============================================
// User Profile Button Component (with proper hover state)
// ============================================

function UserProfileButton() {
    const { token } = theme.useToken();
    const { user } = useAuth();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Space
            style={{
                cursor: 'pointer',
                padding: `${token.paddingXS}px ${token.paddingSM}px`,
                borderRadius: token.borderRadiusLG,
                background: isHovered ? token.colorFillAlter : 'transparent',
                transition: `background ${token.motionDurationFast} ${token.motionEaseInOut}`,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Avatar
                size="default"
                icon={<UserOutlined />}
                style={{
                    backgroundColor: token.colorPrimary,
                    color: token.colorTextLightSolid
                }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Text strong style={{ fontSize: token.fontSizeSM, lineHeight: '1.2' }}>
                    {user?.username || 'User'}
                </Text>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: '1.2' }}>
                    {user?.role || 'user'}
                </Text>
            </div>
        </Space>
    );
}

// ============================================
// HeaderBar Component
// ============================================

function HeaderBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { token } = theme.useToken();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.warn('Fullscreen API not available:', err);
        }
    }, []);

    const userMenuItems = useMemo(() => [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'My Profile',
            onClick: () => navigate('/settings')
        } as const,
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
            onClick: () => navigate('/settings')
        } as const,
        {
            key: 'help',
            icon: <QuestionCircleOutlined />,
            label: 'Help & Support',
            onClick: () => window.open('https://github.com/prism/prism/wiki', '_blank')
        } as const,
        { type: 'divider' } as const,
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            danger: true,
            onClick: () => {
                logout();
                navigate('/login');
            }
        } as const
    ], [navigate, logout]);

    return (
        <Header
            style={{
                padding: `0 ${token.paddingLG}px`,
                background: token.colorBgContainer,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                boxShadow: token.boxShadowTertiary,
                height: 64,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                transition: `all ${token.motionDurationMid} ${token.motionEaseInOut}`
            }}
        >
            {/* Left Section - Toggle & Breadcrumbs */}
            <Space size="middle">
                <Button
                    type="text"
                    icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={onToggle}
                    style={{
                        fontSize: token.fontSizeLG,
                        width: 48,
                        height: 48,
                        borderRadius: token.borderRadiusLG,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                />
                <BreadcrumbNav />
            </Space>

            {/* Right Section - Actions & User */}
            <Space size="middle">
                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Fullscreen Toggle */}
                <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
                    <Button
                        type="text"
                        icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        onClick={handleFullscreen}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: token.borderRadiusLG,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    />
                </Tooltip>

                {/* Notifications */}
                <Tooltip title="Notifications">
                    <Badge count={0} size="small" offset={[-5, 5]}>
                        <Button
                            type="text"
                            icon={<BellOutlined />}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: token.borderRadiusLG,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        />
                    </Badge>
                </Tooltip>

                <Divider type="vertical" style={{ height: 32, margin: `0 ${token.marginXS}px` }} />

                {/* User Profile */}
                <Dropdown
                    menu={{ items: userMenuItems }}
                    placement="bottomRight"
                    arrow
                    trigger={['click']}
                >
                    <UserProfileButton />
                </Dropdown>
            </Space>
        </Header>
    );
}

// ============================================
// Main Layout Component
// ============================================

export function NewLayout() {
    const { token } = theme.useToken();
    const [collapsed, setCollapsed] = useState(false);

    const handleToggle = useCallback(() => {
        setCollapsed(prev => !prev);
    }, []);

    return (
        <Layout
            style={{
                minHeight: '100vh',
                background: token.colorBgLayout,
                transition: `all ${token.motionDurationMid} ${token.motionEaseInOut}`
            }}
        >
            {/* Sidebar */}
            <SidebarNav collapsed={collapsed} />

            {/* Main Content Area */}
            <Layout
                style={{
                    marginLeft: collapsed ? 80 : 272,
                    transition: `margin-left ${token.motionDurationMid} ${token.motionEaseInOut}`,
                    minHeight: '100vh',
                    background: token.colorBgLayout
                }}
            >
                {/* Header */}
                <HeaderBar collapsed={collapsed} onToggle={handleToggle} />

                {/* Page Content */}
                <Content
                    style={{
                        margin: token.marginLG,
                        padding: token.paddingLG,
                        minHeight: 280,
                        background: token.colorBgContainer,
                        borderRadius: token.borderRadiusLG,
                        boxShadow: token.boxShadowTertiary,
                        overflow: 'auto'
                    }}
                >
                    <Outlet />
                </Content>

                {/* Footer */}
                <Footer
                    style={{
                        textAlign: 'center',
                        background: 'transparent',
                        padding: `${token.paddingSM}px ${token.paddingLG}px`,
                        color: token.colorTextTertiary,
                        fontSize: token.fontSizeSM
                    }}
                >
                    PRISM Infrastructure Management Platform ©{new Date().getFullYear()} — v0.7.0
                </Footer>
            </Layout>
        </Layout>
    );
}
