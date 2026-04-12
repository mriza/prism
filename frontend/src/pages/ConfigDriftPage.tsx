/**
 * ConfigDriftPage - Configuration Drift Detection UI
 * 
 * Features:
 * - View active configuration drifts
 * - Drift statistics dashboard
 * - Resolve drifts
 * - View drift history
 */

import { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Space,
    Tag,
    Typography,
    Alert,
    Badge,
    Descriptions,
    message,
    Popconfirm,
    Select,
    Result
} from 'antd';
import {
    WarningOutlined,
    CheckCircleOutlined,
    ReloadOutlined,
    CloudServerOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { PageContainer, ContentCard, StatCard } from '../components/PageContainer';
import { useAuth } from '../contexts/AuthContext';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ============================================
// Types
// ============================================

interface ConfigDrift {
    id: string;
    agentId: string;
    agentName: string;
    driftType: 'missing_service' | 'extra_service' | 'config_mismatch';
    serviceName: string;
    expected: Record<string, any>;
    actual: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    detectedAt: string;
}

interface DriftStats {
    total: number;
    active: number;
    resolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolutionRate: number;
}

const apiBase = import.meta.env.VITE_API_URL || '';

// ============================================
// ConfigDriftPage Component
// ============================================

export function ConfigDriftPage() {
    const { token } = useAuth();
    const [drifts, setDrifts] = useState<ConfigDrift[]>([]);
    const [stats, setStats] = useState<DriftStats>({
        total: 0, active: 0, resolved: 0, critical: 0, high: 0, medium: 0, low: 0, resolutionRate: 0
    });
    const [loading, setLoading] = useState(false);
    const [filterSeverity, setFilterSeverity] = useState<string>('');

    useEffect(() => {
        fetchDrifts();
        fetchStats();
    }, []);

    const fetchDrifts = async () => {
        setLoading(true);
        try {
            let url = `${apiBase}/api/config-drift`;
            const params = new URLSearchParams();
            if (filterSeverity) params.set('severity', filterSeverity);
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDrifts(data);
            }
        } catch (err) {
            message.error('Failed to fetch configuration drifts');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${apiBase}/api/config-drift/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            // Stats endpoint may not exist yet
            setStats({ total: 0, active: 0, resolved: 0, critical: 0, high: 0, medium: 0, low: 0, resolutionRate: 0 });
        }
    };

    const handleResolve = async (driftId: string) => {
        try {
            const res = await fetch(`${apiBase}/api/config-drift/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ driftId })
            });
            if (res.ok) {
                message.success('Drift marked as resolved');
                fetchDrifts();
                fetchStats();
            }
        } catch (err) {
            message.error('Failed to resolve drift');
        }
    };

    const getSeverityColor = (severity: string): string => {
        switch (severity) {
            case 'critical': return 'red';
            case 'high': return 'orange';
            case 'medium': return 'gold';
            case 'low': return 'blue';
            default: return 'default';
        }
    };

    const getDriftTypeLabel = (type: string): string => {
        switch (type) {
            case 'missing_service': return 'Missing Service';
            case 'extra_service': return 'Extra Service';
            case 'config_mismatch': return 'Config Mismatch';
            default: return type;
        }
    };

    // ============================================
    // Table Columns
    // ============================================

    const columns: ColumnsType<ConfigDrift> = [
        {
            title: 'Agent',
            key: 'agent',
            render: (_: any, record: ConfigDrift) => (
                <Space>
                    <CloudServerOutlined />
                    <div>
                        <Text strong>{record.agentName}</Text>
                        <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{record.agentId}</Text>
                        </div>
                    </div>
                </Space>
            )
        },
        {
            title: 'Drift Type',
            dataIndex: 'driftType',
            key: 'driftType',
            render: (type: string) => (
                <Tag color="purple">{getDriftTypeLabel(type)}</Tag>
            )
        },
        {
            title: 'Service',
            dataIndex: 'serviceName',
            key: 'serviceName',
            render: (name: string) => name ? <Tag>{name}</Tag> : '-'
        },
        {
            title: 'Severity',
            dataIndex: 'severity',
            key: 'severity',
            render: (severity: string) => (
                <Badge
                    status={
                        severity === 'critical' ? 'error' :
                        severity === 'high' ? 'warning' :
                        severity === 'medium' ? 'default' :
                        'processing'
                    }
                    text={severity.charAt(0).toUpperCase() + severity.slice(1)}
                />
            )
        },
        {
            title: 'Detected',
            dataIndex: 'detectedAt',
            key: 'detectedAt',
            render: (date: string) => new Date(date).toLocaleString()
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_: any, record: ConfigDrift) => (
                <Space>
                    {!record.resolved && (
                        <Popconfirm
                            title="Resolve Drift"
                            description="Mark this configuration drift as resolved?"
                            onConfirm={() => handleResolve(record.id)}
                        >
                            <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }}>
                                Resolve
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

    return (
        <PageContainer
            title="Configuration Drift"
            description="Monitor and resolve configuration differences between expected and actual server states."
            extra={
                <Space>
                    <Select
                        placeholder="Filter by severity"
                        allowClear
                        style={{ width: 180 }}
                        value={filterSeverity}
                        onChange={(val) => {
                            setFilterSeverity(val);
                            // Trigger refetch with new filter
                            setTimeout(() => fetchDrifts(), 0);
                        }}
                        options={[
                            { value: 'critical', label: 'Critical' },
                            { value: 'high', label: 'High' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'low', label: 'Low' }
                        ]}
                    />
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            fetchDrifts();
                            fetchStats();
                        }}
                    >
                        Refresh
                    </Button>
                </Space>
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Statistics */}
                {drifts.length > 0 && (
                    <Space style={{ width: '100%', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <StatCard
                                icon={<WarningOutlined />}
                                title="Active Drifts"
                                value={stats.active}
                                trend={stats.active > 0 ? 'down' : 'stable'}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <StatCard
                                icon={<ExclamationCircleOutlined />}
                                title="Critical"
                                value={stats.critical}
                                trend={stats.critical > 0 ? 'down' : 'stable'}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <StatCard
                                icon={<CheckCircleOutlined />}
                                title="Resolved"
                                value={stats.resolved}
                                trend="up"
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <StatCard
                                icon={<ReloadOutlined />}
                                title="Resolution Rate"
                                value={stats.resolutionRate.toFixed(1)}
                                suffix="%"
                                trend={stats.resolutionRate > 80 ? 'up' : 'down'}
                            />
                        </div>
                    </Space>
                )}

                {/* Drifts Table */}
                <ContentCard title="Active Configuration Drifts">
                    {drifts.length === 0 ? (
                        <Result
                            status="success"
                            title="No Configuration Drifts"
                            subTitle="All servers are running their expected configurations."
                            icon={<CheckCircleOutlined />}
                        />
                    ) : (
                        <>
                            <Alert
                                message={`${drifts.length} active drift(s) detected`}
                                description="Review the configuration differences below and resolve drifts to ensure all servers match their expected state."
                                type={drifts.some(d => d.severity === 'critical') ? 'error' : 'warning'}
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Table
                                columns={columns}
                                dataSource={drifts}
                                rowKey="id"
                                loading={loading}
                                pagination={{ pageSize: 10 }}
                                expandable={{
                                    expandedRowRender: (record: ConfigDrift) => (
                                        <Descriptions
                                            bordered
                                            column={2}
                                            size="small"
                                        >
                                            <Descriptions.Item label="Expected">
                                                <pre style={{ margin: 0, fontSize: 12 }}>
                                                    {JSON.stringify(record.expected, null, 2)}
                                                </pre>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Actual">
                                                <pre style={{ margin: 0, fontSize: 12 }}>
                                                    {JSON.stringify(record.actual, null, 2)}
                                                </pre>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Detected At">
                                                {new Date(record.detectedAt).toLocaleString()}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Severity">
                                                <Tag color={getSeverityColor(record.severity)}>
                                                    {record.severity.toUpperCase()}
                                                </Tag>
                                            </Descriptions.Item>
                                        </Descriptions>
                                    )
                                }}
                            />
                        </>
                    )}
                </ContentCard>
            </Space>
        </PageContainer>
    );
}
