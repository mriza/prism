import { useState, useEffect } from 'react';
import { log } from '../utils/log';
import { theme } from 'antd';
import {
    Card,
    Row,
    Col,
    Statistic,
    Progress,
    Tag,
    Space,
    Typography,
    Alert,
    Spin,
    Button,
    Divider
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined,
    ReloadOutlined,
    DatabaseOutlined,
    ThunderboltOutlined,
    CloudServerOutlined,
    SafetyOutlined
} from '@ant-design/icons';
import { PageContainer } from '../components/PageContainer';

const { Text } = Typography;

interface HealthCheck {
    status: string;
    message?: string;
    timestamp: string;
}

interface HealthStatus {
    status: string;
    timestamp: string;
    version: string;
    checks: Record<string, HealthCheck>;
}

export function HealthDashboardPage() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const { token } = theme.useToken();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/health/full`);
            if (res.ok) {
                const data = await res.json();
                setHealth(data);
                setLastChecked(new Date());
            }
        } catch (err) {
            log.error('Failed to fetch health status', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'success';
            case 'starting':
                return 'processing';
            case 'degraded':
                return 'warning';
            case 'unhealthy':
            case 'disabled':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircleOutlined />;
            case 'starting':
                return <LoadingOutlined />;
            default:
                return <CloseCircleOutlined />;
        }
    };

    const getUptime = () => {
        if (!health?.checks?.uptime?.message) return 'N/A';
        return health.checks.uptime.message;
    };

    return (
        <PageContainer
            title="System Health Dashboard"
            description="Real-time monitoring of system health and components"
            extra={
                <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchHealth}
                    loading={loading}
                >
                    Refresh
                </Button>
            }
        >
            {loading && !health ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                    <Spin size="large" tip="Loading health status..." />
                </div>
            ) : (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {/* Overall Status */}
                    <Alert
                        message={
                            <Space>
                                {getStatusIcon(health?.status || 'unknown')}
                                <Text strong style={{ fontSize: token.fontSizeHeading5 }}>
                                    Overall Status: {health?.status?.toUpperCase()}
                                </Text>
                            </Space>
                        }
                        description={
                            <Space>
                                <Text>Version: {health?.version}</Text>
                                <Divider type="vertical" />
                                <Text>Last checked: {lastChecked?.toLocaleTimeString()}</Text>
                            </Space>
                        }
                        type={health?.status === 'healthy' ? 'success' : health?.status === 'unhealthy' ? 'error' : 'warning'}
                        showIcon
                        style={{ borderRadius: token.borderRadiusLG }}
                    />

                    {/* Health Checks Grid */}
                    <Row gutter={[16, 16]}>
                        {/* Database Health */}
                        <Col xs={24} md={12} lg={8}>
                            <Card>
                                <Statistic
                                    title="Database"
                                    value={health?.checks?.database?.status === 'healthy' ? 100 : 0}
                                    valueStyle={{ color: health?.checks?.database?.status === 'healthy' ? '#52c41a' : '#ff4d4f' }}
                                    prefix={<DatabaseOutlined />}
                                    suffix="%"
                                />
                                <Divider />
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary">
                                        {health?.checks?.database?.message || 'Not checked'}
                                    </Text>
                                    <Tag color={getStatusColor(health?.checks?.database?.status || 'unknown')}>
                                        {getStatusIcon(health?.checks?.database?.status || 'unknown')}
                                        {health?.checks?.database?.status?.toUpperCase()}
                                    </Tag>
                                </Space>
                            </Card>
                        </Col>

                        {/* Cache Health */}
                        <Col xs={24} md={12} lg={8}>
                            <Card>
                                <Statistic
                                    title="Cache (Valkey)"
                                    value={health?.checks?.cache?.status === 'healthy' ? 100 : health?.checks?.cache?.status === 'disabled' ? 50 : 0}
                                    valueStyle={{ 
                                        color: health?.checks?.cache?.status === 'healthy' ? '#52c41a' : 
                                               health?.checks?.cache?.status === 'disabled' ? '#faad14' : '#ff4d4f' 
                                    }}
                                    prefix={<ThunderboltOutlined />}
                                    suffix="%"
                                />
                                <Divider />
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary">
                                        {health?.checks?.cache?.message || 'Not checked'}
                                    </Text>
                                    <Tag color={getStatusColor(health?.checks?.cache?.status || 'unknown')}>
                                        {getStatusIcon(health?.checks?.cache?.status || 'unknown')}
                                        {health?.checks?.cache?.status?.toUpperCase()}
                                    </Tag>
                                </Space>
                            </Card>
                        </Col>

                        {/* Servers Health */}
                        <Col xs={24} md={12} lg={8}>
                            <Card>
                                <Statistic
                                    title="Servers"
                                    value={health?.checks?.servers?.message ? parseInt(health.checks.servers.message.split('/')[0]) : 0}
                                    valueStyle={{ color: token.colorPrimary }}
                                    prefix={<CloudServerOutlined />}
                                />
                                <Divider />
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary">
                                        {health?.checks?.servers?.message || 'Not checked'}
                                    </Text>
                                    <Tag color={getStatusColor(health?.checks?.servers?.status || 'unknown')}>
                                        {getStatusIcon(health?.checks?.servers?.status || 'unknown')}
                                        {health?.checks?.servers?.status?.toUpperCase()}
                                    </Tag>
                                </Space>
                            </Card>
                        </Col>

                        {/* Memory Health */}
                        <Col xs={24} md={12} lg={8}>
                            <Card>
                                <Statistic
                                    title="Memory"
                                    value={health?.checks?.memory?.status === 'healthy' ? 100 : 0}
                                    valueStyle={{ color: health?.checks?.memory?.status === 'healthy' ? '#52c41a' : '#ff4d4f' }}
                                    prefix={<SafetyOutlined />}
                                    suffix="%"
                                />
                                <Divider />
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary">
                                        {health?.checks?.memory?.message || 'Not checked'}
                                    </Text>
                                    <Tag color={getStatusColor(health?.checks?.memory?.status || 'unknown')}>
                                        {getStatusIcon(health?.checks?.memory?.status || 'unknown')}
                                        {health?.checks?.memory?.status?.toUpperCase()}
                                    </Tag>
                                </Space>
                            </Card>
                        </Col>

                        {/* Uptime */}
                        <Col xs={24} md={12} lg={8}>
                            <Card>
                                <Statistic
                                    title="System Uptime"
                                    value={getUptime()}
                                    valueStyle={{ color: token.colorPrimaryText }}
                                />
                                <Divider />
                                <Text type="secondary">
                                    Time since last restart
                                </Text>
                            </Card>
                        </Col>

                        {/* Startup Status */}
                        <Col xs={24} md={12} lg={8}>
                            <Card>
                                <Statistic
                                    title="Startup Status"
                                    value={health?.checks?.startup?.status === 'healthy' ? 'Complete' : 'In Progress'}
                                    valueStyle={{ color: health?.checks?.startup?.status === 'healthy' ? '#52c41a' : '#faad14' }}
                                />
                                <Divider />
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text type="secondary">
                                        {health?.checks?.startup?.message || 'N/A'}
                                    </Text>
                                    <Progress
                                        percent={health?.checks?.startup?.status === 'healthy' ? 100 : 50}
                                        status={health?.checks?.startup?.status === 'healthy' ? 'success' : 'active'}
                                    />
                                </Space>
                            </Card>
                        </Col>
                    </Row>
                </Space>
            )}
        </PageContainer>
    );
}

export default HealthDashboardPage;
