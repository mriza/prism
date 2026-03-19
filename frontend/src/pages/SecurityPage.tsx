import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../contexts/AuthContext';
import { 
    Button, 
    Card, 
    Space, 
    Typography, 
    Tag, 
    theme, 
    Row, 
    Col, 
    Table, 
    Input, 
    Alert,
    Statistic,
    Badge,
    Empty
} from 'antd';
import { 
    SafetyOutlined, 
    SafetyCertificateOutlined, 
    CloudServerOutlined, 
    SyncOutlined,
    StopOutlined, 
    LineChartOutlined, 
    GlobalOutlined,
    WarningOutlined,
    SecurityScanOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { FirewallRulesModal } from '../components/security/FirewallRulesModal';
import { PageContainer } from '../components/PageContainer';

const { Text, Paragraph } = Typography;

export function SecurityPage() {
    const { agents, loading, error } = useAgents();
    const [banIp, setBanIp] = useState('');
    const [banDuration, setBanDuration] = useState('4h');
    const [banReason, setBanReason] = useState('');
    const [banning, setBanning] = useState(false);
    const { user, token } = useAuth();
    const { token: antdToken } = theme.useToken();

    // Modal state for Firewall Rules
    const [fwModalOpen, setFwModalOpen] = useState(false);
    const [selectedAgentForFw, setSelectedAgentForFw] = useState<{id: string, name: string, activeFw: string} | null>(null);
    
    // For Option B: Unified Server View, we filter the registered servers
    const registeredServers = useMemo(() => agents.filter((a: any) => a.status !== 'pending'), [agents]);

    const activeFirewalls = useMemo(() => registeredServers.filter((s: any) => {
        const firewalls = s.services?.filter((svc: any) => ['ufw', 'firewalld', 'iptables', 'nftables'].includes(svc.name));
        const activeFw = firewalls?.find((fw: any) => (fw as { metrics?: { is_active: number } }).metrics?.is_active === 1) || firewalls?.[0];
        return activeFw?.status === 'running';
    }).length, [registeredServers]);

    
    const globalAlerts = useMemo(() => registeredServers.reduce((acc: number, server: any) => {
        const cs = server.services?.find((svc: any) => svc.name === 'crowdsec');
        const active = (cs as { metrics?: { active_decisions: number } })?.metrics?.active_decisions || 0;
        return acc + active;
    }, 0), [registeredServers]);

    // CrowdSec Decisions Explorer
    const [decisions, setDecisions] = useState<{ id: string, agent_id: string, agent_name: string, value: string, scenario: string, duration: string }[]>([]);
    const [loadingDecisions, setLoadingDecisions] = useState(false);
    const [unbanningIp, setUnbanningIp] = useState<string | null>(null);

    const fetchDecisions = useCallback(async () => {
        setLoadingDecisions(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/security/decisions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDecisions(data || []);
            }
        } catch (err) {
            console.error("Failed to fetch decisions", err);
        } finally {
            setLoadingDecisions(false);
        }
    }, [token]);

    useEffect(() => {
        // Only fetch if we have online servers
        const hasOnline = registeredServers.some((s: any) => s.status === 'online');
        if (hasOnline) {
            fetchDecisions();
        }
    }, [fetchDecisions, registeredServers]);

    const handleGlobalUnban = async (ip: string) => {
        if (!confirm(`Are you sure you want to globally unban ${ip}?`)) return;
        setUnbanningIp(ip);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/security/unban`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ip })
            });
            if (res.ok) {
                setDecisions(prev => prev.filter(d => d.value !== ip));
            }
        } catch (err) {
            console.error("Failed to unban", err);
        } finally {
            setUnbanningIp(null);
        }
    };

    const handleGlobalBan = async () => {
        if (!banIp) return;
        if (!confirm(`Are you sure you want to globally ban ${banIp} on ALL servers?`)) return;

        setBanning(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/security/ban`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ip: banIp, duration: banDuration, reason: banReason || 'Global ban from dashboard' })
            });
            
            if (!res.ok) throw new Error('Failed to issue global ban');
            
            setBanIp('');
            setBanReason('');
            fetchDecisions();
        } catch (err) {
            console.error(err);
        } finally {
            setBanning(false);
        }
    };

    const decisionColumns = [
        {
            title: 'Target IP',
            dataIndex: 'value',
            key: 'value',
            render: (ip: string) => <Text strong style={{ color: antdToken.colorError, fontFamily: 'monospace' }}>{ip}</Text>
        },
        {
            title: 'Incident Scenario',
            dataIndex: 'scenario',
            key: 'scenario',
            render: (s: string) => <Text style={{ fontSize: '12px' }}>{s}</Text>
        },
        {
            title: 'TTL',
            dataIndex: 'duration',
            key: 'duration',
            render: (d: string) => <Tag color="default" style={{ fontFamily: 'monospace', borderRadius: '4px' }}>{d}</Tag>
        },
        {
            title: 'Enforcement Node',
            key: 'agent',
            render: (_: any, d: any) => (
                <Space>
                    <CloudServerOutlined style={{ opacity: 0.3 }} />
                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>{d.agent_name}</Text>
                </Space>
            )
        },
        {
            title: 'Mitigation',
            key: 'action',
            align: 'right' as const,
            render: (_: any, d: any) => user?.role !== 'user' && (
                <Button 
                    type="link" 
                    danger 
                    size="small" 
                    icon={unbanningIp === d.value ? <SyncOutlined spin /> : <StopOutlined />}
                    disabled={unbanningIp === d.value}
                    onClick={() => handleGlobalUnban(d.value)}
                >
                    Global Unban
                </Button>
            )
        }
    ];

    const infraColumns = [
        {
            title: 'Server Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: any) => <Text strong>{name || record.hostname}</Text>
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const color = status === 'online' ? 'success' : status === 'offline' ? 'error' : 'default';
                return <Badge status={color as any} text={<Text strong style={{ textTransform: 'capitalize' }}>{status}</Text>} />;
            }
        },
        {
            title: 'Firewall Layer',
            key: 'firewall',
            render: (_: any, server: any) => {
                const allFws = server.services?.filter((s: any) => ['ufw', 'firewalld', 'iptables', 'nftables'].includes(s.name)) || [];
                const activeFw = allFws.find((s: any) => (s as { metrics?: { is_active: number } }).metrics?.is_active === 1) || allFws[0];
                const isRunning = activeFw?.status === 'running';
                return (
                    <Space direction="vertical" size={0}>
                        <Tag color={isRunning ? 'blue' : 'default'} style={{ borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                            {activeFw?.status || 'disarmed'}
                        </Tag>
                        {activeFw && <Text type="secondary" style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{activeFw.name}</Text>}
                    </Space>
                );
            }
        },
        {
            title: 'IPS Layer',
            key: 'ips',
            render: (_: any, server: any) => {
                const csSvc = server.services?.find((s: any) => s.name === 'crowdsec');
                const isRunning = csSvc?.status === 'running';
                return (
                    <Tag color={isRunning ? 'gold' : 'default'} style={{ borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                        {csSvc?.status || 'inactive'}
                    </Tag>
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, server: any) => {
                const allFws = server.services?.filter((s: any) => ['ufw', 'firewalld', 'iptables', 'nftables'].includes(s.name)) || [];
                const activeFw = allFws.find((s: any) => (s as { metrics?: { is_active: number } }).metrics?.is_active === 1) || allFws[0];
                return activeFw?.status === 'running' && user?.role !== 'user' && (
                    <Button 
                        icon={<SettingOutlined />} 
                        onClick={() => {
                            setSelectedAgentForFw({
                                id: server.id,
                                name: server.name || server.hostname,
                                activeFw: activeFw.name
                            });
                            setFwModalOpen(true);
                        }}
                    >
                        Configure Rules
                    </Button>
                );
            }
        }
    ];

    return (
        <PageContainer
            title="Security Fleet"
            description="Unified defense layer across your entire infrastructure. Monitor firewalls, manage global blacklists, and respond to threats."
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {error && (
                    <Alert
                        message="Security Alert"
                        description={error}
                        type="error"
                        showIcon
                        closable
                        style={{ borderRadius: '12px' }}
                    />
                )}

                {/* Aggregates Dashboard */}
                <Row gutter={24}>
                    <Col xs={24} md={8}>
                        <Card style={{ borderRadius: '20px', backgroundColor: antdToken.colorBgContainerDisabled }}>
                            <Statistic 
                                title={<Text type="secondary" style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Infrastructure Core</Text>}
                                value={registeredServers.length}
                                suffix={<Text type="secondary" style={{ fontSize: '11px', fontWeight: 700 }}>ACTIVE NODES</Text>}
                                valueStyle={{ fontWeight: 900, fontSize: '32px' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card style={{ borderRadius: '20px', border: `1px solid ${antdToken.colorInfoBorder}` }}>
                            <Statistic 
                                title={<Text style={{ color: antdToken.colorInfo, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Firewall Perimeter</Text>}
                                value={activeFirewalls}
                                suffix={<Text type="secondary" style={{ fontSize: '11px', fontWeight: 700 }}>ACTIVE SHIELDS</Text>}
                                valueStyle={{ fontWeight: 900, fontSize: '32px', color: antdToken.colorInfo }}
                                prefix={<SafetyCertificateOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card style={{ borderRadius: '20px', border: `1px solid ${antdToken.colorWarningBorder}` }}>
                            <Statistic 
                                title={<Text style={{ color: antdToken.colorWarning, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Threat Intelligence</Text>}
                                value={globalAlerts}
                                suffix={<Text type="secondary" style={{ fontSize: '11px', fontWeight: 700 }}>ACTIVE DECISIONS</Text>}
                                valueStyle={{ fontWeight: 900, fontSize: '32px', color: antdToken.colorWarning }}
                                prefix={<WarningOutlined />}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Global Actions */}
                {user?.role !== 'user' && (
                    <Card 
                        title={<Space><SafetyOutlined style={{ color: antdToken.colorError }} /> <Text strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: antdToken.colorError }}>Global Banishment</Text></Space>}
                        style={{ borderRadius: '20px', border: `1px solid ${antdToken.colorErrorBorder}`, backgroundColor: `${antdToken.colorError}05` }}
                    >
                        <Row gutter={24} align="bottom">
                            <Col xs={24} md={6}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text strong style={{ fontSize: '11px' }}>Target IP address</Text>
                                    <Input placeholder="e.g. 1.2.3.4" value={banIp} onChange={e => setBanIp(e.target.value)} />
                                </Space>
                            </Col>
                            <Col xs={24} md={4}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text strong style={{ fontSize: '11px' }}>Ban duration</Text>
                                    <Input placeholder="e.g. 4h, 7d" value={banDuration} onChange={e => setBanDuration(e.target.value)} />
                                </Space>
                            </Col>
                            <Col xs={24} md={8}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Text strong style={{ fontSize: '11px' }}>Policy justification</Text>
                                    <Input placeholder="Reason for ban" value={banReason} onChange={e => setBanReason(e.target.value)} />
                                </Space>
                            </Col>
                            <Col xs={24} md={6}>
                                <Button 
                                    type="primary" 
                                    danger 
                                    block 
                                    icon={<GlobalOutlined />} 
                                    loading={banning} 
                                    disabled={!banIp}
                                    onClick={handleGlobalBan}
                                    style={{ height: '40px', fontWeight: 700 }}
                                >
                                    EXECUTE POLICY
                                </Button>
                            </Col>
                        </Row>
                        <Paragraph type="secondary" style={{ fontSize: '11px', marginTop: '12px', marginBottom: 0 }}>
                            * Deploy a fleet-wide IP ban across all connected infrastructure. This action is recorded and synced globally.
                        </Paragraph>
                    </Card>
                )}

                {/* Decisions Explorer */}
                <Card 
                    title={<Space><LineChartOutlined /> <Text strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Active Bans (CrowdSec Explorer)</Text></Space>}
                    extra={<Button size="small" icon={<SyncOutlined spin={loadingDecisions} />} onClick={fetchDecisions} disabled={loadingDecisions}>Synch Explorer</Button>}
                    bodyStyle={{ padding: 0 }}
                    style={{ borderRadius: '20px', overflow: 'hidden' }}
                >
                    <Table 
                        columns={decisionColumns} 
                        dataSource={decisions.map((d, i) => ({ ...d, key: i }))} 
                        loading={loadingDecisions}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        locale={{ emptyText: <Empty description="Environment Secured. No active threats detected." /> }}
                    />
                </Card>

                {/* Unified Server View */}
                <Card 
                    title={<Space><SecurityScanOutlined /> <Text strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Infrastructure Security Matrix</Text></Space>}
                    bodyStyle={{ padding: 0 }}
                    style={{ borderRadius: '20px', overflow: 'hidden' }}
                >
                    <Table 
                        columns={infraColumns} 
                        dataSource={registeredServers} 
                        loading={loading}
                        rowKey="id"
                        pagination={false}
                    />
                </Card>
            </Space>

            {/* Modals */}
            <FirewallRulesModal
                isOpen={fwModalOpen}
                onClose={() => setFwModalOpen(false)}
                agentId={selectedAgentForFw?.id || ''}
                agentName={selectedAgentForFw?.name || ''}
                activeFirewallName={selectedAgentForFw?.activeFw || ''}
            />
        </PageContainer>
    );
}

export default SecurityPage;
