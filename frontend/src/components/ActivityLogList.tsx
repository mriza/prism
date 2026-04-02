import React from 'react';
import { List, Typography, Tag, Space, Empty, theme } from 'antd';
import { 
    InfoCircleOutlined, 
    CheckCircleOutlined, 
    SyncOutlined, 
    ExclamationCircleOutlined,
    ClockCircleOutlined 
} from '@ant-design/icons';
import type { Event } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface Props {
    events: Event[];
    loading?: boolean;
    limit?: number;
}

export const ActivityLogList: React.FC<Props> = ({ events, loading, limit = 50 }) => {
    const { token } = theme.useToken();

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'running':
            case 'active':
            case 'success':
            case 'online':
                return <CheckCircleOutlined style={{ color: token.colorSuccess }} />;
            case 'stopped':
            case 'offline':
                return <ClockCircleOutlined style={{ color: token.colorTextSecondary }} />;
            case 'error':
            case 'failed':
            case 'critical':
                return <ExclamationCircleOutlined style={{ color: token.colorError }} />;
            case 'warning':
                return <ExclamationCircleOutlined style={{ color: token.colorWarning }} />;
            case 'syncing':
            case 'starting':
            case 'restarting':
                return <SyncOutlined spin style={{ color: token.colorInfo }} />;
            default:
                return <InfoCircleOutlined style={{ color: token.colorInfo }} />;
        }
    };

    const getStatusTag = (status: string) => {
        switch (status.toLowerCase()) {
            case 'running':
            case 'active':
            case 'success':
            case 'online':
                return <Tag color="success">{status.toUpperCase()}</Tag>;
            case 'error':
            case 'failed':
            case 'critical':
                return <Tag color="error">{status.toUpperCase()}</Tag>;
            case 'warning':
                return <Tag color="warning">{status.toUpperCase()}</Tag>;
            default:
                return <Tag>{status.toUpperCase()}</Tag>;
        }
    };

    if (!loading && events.length === 0) {
        return (
            <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="No recent activity recorded" 
                style={{ margin: '40px 0' }}
            />
        );
    }

    return (
        <List
            loading={loading}
            dataSource={events.slice(0, limit)}
            renderItem={(item) => (
                <List.Item 
                    style={{ 
                        padding: '12px 16px', 
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        backgroundColor: item.status === 'error' ? `${token.colorError}05` : 'transparent'
                    }}
                >
                    <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <Space align="center" size="middle">
                                {getStatusIcon(item.status)}
                                <Text strong style={{ fontSize: token.fontSize }}>
                                    {item.service.toUpperCase()}
                                </Text>
                                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                    on {item.agentName || item.agentId}
                                </Text>
                                {getStatusTag(item.status)}
                            </Space>
                            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                {dayjs(item.createdAt).fromNow()}
                            </Text>
                        </div>
                        <div style={{ paddingLeft: 32 }}>
                            <Text type={item.status === 'error' ? 'danger' : 'secondary'} style={{ fontSize: token.fontSizeSM }}>
                                {item.message}
                            </Text>
                        </div>
                    </div>
                </List.Item>
            )}
        />
    );
};
