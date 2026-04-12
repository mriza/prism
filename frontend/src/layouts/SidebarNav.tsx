/**
 * SidebarNav - Modern Navigation Sidebar
 * 
 * Features:
 * - Collapsible with smooth animations
 * - Active route highlighting
 * - Icon + label navigation
 * - Tooltip labels when collapsed
 * - Grouped navigation sections
 * - Full theme support
 */

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Tooltip, Typography, Space } from 'antd';
import { theme as antdTheme } from 'antd';
import {
    DashboardOutlined,
    ProjectOutlined,
    AccountBookOutlined,
    AppstoreOutlined,
    CloudServerOutlined,
    SecurityScanOutlined,
    FileTextOutlined,
    TeamOutlined,
    SettingOutlined,
    SafetyCertificateOutlined,
    ThunderboltOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';

const { Sider } = Layout;
const { Text } = Typography;

interface SidebarNavProps {
    collapsed: boolean;
}

// ============================================
// Navigation Items Configuration
// ============================================

const navItems = [
    {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        path: '/'
    },
    {
        key: 'projects',
        icon: <ProjectOutlined />,
        label: 'Projects',
        path: '/projects'
    },
    {
        key: 'accounts',
        icon: <AccountBookOutlined />,
        label: 'Accounts',
        path: '/accounts'
    },
    {
        key: 'applications',
        icon: <AppstoreOutlined />,
        label: 'Applications',
        path: '/applications'
    },
    {
        key: 'servers',
        icon: <CloudServerOutlined />,
        label: 'Servers',
        path: '/servers'
    },
    {
        type: 'divider'
    },
    {
        key: 'security',
        icon: <SecurityScanOutlined />,
        label: 'Security',
        path: '/security'
    },
    {
        key: 'logs',
        icon: <FileTextOutlined />,
        label: 'Activity Logs',
        path: '/logs'
    },
    {
        key: 'config-drift',
        icon: <ExclamationCircleOutlined />,
        label: 'Config Drift',
        path: '/config-drift'
    },
    {
        type: 'divider'
    },
    {
        key: 'users',
        icon: <TeamOutlined />,
        label: 'Users',
        path: '/users'
    },
    {
        key: 'roles',
        icon: <SafetyCertificateOutlined />,
        label: 'Roles',
        path: '/roles'
    },
    {
        key: 'webhooks',
        icon: <ThunderboltOutlined />,
        label: 'Webhooks',
        path: '/webhooks'
    },
    {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Settings',
        path: '/settings'
    }
];

// ============================================
// SidebarNav Component
// ============================================

export function SidebarNav({ collapsed }: SidebarNavProps) {
    const { token } = antdTheme.useToken();
    const location = useLocation();
    const navigate = useNavigate();

    // Map path to menu key
    const activeKey = useMemo(() => {
        const path = location.pathname;
        if (path === '/') return 'dashboard';
        if (path.startsWith('/projects')) return 'projects';
        if (path.startsWith('/accounts')) return 'accounts';
        if (path.startsWith('/applications')) return 'applications';
        if (path.startsWith('/servers')) return 'servers';
        if (path.startsWith('/security')) return 'security';
        if (path.startsWith('/logs')) return 'logs';
        if (path.startsWith('/config-drift')) return 'config-drift';
        if (path.startsWith('/users')) return 'users';
        if (path.startsWith('/roles')) return 'roles';
        if (path.startsWith('/webhooks')) return 'webhooks';
        if (path.startsWith('/settings')) return 'settings';
        return '';
    }, [location.pathname]);

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        const item = navItems.find(i => i.key === key);
        if (item?.path) {
            navigate(item.path);
        }
    };

    // Menu items for antd Menu
    const menuItems: ItemType[] = useMemo(() => 
        navItems.map(item => {
            if (item.type === 'divider') {
                return { type: 'divider' };
            }
            return {
                key: item.key,
                icon: item.icon,
                label: collapsed ? (
                    <Tooltip title={item.label} placement="right">
                        <span>{item.label}</span>
                    </Tooltip>
                ) : (
                    item.label
                )
            };
        }) as ItemType[], [collapsed]);

    return (
        <Sider
            collapsed={collapsed}
            collapsedWidth={80}
            width={272}
            style={{
                background: token.colorBgContainer,
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                overflow: 'auto',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 101,
                transition: `all ${token.motionDurationMid} ${token.motionEaseInOut}`
            }}
            theme="light"
        >
            {/* Logo Section */}
            <div
                style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? 0 : `0 ${token.paddingLG}px`,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 100%)`,
                    transition: `all ${token.motionDurationMid} ${token.motionEaseInOut}`
                }}
            >
                <Space
                    size="middle"
                    style={{
                        cursor: 'pointer',
                        padding: collapsed ? `${token.paddingSM}px` : `${token.paddingSM}px ${token.paddingXS}px`,
                        borderRadius: token.borderRadiusLG,
                        transition: `opacity ${token.motionDurationFast} ${token.motionEaseInOut}`
                    }}
                    onClick={() => navigate('/')}
                >
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: token.borderRadiusLG,
                            background: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: token.colorTextLightSolid,
                            fontSize: token.fontSizeXL,
                            fontWeight: token.fontWeightStrong
                        }}
                    >
                        P
                    </div>
                    {!collapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Text
                                strong
                                style={{
                                    color: token.colorTextLightSolid,
                                    fontSize: token.fontSizeLG,
                                    lineHeight: '1.2'
                                }}
                            >
                                PRISM
                            </Text>
                            <Text
                                style={{
                                    color: 'rgba(255, 255, 255, 0.75)',
                                    fontSize: token.fontSizeSM,
                                    lineHeight: '1.2'
                                }}
                            >
                                Infrastructure Platform
                            </Text>
                        </div>
                    )}
                </Space>
            </div>

            {/* Navigation Menu */}
            <Menu
                mode="inline"
                selectedKeys={[activeKey]}
                items={menuItems}
                onClick={handleMenuClick}
                style={{
                    borderRight: 'none',
                    background: 'transparent',
                    padding: `${token.paddingSM}px 0`
                }}
            />
        </Sider>
    );
}
