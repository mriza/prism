import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAgents } from '../hooks/useAgents';
import { handleError } from '../utils/log';
import { useAccounts } from '../hooks/useAccounts';
import { useProjects } from '../hooks/useProjects';
import { Link } from 'react-router-dom';
import { 
    Button, 
    Card, 
    Table, 
    Tag, 
    Input, 
    Space, 
    Typography, 
    Tooltip, 
    Badge, 
    Dropdown, 
    theme,
    Empty
} from 'antd';
import { 
    ReloadOutlined, 
    SearchOutlined, 
    PlusOutlined, 
    PlayCircleOutlined, 
    StopOutlined, 
    SyncOutlined, 
    DeleteOutlined, 
    ExportOutlined,
    CloudServerOutlined,
    DashboardOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import { PageContainer } from '../components/PageContainer';
import { ProcessDiscoveryModal } from '../components/modals/ProcessDiscoveryModal';

const { Text } = Typography;

interface ProcessItem {
    id: string;
    name: string;
    status: string;
    cpu?: string;
    memory?: string;
    uptime?: string;
    agentId: string;
    agentName: string;
    manager: string; // pm2, supervisor, systemd
    projectId?: string;
    projectName?: string;
    projectColor?: string;
}

export function ProcessesPage() {
    const { agents, listSubProcesses, controlSubProcess, loading: agentsLoading, unregisterService, refreshAgents } = useAgents();
    const { accounts } = useAccounts();
    const { projects } = useProjects();
    const { token } = theme.useToken();

    const [allProcesses, setAllProcesses] = useState<ProcessItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Discovery modal state
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);

    const initialized = useRef(false);

    const fetchAllProcesses = useCallback(async (isInitial = false) => {
        if (agentsLoading && agents.length === 0) return;
        
        if (isInitial) setLoading(true);
        else setScanning(true);

        const procs: ProcessItem[] = [];

        for (const agent of agents) {
            const processManagers = agent.services.filter((s: any) => 
                ['pm2', 'supervisor', 'systemd'].includes(s.name)
            );

            for (const pm of processManagers) {
                await handleError(
                    async () => {
                        const subs = await listSubProcesses(agent.id, pm.name);
                        if (subs) {
                            subs.forEach((sub: any) => {
                                const account = accounts.find(a => a.name === sub.name && a.agentId === agent.id);
                                const project = account ? projects.find(p => p.id === account.projectId) : null;

                                procs.push({
                                    ...sub,
                                    agentId: agent.id,
                                    agentName: agent.name || agent.hostname,
                                    manager: pm.name,
                                    projectId: project?.id,
                                    projectName: project?.name,
                                    projectColor: project?.color
                                });
                            });
                        }
                    },
                    `Failed to fetch processes from ${pm.name} on ${agent.name || agent.hostname}`,
                    { showToast: false }
                );
            }
        }

        setAllProcesses(procs);
        setLoading(false);
        setScanning(false);
    }, [agents, agentsLoading, accounts, projects, listSubProcesses]);

    useEffect(() => {
        if (!initialized.current && !agentsLoading && agents.length > 0) {
            initialized.current = true;
            fetchAllProcesses(true);
        }
    }, [agents, agentsLoading, fetchAllProcesses]);

    const filteredProcesses = useMemo(() => {
        return allProcesses.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allProcesses, searchQuery]);

    const handleControl = async (agentId: string, manager: string, processId: string, action: string) => {
        const loadingKey = `${agentId}-${processId}-${action}`;
        setActionLoading(loadingKey);
        try {
            await controlSubProcess(agentId, manager, processId, action);
            setAllProcesses(prev => prev.map(p => {
                if (p.agentId === agentId && p.id === processId) {
                    return { ...p, status: action === 'stop' ? 'stopped' : 'online' };
                }
                return p;
            }));
        } finally {
            setActionLoading(null);
        }
    };

    const columns = [
        {
            title: 'Application / Process',
            key: 'name',
            render: (_: any, p: ProcessItem) => (
                <Space size="middle">
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: token.borderRadius,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: p.manager === 'pm2' ? token.colorSuccessBg : p.manager === 'supervisor' ? token.colorWarningBg : token.colorInfoBg,
                        color: p.manager === 'pm2' ? token.colorSuccess : p.manager === 'supervisor' ? token.colorWarning : token.colorInfo,
                        border: `1px solid ${p.manager === 'pm2' ? token.colorSuccessBorder : p.manager === 'supervisor' ? token.colorWarningBorder : token.colorInfoBorder}`
                    }}>
                        <DashboardOutlined style={{ fontSize: token.fontSizeLG }} />
                    </div>
                    <div>
                        <Text strong style={{ display: 'block' }}>{p.name}</Text>
                        <Text type="secondary" style={{ fontSize: token.fontSize, textTransform: 'uppercase' }}>{p.id}</Text>
                    </div>
                </Space>
            )
        },
        {
            title: 'Environment',
            key: 'environment',
            render: (_: any, p: ProcessItem) => (
                <Space direction="vertical" size={0}>
                    <Text style={{ fontSize: token.fontSize }}><CloudServerOutlined style={{ marginRight: token.marginXXS, opacity: 0.5 }} />{p.agentName}</Text>
                    <Text type="secondary" style={{ fontSize: token.fontSize, textTransform: 'uppercase' }}>Managed by {p.manager}</Text>
                </Space>
            )
        },
        {
            title: 'Project context',
            key: 'project',
            render: (_: any, p: ProcessItem) => p.projectId ? (
                <Link to={`/projects/${p.projectId}`}>
                    <Tag
                        color={p.projectColor === 'primary' ? 'blue' : p.projectColor === 'success' ? 'green' : p.projectColor}
                        style={{ cursor: 'pointer', borderRadius: token.borderRadiusSM }}
                        icon={<ExportOutlined />}
                    >
                        {p.projectName}
                    </Tag>
                </Link>
            ) : (
                <Text type="secondary" italic style={{ fontSize: token.fontSize }}>Independent</Text>
            )
        },
        {
            title: 'Performance',
            key: 'performance',
            render: (_: any, p: ProcessItem) => (
                <Space size="large">
                    {p.cpu && (
                        <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: token.fontSize, textTransform: 'uppercase' }}>CPU</Text>
                            <Text strong style={{ fontSize: token.fontSize, fontFamily: 'monospace' }}>{p.cpu}</Text>
                        </Space>
                    )}
                    {p.memory && (
                        <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: token.fontSize, textTransform: 'uppercase' }}>MEM</Text>
                            <Text strong style={{ fontSize: token.fontSize, fontFamily: 'monospace' }}>{p.memory}</Text>
                        </Space>
                    )}
                </Space>
            )
        },
        {
            title: 'Operations',
            key: 'status',
            render: (_: any, p: ProcessItem) => {
                const isRunning = ['online', 'running', 'active', 'UP'].includes(p.status);
                return <Badge status={isRunning ? 'success' : 'default'} text={<Text strong style={{ textTransform: 'capitalize' }}>{p.status}</Text>} />;
            }
        },
        {
            title: 'Management',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, p: ProcessItem) => {
                const isRunning = ['online', 'running', 'active', 'UP'].includes(p.status);
                const actionId = (action: string) => `${p.agentId}-${p.id}-${action}`;
                
                return (
                    <Space>
                        <Tooltip title="Start">
                            <Button 
                                type="text" 
                                size="small"
                                icon={actionLoading === actionId('start') ? <LoadingOutlined /> : <PlayCircleOutlined />} 
                                disabled={isRunning || !!actionLoading}
                                onClick={() => handleControl(p.agentId, p.manager, p.id, 'start')}
                            />
                        </Tooltip>
                        <Tooltip title="Restart">
                            <Button 
                                type="text" 
                                size="small"
                                icon={actionLoading === actionId('restart') ? <LoadingOutlined /> : <SyncOutlined />} 
                                disabled={!!actionLoading}
                                onClick={() => handleControl(p.agentId, p.manager, p.id, 'restart')}
                            />
                        </Tooltip>
                        <Tooltip title="Stop">
                            <Button 
                                type="text" 
                                size="small"
                                danger
                                icon={actionLoading === actionId('stop') ? <LoadingOutlined /> : <StopOutlined />} 
                                disabled={!isRunning || !!actionLoading}
                                onClick={() => handleControl(p.agentId, p.manager, p.id, 'stop')}
                            />
                        </Tooltip>

                        {p.manager === 'systemd' && (
                            <Tooltip title="Unregister">
                                <Button 
                                    type="text" 
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />} 
                                    onClick={async () => {
                                        if (confirm(`Remove ${p.name} from managed processes?`)) {
                                            await unregisterService(p.agentId, p.name);
                                            setAllProcesses(prev => prev.filter(proc => !(proc.agentId === p.agentId && proc.name === p.name)));
                                        }
                                    }}
                                />
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        }
    ];

    const agentMenu = {
        items: agents.map(a => ({
            key: a.id,
            label: a.name || a.hostname,
            icon: <CloudServerOutlined />
        })),
        onClick: ({ key }: any) => {
            const agent = agents.find(a => a.id === key);
            if (agent) {
                setSelectedAgent({ id: agent.id, name: agent.name || agent.hostname });
                setIsDiscoveryOpen(true);
            }
        }
    };

    return (
        <PageContainer
            title="Managed Processes"
            description="Centrally manage all application runtimes managed by PM2, Supervisor, and Systemd."
            extra={
                <Space>
                    <Button 
                        icon={<ReloadOutlined spin={scanning} />} 
                        onClick={() => fetchAllProcesses(false)}
                        disabled={scanning || loading}
                    >
                        Sync Fleet
                    </Button>
                    <Dropdown menu={agentMenu} placement="bottomRight">
                        <Button type="primary" icon={<PlusOutlined />}>Register Process</Button>
                    </Dropdown>
                </Space>
            }
        >
            <div style={{ marginBottom: token.marginLG }}>
                <Input
                    placeholder="Search processes, agents, or projects..."
                    prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                    size="large"
                    style={{ borderRadius: token.borderRadiusLG, maxWidth: '100%' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}>
                <Table 
                    columns={columns} 
                    dataSource={filteredProcesses} 
                    loading={loading || agentsLoading}
                    rowKey={(p) => `${p.agentId}-${p.manager}-${p.id}`}
                    pagination={{ pageSize: 15, hideOnSinglePage: true }}
                    locale={{ emptyText: <Empty description="No active processes detected across your fleet" /> }}
                />
            </Card>

            {/* Reuse existing Discovery Modal */}
            {/* The Discovery Modal should ideally be migrated too if it uses custom UI */}
            {/* But for now we just keep the integration */}
            
            <ProcessDiscoveryModal
                isOpen={isDiscoveryOpen}
                onClose={() => {
                    setIsDiscoveryOpen(false);
                    setSelectedAgent(null);
                    refreshAgents(); // Refresh to show newly registered processes
                }}
                agentId={selectedAgent?.id || ''}
                agentName={selectedAgent?.name || ''}
            />
        </PageContainer>
    );
}

export default ProcessesPage;
