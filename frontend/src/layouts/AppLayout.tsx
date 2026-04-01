import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout, Button, theme, Space, Badge, Typography } from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    EnvironmentOutlined
} from '@ant-design/icons';
import { Sidebar } from './Sidebar';
import { useAgents } from '../hooks/useAgents';

const { Header, Content } = Layout;
const { Text } = Typography;

export function AppLayout() {
    const { agents, error } = useAgents();
    const [collapsed, setCollapsed] = useState(false);

    const {
        token
    } = theme.useToken();

    const { colorBgContainer, colorBgLayout, borderRadiusLG } = token;

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
                    paddingRight: token.paddingLG,
                    position: 'sticky',
                    top: 0,
                    zIndex: 99,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`
                }}>
                    <Space size="middle">
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{
                                fontSize: token.fontSizeHeading5,
                                width: 64,
                                height: 64,
                            }}
                        />
                        <Space className="hidden sm:flex">
                             <EnvironmentOutlined style={{ color: token.colorTextSecondary }} />
                             <Text type="secondary" style={{ fontSize: token.fontSize }}>Local Infrastructure</Text>
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
                    </Space>
                </Header>

                <Content
                    style={{
                        margin: token.marginLG,
                        minHeight: 280,
                        borderRadius: borderRadiusLG,
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}

