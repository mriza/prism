import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Layout, Typography, Button, Divider, theme } from 'antd';
import {
    DashboardOutlined,
    ProjectOutlined,
    KeyOutlined,
    CloudServerOutlined,
    LineChartOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    UserOutlined,
    LogoutOutlined,
    ThunderboltFilled,
    UnorderedListOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Sider } = Layout;
const { Text, Title } = Typography;

export function Sidebar({ collapsed }: { collapsed: boolean }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = theme.useToken();

    const menuItems = [
        { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
        { key: '/accounts', icon: <KeyOutlined />, label: 'Accounts' },
        { key: '/servers', icon: <CloudServerOutlined />, label: 'Servers' },
        { key: '/processes', icon: <LineChartOutlined />, label: 'Processes' },
        { key: '/security', icon: <SafetyCertificateOutlined />, label: 'Security' },
        { key: '/logs', icon: <UnorderedListOutlined />, label: 'Activity Logs' },
        { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
        ...(user?.role === 'admin' ? [{ key: '/users', icon: <UserOutlined />, label: 'Users' }] : []),
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        navigate(key);
    };

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
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '8px', 
                    background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${token.colorPrimary}33`
                }}>
                    <ThunderboltFilled style={{ fontSize: '20px', color: '#fff' }} />
                </div>
                {!collapsed && (
                    <div style={{ whiteSpace: 'nowrap' }}>
                        <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>PRISM</Title>
                        <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Infra Manager
                        </Text>
                    </div>
                )}
            </div>

            <Divider style={{ margin: '4px 0 12px 0' }} />

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
                padding: '16px', 
                borderTop: `1px solid ${token.colorBorderSecondary}` 
            }}>
                <Button 
                    type="text" 
                    danger 
                    icon={<LogoutOutlined />} 
                    onClick={() => {
                        logout();
                        navigate('/login');
                    }}
                    block
                    style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    {!collapsed && "Logout"}
                </Button>
                {!collapsed && (
                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                        <Text type="secondary" style={{ fontSize: '11px', opacity: 0.5 }}>v0.2.0-antd</Text>
                    </div>
                )}
            </div>
        </Sider>
    );
}


