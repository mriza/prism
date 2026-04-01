import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { useAgents } from '../hooks/useAgents';
import { AccountFormModal } from '../components/modals/AccountFormModal';
import { ProjectFormModal } from '../components/modals/ProjectFormModal';
import { 
    Button, 
    Card, 
    Row, 
    Col, 
    Typography, 
    Space, 
    Tag, 
    Badge, 
    Tabs, 
    Tooltip, 
    Empty, 
    theme, 
    Descriptions,
    Alert
} from 'antd';
import {
    ArrowLeftOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    LoadingOutlined,
    StopOutlined,
    BranchesOutlined,
    CaretRightOutlined,
    KeyOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    CheckOutlined,
    CopyOutlined,
    CloudServerOutlined
} from '@ant-design/icons';
import type { ServiceAccount } from '../types';
import { PageContainer } from '../components/PageContainer';
import { SERVICE_TYPE_LABELS } from '../types';

const { Text } = Typography;

export function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { projects, updateProject, deleteProject } = useProjects();
    const { accountsByProject, createAccount, updateAccount, deleteAccount, deleteAccountsByProject, provisionAccount } = useAccounts();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { agents, controlService, controlSubProcess, listSubProcesses } = useAgents();
    const { token } = theme.useToken();

    const [projectProcesses, setProjectProcesses] = useState<any[]>([]);
    const [loadingInfra, setLoadingInfra] = useState(false);
    const [infraActionLoading, setInfraActionLoading] = useState<string | null>(null);

    const project = projects.find(p => p.id === id);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [editAccount, setEditAccount] = useState<ServiceAccount | null>(null);
    const [showEditProject, setShowEditProject] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [provisioningId, setProvisioningId] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const fetchProjectInfra = async () => {
        if (!project) return;
        setLoadingInfra(true);
        const allProcs: any[] = [];
        const accounts = accountsByProject(project.id);
        
        for (const agent of agents) {
            for (const svc of agent.services) {
                const account = accounts.find(a => a.name === svc.name && a.agentId === agent.id);
                if (account) {
                    allProcs.push({
                        id: svc.name,
                        name: svc.name,
                        status: svc.status,
                        agentId: agent.id,
                        agentName: agent.name || agent.hostname,
                        type: 'service',
                        serviceName: svc.name
                    });
                }

                if (svc.name === 'pm2' || svc.name === 'supervisor' || svc.name === 'systemd') {
                     const subs = await listSubProcesses(agent.id, svc.name);
                     if (subs) {
                         subs.forEach((sub: any) => {
                             const subAccount = accounts.find(a => a.name === sub.name && a.agentId === agent.id);
                             if (subAccount) {
                                 allProcs.push({
                                     ...sub,
                                     agentId: agent.id,
                                     agentName: agent.name || agent.hostname,
                                     type: 'process',
                                     serviceName: svc.name
                                 });
                             }
                         });
                     }
                }
            }
        }
        setProjectProcesses(allProcs);
        setLoadingInfra(false);
    };

    useEffect(() => {
        fetchProjectInfra();
    }, [id, agents.length]);

    if (!project) {
        return (
            <div style={{ padding: `${token.paddingXL * 2}px 0`, textAlign: 'center' }}>
                <Empty description="Project not found" />
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>Back to Projects</Button>
            </div>
        );
    }

    const accounts = accountsByProject(project.id);

    const handleInfraControl = async (agentId: string, service: string, action: string, processId?: string) => {
        const id = processId ? `${agentId}-${processId}-${action}` : `${agentId}-${service}-${action}`;
        setInfraActionLoading(id);
        try {
            if (processId) {
                await controlSubProcess(agentId, service, processId, action);
            } else {
                await controlService(agentId, service, action);
            }
            await fetchProjectInfra();
        } finally {
            setInfraActionLoading(null);
        }
    };

    return (
        <PageContainer 
            title={project.name}
            description={project.description || "Project orchestration and asset management."}
            breadcrumb={[
                { title: <Link to="/projects">Projects</Link> },
                { title: project.name }
            ]}
            extra={
                user?.role !== 'user' && (
                    <Space>
                        <Button icon={<EditOutlined />} onClick={() => setShowEditProject(true)}>Edit Project</Button>
                        <Button danger icon={<DeleteOutlined />} onClick={() => {
                            if (confirm(`Delete project "${project.name}" and all its accounts?`)) {
                                deleteAccountsByProject(project.id);
                                deleteProject(project.id);
                                navigate('/projects');
                            }
                        }}>Delete</Button>
                    </Space>
                )
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Stats Header */}
                <Card
                    bodyStyle={{ padding: token.paddingLG }}
                    style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorBgLayout} 100%)` }}
                >
                    <Row gutter={48}>
                        <Col span={6}>
                            <Descriptions column={1}>
                                <Descriptions.Item label={<Text strong style={{ color: token.colorTextDisabled, textTransform: 'uppercase', fontSize: token.fontSizeSM }}>Total Assets</Text>}>
                                    <Text strong style={{ fontSize: token.fontSizeHeading3 }}>{accounts.length}</Text>
                                </Descriptions.Item>
                            </Descriptions>
                        </Col>
                        <Col span={6}>
                            <Descriptions column={1}>
                                <Descriptions.Item label={<Text strong style={{ color: token.colorTextDisabled, textTransform: 'uppercase', fontSize: token.fontSizeSM }}>Active Nodes</Text>}>
                                    <Text strong style={{ fontSize: token.fontSizeHeading3 }}>{[...new Set(accounts.map(a => a.agentId))].length}</Text>
                                </Descriptions.Item>
                            </Descriptions>
                        </Col>
                        <Col span={12}>
                    <Descriptions column={1}>
                        <Descriptions.Item label={<Text strong style={{ color: token.colorTextDisabled, textTransform: 'uppercase', fontSize: token.fontSizeSM }}>Created At</Text>}>
                            <Text style={{ fontSize: token.fontSize }}>{new Date(project.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</Text>
                        </Descriptions.Item>
                    </Descriptions>
                        </Col>
                    </Row>
                </Card>

                <Tabs
                    defaultActiveKey="infrastructure"
                    items={[
                        {
                            key: 'infrastructure',
                            label: (
                                <Space>
                                    <BranchesOutlined />
                                    <span>Infrastructure</span>
                                    {loadingInfra && <ReloadOutlined spin style={{ fontSize: token.fontSizeSM, opacity: 0.5 }} />}
                                </Space>
                            ),
                            children: (
                                <div style={{ padding: `${token.paddingXS}px 0` }}>
                                    {projectProcesses.length === 0 && !loadingInfra ? (
                                        <Empty description="No active services detected for this project group" />
                                    ) : (
                                        <Row gutter={[16, 16]}>
                                            {projectProcesses.map(proc => {
                                                const isRunning = ['online', 'running', 'active', 'UP'].includes(proc.status);
                                                const actionId = (action: string) => proc.type === 'process' ? `${proc.agentId}-${proc.id}-${action}` : `${proc.agentId}-${proc.serviceName}-${action}`;

                                                return (
                                                    <Col xs={24} md={12} lg={8} key={`${proc.agentId}-${proc.id}-${proc.type}`}>
                                                        <Card hoverable size="small" style={{ borderRadius: token.borderRadiusLG }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                                <Space direction="vertical" size={0}>
                                                                    <Space>
                                                                        <Badge status={isRunning ? 'success' : 'default'} />
                                                                        <Text strong style={{ fontSize: token.fontSize }}>{proc.name}</Text>
                                                                    </Space>
                                                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'flex', alignItems: 'center', gap: token.marginXXS, marginTop: token.marginXXS }}>
                                                                        <CloudServerOutlined style={{ fontSize: token.fontSizeSM }} /> {proc.agentName}
                                                                    </Text>
                                                                    <Tag style={{ marginTop: token.marginSM, fontSize: token.fontSizeSM, textTransform: 'uppercase' }} color={proc.type === 'process' ? 'blue' : 'purple'}>
                                                                        {proc.type === 'process' ? `${proc.serviceName} app` : proc.serviceName}
                                                                    </Tag>
                                                                </Space>
                                                                <div className="infra-controls">
                                                                    <Space.Compact direction="vertical" size="small">
                                                                        <Tooltip title="Start">
                                                                            <Button 
                                                                                icon={infraActionLoading === actionId('start') ? <LoadingOutlined /> : <CaretRightOutlined />} 
                                                                                disabled={isRunning || !!infraActionLoading}
                                                                                onClick={() => handleInfraControl(proc.agentId, proc.serviceName, 'start', proc.type === 'process' ? proc.id : undefined)}
                                                                            />
                                                                        </Tooltip>
                                                                        <Tooltip title="Restart">
                                                                            <Button 
                                                                                icon={infraActionLoading === actionId('restart') ? <LoadingOutlined /> : <ReloadOutlined />} 
                                                                                disabled={!!infraActionLoading}
                                                                                onClick={() => handleInfraControl(proc.agentId, proc.serviceName, 'restart', proc.type === 'process' ? proc.id : undefined)}
                                                                            />
                                                                        </Tooltip>
                                                                        <Tooltip title="Stop">
                                                                            <Button 
                                                                                danger
                                                                                icon={infraActionLoading === actionId('stop') ? <LoadingOutlined /> : <StopOutlined />} 
                                                                                disabled={!isRunning || !!infraActionLoading}
                                                                                onClick={() => handleInfraControl(proc.agentId, proc.serviceName, 'stop', proc.type === 'process' ? proc.id : undefined)}
                                                                            />
                                                                        </Tooltip>
                                                                    </Space.Compact>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </Col>
                                                );
                                            })}
                                        </Row>
                                    )}
                                </div>
                            )
                        },
                        {
                            key: 'accounts',
                            label: (
                                <Space>
                                    <KeyOutlined />
                                    <span>Service Accounts</span>
                                </Space>
                            ),
                            children: (
                                <div style={{ padding: `${token.paddingXS}px 0` }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: token.marginSM }}>
                                        {user?.role !== 'user' && (
                                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddAccount(true)}>Add Account</Button>
                                        )}
                                    </div>

                                    {accounts.length === 0 ? (
                                        <Empty description="No service accounts linked to this project" />
                                    ) : (
                                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                            {accounts.map(a => {
                                                const type = a.type.toLowerCase();
                                                const isDb = type.includes('mongodb') || type.includes('mysql') || type.includes('postgresql');
                                                const isStorage = type.includes('s3') || type.includes('minio');
                                                const isMQTT = type.includes('mqtt');
                                                const isFTP = type.includes('ftp');

                                                return (
                                                    <Card
                                                        key={a.id}
                                                        style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG }}
                                                        bodyStyle={{ padding: token.paddingLG }}
                                                    >
                                                        <Row gutter={24} align="middle">
                                                            <Col flex="0 0 300px">
                                                                <Space direction="vertical" size={2}>
                                                                    <Text strong style={{ fontSize: token.fontSizeHeading5 }}>{a.name}</Text>
                                                                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '1px' }}>{SERVICE_TYPE_LABELS[a.type]}</Text>
                                                                    <Space style={{ marginTop: token.marginSM }}>
                                                                        <Tag icon={<CloudServerOutlined />} style={{ borderRadius: token.borderRadiusSM }}>{a.agentId || 'External'}</Tag>
                                                                        {a.host && <Tag style={{ borderRadius: token.borderRadiusSM }}>{a.host}:{a.port}</Tag>}
                                                                    </Space>
                                                                </Space>
                                                            </Col>

                                                            <Col flex="auto">
                                                                {/* Connection Strings and Credentials */}
                                                                <Space direction="vertical" style={{ width: '100%' }}>
                                                                    {isDb && a.username && a.password && a.host && (
                                                                        <Alert
                                                                            style={{ padding: `${token.paddingXS}px ${token.paddingSM}` }}
                                                                            message={
                                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                    <code style={{ fontSize: token.fontSizeSM, color: token.colorSuccess }}>
                                                                                        {type.includes('mongodb') 
                                                                                            ? `mongodb://${a.username}:${showPasswords[a.id] ? a.password : '••••••••'}@${a.host}:${a.port || 27017}/${a.database}`
                                                                                            : `${a.type.split('-')[0]}://${a.username}:${showPasswords[a.id] ? a.password : '••••••••'}@${a.host}:${a.port}/${a.database}`
                                                                                        }
                                                                                    </code>
                                                                                    <Space>
                                                                                        <Button type="text" size="small" icon={showPasswords[a.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => togglePassword(a.id)} />
                                                                                        <Button 
                                                                                            type="text" 
                                                                                            size="small" 
                                                                                            icon={copiedId === a.id ? <CheckOutlined style={{ color: token.colorSuccess }} /> : <CopyOutlined />} 
                                                                                            onClick={async () => {
                                                                                                const prefix = type.includes('mongodb') ? 'mongodb' : a.type.split('-')[0];
                                                                                                const uri = `${prefix}://${encodeURIComponent(a.username!)}:${encodeURIComponent(a.password!)}@${a.host}:${a.port || (prefix === 'mongodb' ? 27017 : 3306)}/${encodeURIComponent(a.database!)}`;
                                                                                                await navigator.clipboard.writeText(uri);
                                                                                                setCopiedId(a.id);
                                                                                                setTimeout(() => setCopiedId(null), 2000);
                                                                                            }}
                                                                                        />
                                                                                    </Space>
                                                                                </div>
                                                                            }
                                                                        />
                                                                    )}

                                                                    {isStorage && (
                                                                        <Descriptions size="small" column={2} bordered style={{ background: token.colorBgContainer }}>
                                                                            <Descriptions.Item label="Access Key" labelStyle={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>
                                                                                <code style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{a.accessKey}</code>
                                                                            </Descriptions.Item>
                                                                            <Descriptions.Item label="Secret Key" labelStyle={{ fontSize: token.fontSizeSM, textTransform: 'uppercase' }}>
                                                                                <Space>
                                                                                    <code style={{ fontSize: token.fontSizeSM, fontWeight: 600 }}>{showPasswords[a.id] ? a.secretKey : '••••••••••••••••'}</code>
                                                                                    <Button type="text" size="small" icon={showPasswords[a.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => togglePassword(a.id)} />
                                                                                </Space>
                                                                            </Descriptions.Item>
                                                                        </Descriptions>
                                                                    )}
                                                                </Space>
                                                            </Col>

                                                            <Col flex="0 0 120px">
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                                    {user?.role !== 'user' && (
                                                                        <Space>
                                                                            {(isDb || isStorage || isMQTT || isFTP) && (
                                                                                <Tooltip title="Provision on Agent">
                                                                                    <Button 
                                                                                        type="text" 
                                                                                        icon={provisioningId === a.id ? <LoadingOutlined /> : <ReloadOutlined />} 
                                                                                        onClick={async () => {
                                                                                            setProvisioningId(a.id);
                                                                                            try {
                                                                                                let action = '';
                                                                                                let options: any = {};
                                                                                                if (isDb) {
                                                                                                    action = 'db_create_user';
                                                                                                    options = { username: type.includes('mongodb') ? `${a.username}@${a.database}` : a.username, password: a.password, role: a.role || (type.includes('mongodb') ? 'readWrite' : 'ALL PRIVILEGES'), target: a.targetEntity };
                                                                                                } else if (isStorage) {
                                                                                                    await provisionAccount(a.agentId!, 'storage_create_user', { access_key: a.accessKey, secret_key: a.secretKey });
                                                                                                    action = 'storage_create_bucket';
                                                                                                    options = { name: a.bucket };
                                                                                                } else if (isMQTT) {
                                                                                                    action = 'mq_create_user';
                                                                                                    options = { username: a.username, password: a.password };
                                                                                                } else if (isFTP) {
                                                                                                    action = 'ftp_create_user';
                                                                                                    options = { username: a.username, password: a.password, root_path: a.rootPath };
                                                                                                }
                                                                                                if (action) await provisionAccount(a.agentId!, action, options);
                                                                                            } finally {
                                                                                                setProvisioningId(null);
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                </Tooltip>
                                                                            )}
                                                                            <Tooltip title="Edit">
                                                                                <Button type="text" icon={<EditOutlined />} onClick={() => setEditAccount(a)} />
                                                                            </Tooltip>
                                                                            <Tooltip title="Delete">
                                                                                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => { if (confirm(`Delete account "${a.name}"?`)) deleteAccount(a.id); }} />
                                                                            </Tooltip>
                                                                        </Space>
                                                                    )}
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                    </Card>
                                                );
                                            })}
                                        </Space>
                                    )}
                                </div>
                            )
                        }
                    ]}
                />
            </Space>

            <AccountFormModal
                isOpen={showAddAccount}
                onClose={() => setShowAddAccount(false)}
                onSave={data => createAccount(data)}
                category="project"
                projectId={project.id}
            />
            {editAccount && (
                <AccountFormModal
                    isOpen={true}
                    onClose={() => setEditAccount(null)}
                    onSave={data => updateAccount(editAccount.id, data)}
                    initial={editAccount}
                />
            )}
            {showEditProject && (
                <ProjectFormModal
                    isOpen
                    onClose={() => setShowEditProject(false)}
                    onSave={data => { updateProject(project.id, data); setShowEditProject(false); }}
                    initial={project}
                />
            )}
        </PageContainer>
    );
}

