import { useState, useEffect, useCallback } from 'react';
import { handleError } from '../utils/log';
import {
    Table,
    Tag,
    Typography,
    Space,
    Card,
    Button,
    theme,
    Badge,
    Empty
} from 'antd';
import { 
    ReloadOutlined, 
    ClockCircleOutlined, 
    CloudServerOutlined,
    InfoCircleOutlined,
    ExclamationCircleOutlined,
    BugOutlined
} from '@ant-design/icons';
import { PageContainer } from '../components/PageContainer';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface LogEvent {
    id: string;
    agentId: string;
    agentName: string;
    type: string;
    service: string;
    status: string;
    message: string;
    createdAt: string;
}

export function LogsPage() {
    const [logs, setLogs] = useState<LogEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const { token: authToken } = useAuth();
    const { token } = theme.useToken();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const data = await handleError(
            async () => {
                const apiBase = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiBase}/api/logs?limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch logs');
                return await res.json();
            },
            'Failed to fetch logs',
            { showToast: false }
        );
        if (data) {
            setLogs(data);
        }
        setLoading(false);
    }, [authToken]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'running':
            case 'online':
            case 'success':
            case 'up':
                return 'success';
            case 'stopped':
            case 'offline':
            case 'error':
            case 'down':
            case 'failed':
                return 'error';
            case 'warning':
                return 'warning';
            default:
                return 'default';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'service_status_change':
                return <ClockCircleOutlined style={{ color: token.colorPrimary }} />;
            case 'system_event':
                return <InfoCircleOutlined style={{ color: token.colorInfo }} />;
            case 'security_alert':
                return <ExclamationCircleOutlined style={{ color: token.colorError }} />;
            default:
                return <BugOutlined />;
        }
    };

    const columns = [
        {
            title: 'Timestamp',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (date: string) => (
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: token.fontSize }}>{dayjs(date).format('HH:mm:ss')}</Text>
                    <Text type="secondary" style={{ fontSize: token.fontSize }}>{dayjs(date).format('MMM DD, YYYY')}</Text>
                </Space>
            )
        },
        {
            title: 'Origin',
            dataIndex: 'agentName',
            key: 'agentName',
            width: 150,
            render: (name: string, record: LogEvent) => (
                <Space>
                    <CloudServerOutlined style={{ opacity: 0.5 }} />
                    <Text strong style={{ fontSize: token.fontSize }}>{name || record.agentId.substring(0, 8)}</Text>
                </Space>
            )
        },
        {
            title: 'Event Type',
            dataIndex: 'type',
            key: 'type',
            width: 180,
            render: (type: string) => (
                <Space>
                    {getTypeIcon(type)}
                    <Text style={{ fontSize: token.fontSize, textTransform: 'capitalize' }}>
                        {type.replace(/_/g, ' ')}
                    </Text>
                </Space>
            )
        },
        {
            title: 'Subject',
            key: 'subject',
            width: 150,
            render: (_: any, record: LogEvent) => record.service ? (
                <Tag color="blue" style={{ borderRadius: token.borderRadiusSM, fontWeight: token.fontWeightStrong }}>
                    {record.service}
                </Tag>
            ) : <Text type="secondary">-</Text>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => status ? (
                <Badge status={getStatusColor(status) as any} text={<Text strong style={{ textTransform: 'capitalize', fontSize: token.fontSize }}>{status}</Text>} />
            ) : null
        },
        {
            title: 'Message',
            dataIndex: 'message',
            key: 'message',
            render: (msg: string) => (
                <Text type="secondary" style={{ fontSize: token.fontSize }}>{msg}</Text>
            )
        }
    ];

    return (
        <PageContainer
            title="Activity Logs"
            description="Real-time timeline of events and state changes reported by all connected agents."
            extra={
                <Button 
                    icon={<ReloadOutlined spin={loading} />} 
                    onClick={fetchLogs}
                    disabled={loading}
                >
                    Refresh
                </Button>
            }
        >
            <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}>
                <Table 
                    columns={columns} 
                    dataSource={logs} 
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 15, hideOnSinglePage: true }}
                    locale={{ emptyText: <Empty description="Archive is empty. No events recorded yet." /> }}
                />
            </Card>
        </PageContainer>
    );
}

export default LogsPage;
