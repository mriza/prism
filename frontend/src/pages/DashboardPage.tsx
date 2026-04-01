import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAgents } from '../hooks/useAgents';
import { 
    Card, 
    Row, 
    Col, 
    Statistic, 
    Button, 
    Typography, 
    Space, 
    List, 
    theme 
} from 'antd';
import { 
    FolderOpenOutlined, 
    KeyOutlined, 
    CloudServerOutlined, 
    PlusOutlined, 
    ArrowRightOutlined, 
    LineChartOutlined,
    ThunderboltOutlined
} from '@ant-design/icons';
import { PageContainer } from '../components/PageContainer';

const { Title, Text } = Typography;

export function DashboardPage() {
    const { projects } = useProjects();
    const { accounts, independentAccounts } = useAccounts();
    const { agents, error } = useAgents();
    const navigate = useNavigate();
    const { token } = theme.useToken();

    const onlineAgents = agents.filter(a => a.status === 'online').length;

    const stats = [
        { 
            title: 'Total Projects', 
            value: projects.length, 
            icon: <FolderOpenOutlined style={{ color: token.colorPrimary }} />, 
            color: token.colorPrimaryBg,
            onClick: () => navigate('/projects')
        },
        { 
            title: 'Active Services', 
            value: accounts.length, 
            icon: <KeyOutlined style={{ color: token.colorInfo }} />, 
            color: token.colorInfoBg,
            onClick: () => navigate('/accounts')
        },
        { 
            title: 'Online Agents', 
            value: onlineAgents, 
            icon: <CloudServerOutlined style={{ color: error ? token.colorError : token.colorSuccess }} />, 
            color: error ? token.colorErrorBg : token.colorSuccessBg,
            onClick: () => navigate('/servers')
        },
        { 
            title: 'Independent', 
            value: independentAccounts.length, 
            icon: <LineChartOutlined style={{ color: token.colorWarning }} />, 
            color: token.colorWarningBg,
            onClick: () => navigate('/accounts')
        },
    ];

    return (
        <PageContainer
            title="Dashboard"
            description="Fleet overview and immediate management actions."
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginLG }}>
                {/* Stats Grid */}
                <Row gutter={[24, 24]}>
                    {stats.map((stat, idx) => (
                        <Col xs={24} sm={12} lg={6} key={idx}>
                            <Card
                                hoverable
                                onClick={stat.onClick}
                                style={{ borderRadius: token.borderRadiusLG, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                                styles={{ body: { padding: token.paddingLG } }}
                            >
                                <Statistic
                                    title={<Text type="secondary" strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.title}</Text>}
                                    value={stat.value}
                                    prefix={React.cloneElement(stat.icon as React.ReactElement<any>, {
                                        style: {
                                            ...(stat.icon as React.ReactElement<any>).props.style,
                                            fontSize: token.fontSizeHeading3,
                                            marginRight: token.marginSM
                                        }
                                    })}
                                    valueStyle={{ fontWeight: 800, fontSize: token.fontSizeHeading4 }}
                                />
                            </Card>
                        </Col>
                    ))}
                </Row>

                {/* Quick Actions */}
                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                        <Card
                            hoverable
                            onClick={() => navigate('/projects')}
                            style={{
                                borderRadius: token.borderRadiusLG,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorPrimaryBg} 100%)`
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Space size="large">
                                    <div style={{
                                        padding: token.paddingLG,
                                        borderRadius: token.borderRadiusLG,
                                        background: token.colorPrimary,
                                        color: token.colorWhite,
                                        display: 'flex',
                                        boxShadow: `0 4px 12px ${token.colorPrimary}40`
                                    }}>
                                        <PlusOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                                    </div>
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>Create Project</Title>
                                        <Text type="secondary">Group and manage related infrastructure assets.</Text>
                                    </div>
                                </Space>
                                <ArrowRightOutlined style={{ fontSize: token.fontSizeLG, opacity: 0.2 }} />
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                        <Card
                            hoverable
                            onClick={() => navigate('/accounts')}
                            style={{
                                borderRadius: token.borderRadiusLG,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorInfoBg} 100%)`
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Space size="large">
                                    <div style={{
                                        padding: token.paddingLG,
                                        borderRadius: token.borderRadiusLG,
                                        background: token.colorInfo,
                                        color: token.colorWhite,
                                        display: 'flex',
                                        boxShadow: `0 4px 12px ${token.colorInfo}40`
                                    }}>
                                        <KeyOutlined style={{ fontSize: token.fontSizeHeading3 }} />
                                    </div>
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>Provision Account</Title>
                                        <Text type="secondary">Instantly add database, FTP or process credentials.</Text>
                                    </div>
                                </Space>
                                <ArrowRightOutlined style={{ fontSize: token.fontSizeLG, opacity: 0.2 }} />
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* Recent Projects */}
                {projects.length > 0 && (
                    <Card
                        title={
                            <Space>
                                <ThunderboltOutlined style={{ color: token.colorPrimary }} />
                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: token.fontSizeSM }}>Recent Deployments</Text>
                            </Space>
                        }
                        extra={<Button type="link" onClick={() => navigate('/projects')}>View All Assets</Button>}
                        style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                    >
                        <List
                            grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
                            dataSource={projects.slice(0, 6)}
                            renderItem={(project) => (
                                <List.Item>
                                    <Card
                                        hoverable
                                        size="small"
                                        onClick={() => navigate(`/projects/${project.id}`)}
                                        style={{ borderRadius: token.borderRadiusLG }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Space>
                                                <div style={{
                                                    width: token.paddingXS,
                                                    height: token.paddingXS,
                                                    borderRadius: '50%',
                                                    background: project.color === 'primary' ? token.colorPrimary :
                                                               project.color === 'secondary' ? token.colorLink :
                                                               project.color === 'success' ? token.colorSuccess :
                                                               project.color === 'warning' ? token.colorWarning :
                                                               project.color === 'error' ? token.colorError :
                                                               token.colorTextSecondary
                                                }} />
                                                <Text strong>{project.name}</Text>
                                            </Space>
                                            <ArrowRightOutlined style={{ fontSize: token.fontSizeSM, opacity: 0.3 }} />
                                        </div>
                                    </Card>
                                </List.Item>
                            )}
                        />
                    </Card>
                )}
            </div>
        </PageContainer>
    );
}

