import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Typography,
    Button,
    Table,
    Tag,
    Space,
    Input,
    Popconfirm,
    message,
    Empty,
    theme,
    Tabs,
    Card,
    Badge,
    Tooltip,
    Dropdown,
} from 'antd';
import {
    PlusOutlined,
    SearchOutlined,
    RocketOutlined,
    DeleteOutlined,
    EditOutlined,
    GithubOutlined,
    GlobalOutlined,
    CloudUploadOutlined,
    ReloadOutlined,
    PlayCircleOutlined,
    StopOutlined,
    SyncOutlined,
    ExportOutlined,
    CloudServerOutlined,
    DashboardOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { PageContainer } from '../components/PageContainer';
import { DeploymentFormModal } from '../components/modals/DeploymentFormModal';
import { ProcessDiscoveryModal } from '../components/modals/ProcessDiscoveryModal';
import { useDeployments } from '../hooks/useDeployments';
import { useAgents } from '../hooks/useAgents';
import { useAccounts } from '../hooks/useAccounts';
import { useProjects } from '../hooks/useProjects';
import type { Deployment } from '../hooks/useDeployments';

const { Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
    active: 'green',
    deploying: 'blue',
    failed: 'red',
    stopped: 'default',
};

const RUNTIME_LABELS: Record<string, string> = {
    nodejs: 'Node.js',
    python: 'Python',
    php: 'PHP',
    go: 'Go',
    binary: 'Binary',
};

interface ProcessItem {
    id: string;
    name: string;
    status: string;
    cpu?: string;
    memory?: string;
    uptime?: string;
    agentId: string;
    agentName: string;
    manager: string;
    projectId?: string;
    projectName?: string;
    projectColor?: string;
}

export function ApplicationsPage() {
    const { token } = theme.useToken();

    // ── HOOKS ──────────────────────────────────────────────────────────────
    const { deployments, loading: deploymentsLoading, createDeployment, updateDeployment, deleteDeployment, triggerDeploy } = useDeployments();
    const { agents, listSubProcesses, controlSubProcess, loading: agentsLoading, unregisterService, refreshAgents } = useAgents();
    const { accounts } = useAccounts();
    const { projects } = useProjects();

    // ── DEPLOYMENTS STATE ──────────────────────────────────────────────────
    const [deplModalOpen, setDeplModalOpen] = useState(false);
    const [editingDeployment, setEditingDeployment] = useState<Deployment | undefined>();
    const [deplSearch, setDeplSearch] = useState('');

    // ── PROCESSES STATE ────────────────────────────────────────────────────
    const [allProcesses, setAllProcesses] = useState<ProcessItem[]>([]);
    const [procsLoading, setProcsLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [procsSearch, setProcsSearch] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);
    const initialized = useRef(false);

    // ── DERIVED DATA ───────────────────────────────────────────────────────
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

    const filteredDeployments = deployments.filter(d =>
        !deplSearch ||
        d.name.toLowerCase().includes(deplSearch.toLowerCase()) ||
        d.domainName?.toLowerCase().includes(deplSearch.toLowerCase()) ||
        d.sourceUrl.toLowerCase().includes(deplSearch.toLowerCase())
    );

    const filteredProcesses = useMemo(() =>
        allProcesses.filter(p =>
            p.name.toLowerCase().includes(procsSearch.toLowerCase()) ||
            p.agentName.toLowerCase().includes(procsSearch.toLowerCase()) ||
            p.projectName?.toLowerCase().includes(procsSearch.toLowerCase())
        ),
        [allProcesses, procsSearch]
    );

    // ── PROCESSES LOGIC ────────────────────────────────────────────────────
    const fetchAllProcesses = useCallback(async (isInitial = false) => {
        if (agentsLoading && agents.length === 0) return;

        if (isInitial) setProcsLoading(true);
        else setScanning(true);

        const procs: ProcessItem[] = [];

        for (const agent of agents) {
            const processManagers = agent.services.filter((s: any) =>
                ['pm2', 'supervisor', 'systemd'].includes(s.name)
            );
            for (const pm of processManagers) {
                try {
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
                                projectColor: project?.color,
                            });
                        });
                    }
                } catch {
                    // skip failed agents silently
                }
            }
        }

        setAllProcesses(procs);
        setProcsLoading(false);
        setScanning(false);
    }, [agents, agentsLoading, accounts, projects, listSubProcesses]);

    useEffect(() => {
        if (!initialized.current && !agentsLoading && agents.length > 0) {
            initialized.current = true;
            fetchAllProcesses(true);
        }
    }, [agents, agentsLoading, fetchAllProcesses]);

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

    // ── COLUMNS ────────────────────────────────────────────────────────────
    const deploymentColumns = [
        {
            title: 'Application',
            key: 'name',
            render: (_: unknown, record: Deployment) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{record.name}</Text>
                    {record.description && <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{record.description}</Text>}
                </Space>
            ),
        },
        {
            title: 'Project',
            key: 'project',
            render: (_: unknown, record: Deployment) => {
                const project = projectMap[record.projectId];
                return project ? <Tag>{project.name}</Tag> : <Text type="secondary">—</Text>;
            },
        },
        {
            title: 'Runtime',
            key: 'runtime',
            render: (_: unknown, record: Deployment) => (
                <Space>
                    <Tag color="blue">{RUNTIME_LABELS[record.runtime] || record.runtime}</Tag>
                    {record.runtimeVersion && <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{record.runtimeVersion}</Text>}
                </Space>
            ),
        },
        {
            title: 'Process Manager',
            dataIndex: 'processManager',
            key: 'pm',
            render: (pm: string) => <Tag>{pm.toUpperCase()}</Tag>,
        },
        {
            title: 'Domain',
            key: 'domain',
            render: (_: unknown, record: Deployment) => record.domainName ? (
                <Space>
                    <GlobalOutlined />
                    <Text copyable style={{ fontSize: token.fontSizeSM }}>{record.domainName}</Text>
                </Space>
            ) : <Text type="secondary">—</Text>,
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: unknown, record: Deployment) => (
                <Tag color={STATUS_COLORS[record.status] || 'default'}>{record.status.toUpperCase()}</Tag>
            ),
        },
        {
            title: 'Version',
            key: 'revision',
            render: (_: unknown, record: Deployment) => record.lastDeployedRevision ? (
                <Text code style={{ fontSize: token.fontSizeSM }}>{record.lastDeployedRevision}</Text>
            ) : <Text type="secondary">—</Text>,
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: Deployment) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        icon={<CloudUploadOutlined />}
                        loading={record.status === 'deploying'}
                        onClick={async () => {
                            const ok = await triggerDeploy(record.id);
                            if (ok) message.success(`Deploying ${record.name}...`);
                            else message.error('Failed to trigger deployment');
                        }}
                    >
                        Deploy
                    </Button>
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingDeployment(record);
                            setDeplModalOpen(true);
                        }}
                    />
                    <Button
                        type="text"
                        size="small"
                        icon={<GithubOutlined />}
                        onClick={() => window.open(record.sourceUrl, '_blank')}
                    />
                    <Popconfirm
                        title="Delete this deployment?"
                        onConfirm={async () => {
                            await deleteDeployment(record.id);
                            message.success('Deployment deleted');
                        }}
                    >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const processColumns = [
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
                        border: `1px solid ${p.manager === 'pm2' ? token.colorSuccessBorder : p.manager === 'supervisor' ? token.colorWarningBorder : token.colorInfoBorder}`,
                    }}>
                        <DashboardOutlined style={{ fontSize: token.fontSizeLG }} />
                    </div>
                    <div>
                        <Text strong style={{ display: 'block' }}>{p.name}</Text>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>{p.id}</Text>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Environment',
            key: 'environment',
            render: (_: any, p: ProcessItem) => (
                <Space direction="vertical" size={0}>
                    <Text style={{ fontSize: token.fontSizeSM }}><CloudServerOutlined style={{ marginRight: token.marginXXS, opacity: 0.5 }} />{p.agentName}</Text>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>Managed by {p.manager}</Text>
                </Space>
            ),
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
                <Text type="secondary" italic style={{ fontSize: token.fontSizeSM }}>Independent</Text>
            ),
        },
        {
            title: 'Performance',
            key: 'performance',
            render: (_: any, p: ProcessItem) => (
                <Space size="large">
                    {p.cpu && (
                        <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>CPU</Text>
                            <Text strong style={{ fontSize: token.fontSizeSM, fontFamily: 'monospace' }}>{p.cpu}</Text>
                        </Space>
                    )}
                    {p.memory && (
                        <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>MEM</Text>
                            <Text strong style={{ fontSize: token.fontSizeSM, fontFamily: 'monospace' }}>{p.memory}</Text>
                        </Space>
                    )}
                </Space>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, p: ProcessItem) => {
                const isRunning = ['online', 'running', 'active', 'UP'].includes(p.status);
                return <Badge status={isRunning ? 'success' : 'default'} text={<Text strong style={{ textTransform: 'capitalize' }}>{p.status}</Text>} />;
            },
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
            },
        },
    ];

    const agentMenu = {
        items: agents.map(a => ({
            key: a.id,
            label: a.name || a.hostname,
            icon: <CloudServerOutlined />,
        })),
        onClick: ({ key }: any) => {
            const agent = agents.find(a => a.id === key);
            if (agent) {
                setSelectedAgent({ id: agent.id, name: agent.name || agent.hostname });
                setIsDiscoveryOpen(true);
            }
        },
    };

    // ── RENDER ─────────────────────────────────────────────────────────────
    return (
        <PageContainer
            title="Applications"
            description="Manage Git deployments and process runtimes across your infrastructure."
        >
            <Tabs
                defaultActiveKey="deployments"
                size="large"
                items={[
                    {
                        key: 'deployments',
                        label: <Space><RocketOutlined />Git Deployments</Space>,
                        children: (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginLG }}>
                                    <Input
                                        placeholder="Search deployments..."
                                        prefix={<SearchOutlined />}
                                        value={deplSearch}
                                        onChange={e => setDeplSearch(e.target.value)}
                                        style={{ width: 280 }}
                                        allowClear
                                    />
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => { setEditingDeployment(undefined); setDeplModalOpen(true); }}
                                    >
                                        New Deployment
                                    </Button>
                                </div>
                                <Table
                                    dataSource={filteredDeployments}
                                    columns={deploymentColumns}
                                    rowKey="id"
                                    loading={deploymentsLoading}
                                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No deployments yet. Create your first deployment!" /> }}
                                    pagination={{ pageSize: 15, showSizeChanger: true }}
                                />
                            </div>
                        ),
                    },
                    {
                        key: 'processes',
                        label: <Space><DashboardOutlined />Managed Processes</Space>,
                        children: (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginLG }}>
                                    <Input
                                        placeholder="Search processes, agents, or projects..."
                                        prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                                        style={{ width: 340 }}
                                        value={procsSearch}
                                        onChange={e => setProcsSearch(e.target.value)}
                                    />
                                    <Space>
                                        <Button
                                            icon={<ReloadOutlined spin={scanning} />}
                                            onClick={() => fetchAllProcesses(false)}
                                            disabled={scanning || procsLoading}
                                        >
                                            Sync Fleet
                                        </Button>
                                        <Dropdown menu={agentMenu} placement="bottomRight">
                                            <Button type="primary" icon={<PlusOutlined />}>Register Process</Button>
                                        </Dropdown>
                                    </Space>
                                </div>
                                <Card
                                    styles={{ body: { padding: 0 } }}
                                    style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}
                                >
                                    <Table
                                        columns={processColumns}
                                        dataSource={filteredProcesses}
                                        loading={procsLoading || agentsLoading}
                                        rowKey={(p) => `${p.agentId}-${p.manager}-${p.id}`}
                                        pagination={{ pageSize: 15, hideOnSinglePage: true }}
                                        locale={{ emptyText: <Empty description="No active processes detected across your fleet" /> }}
                                    />
                                </Card>
                            </div>
                        ),
                    },
                ]}
            />

            {/* Modals rendered outside Tabs to avoid unmounting on tab switch */}
            <DeploymentFormModal
                isOpen={deplModalOpen}
                onClose={() => { setDeplModalOpen(false); setEditingDeployment(undefined); }}
                onSave={async (data) => {
                    if (editingDeployment) {
                        await updateDeployment(editingDeployment.id, data);
                        message.success('Deployment updated');
                    } else {
                        await createDeployment(data);
                        message.success('Deployment created');
                    }
                }}
                initial={editingDeployment}
            />
            <ProcessDiscoveryModal
                isOpen={isDiscoveryOpen}
                onClose={() => { setIsDiscoveryOpen(false); setSelectedAgent(null); refreshAgents(); }}
                agentId={selectedAgent?.id || ''}
                agentName={selectedAgent?.name || ''}
            />
        </PageContainer>
    );
}

export default ApplicationsPage;
