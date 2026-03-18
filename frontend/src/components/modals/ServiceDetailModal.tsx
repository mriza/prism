import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Modal, 
    Tabs, 
    Button, 
    Space, 
    Typography, 
    theme, 
    Alert, 
    Row, 
    Col, 
    Card, 
    Statistic, 
    Table, 
    Input,
    Badge,
    Tag,
    Tooltip,
    Divider,
    Form,
    message
} from 'antd';
import { 
    DeleteOutlined,
    LineChartOutlined, 
    DatabaseOutlined, 
    SyncOutlined, 
    PlayCircleOutlined, 
    StopOutlined, 
    ReloadOutlined, 
    SaveOutlined,
    DashboardOutlined,
    HddOutlined,
    ClockCircleOutlined,
    BranchesOutlined,
    SettingOutlined,
    GlobalOutlined,
    SafetyCertificateOutlined,
    CloudDownloadOutlined
} from '@ant-design/icons';
import { useAgents } from '../../hooks/useAgents';
import type { ServiceType } from '../../types';
import { useAccounts } from '../../hooks/useAccounts';
import { useProjects } from '../../hooks/useProjects';
import { Link } from 'react-router-dom';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

interface ProcessInfo {
    id: string;
    name: string;
    status: string;
    cpu?: number;
    memory?: number;
    uptime?: number;
}

interface ServiceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
    serviceName: string;
    serviceLabel: string;
    serviceType: ServiceType;
    status: string;
    metrics?: Record<string, number>;
}

const ServiceTypeIcon = ({ type, size = 18 }: { type: ServiceType, size?: number }) => {
    const style = { fontSize: size };
    switch (type) {
        case 'mongodb':
        case 'mysql':
        case 'postgresql':
            return <DatabaseOutlined style={style} />;
        case 'web-caddy':
        case 'web-nginx':
            return <GlobalOutlined style={style} />;
        case 'rabbitmq':
        case 'mqtt-mosquitto':
            return <SyncOutlined style={style} />;
        case 's3-minio':
        case 's3-garage':
            return <HddOutlined style={style} />;
        case 'firewall':
        case 'security-crowdsec':
            return <SafetyCertificateOutlined style={style} />;
        default:
            return <SettingOutlined style={style} />;
    }
};

export function ServiceDetailModal({ 
    isOpen, 
    onClose, 
    agentId, 
    agentName, 
    serviceName, 
    serviceLabel,
    serviceType,
    status,
    metrics
}: ServiceDetailModalProps) {
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('info');
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);
    const [loadingProcesses, setLoadingProcesses] = useState(false);
    
    // Config state
    const [config, setConfig] = useState<string>('');
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    
    // Shared action state
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { token: authToken } = useAuth();
    const [serviceLogs, setServiceLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Storage state
    const [buckets, setBuckets] = useState<string[]>([]);
    const [loadingBuckets, setLoadingBuckets] = useState(false);
    const [storageUsers, setStorageUsers] = useState<any[]>([]);
    const [loadingStorageUsers, setLoadingStorageUsers] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [creatingBucket, setCreatingBucket] = useState(false);

    // Settings state
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);

    const { 
        getServiceConfig, 
        updateServiceConfig, 
        controlService, 
        listSubProcesses, 
        controlSubProcess,
        listStorageBuckets,
        createStorageBucket,
        deleteStorageBucket,
        listStorageUsers,
        getServiceSettings,
        updateServiceSettings,
        importServiceResources
    } = useAgents();

    const [importLoading, setImportLoading] = useState(false);

    const { accounts } = useAccounts();
    const { projects } = useProjects();
    const { token } = theme.useToken();

    const isOnline = status === 'online' || status === 'running' || status === 'active';
    const isOffline = status === 'offline' || status === 'stopped';

    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'info') loadSettings();
            if (activeTab === 'config') loadConfig();
            if (activeTab === 'processes') loadProcesses();
            if (activeTab === 'activity') loadServiceLogs();
            if (activeTab === 'storage') {
                loadBuckets();
                loadStorageUsers();
            }
        }
    }, [isOpen, activeTab, agentId, serviceName]);

    const loadSettings = async () => {
        if (!['mysql', 'postgresql', 'web-nginx', 'web-caddy', 'mongodb', 'rabbitmq', 'mqtt-mosquitto', 'ftp-vsftpd'].includes(serviceType)) return;
        setLoadingSettings(true);
        try {
            const data = await getServiceSettings(agentId, serviceName);
            if (data) setSettings(data);
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleUpdateSettings = async (values: any) => {
        setUpdatingSettings(true);
        const ok = await updateServiceSettings(agentId, serviceName, values);
        if (ok) {
            message.success('Settings updated and service restarted');
            loadSettings();
        } else {
            message.error('Failed to update settings');
        }
        setUpdatingSettings(false);
    };

    const handleImportService = async () => {
        setImportLoading(true);
        const result = await importServiceResources(agentId, serviceType);
        setImportLoading(false);
        if (result && result.success) {
            message.success(result.message);
        } else {
            message.error('Failed to import resources from server');
        }
    };

    const loadBuckets = async () => {
        setLoadingBuckets(true);
        try {
            const data = await listStorageBuckets(agentId, serviceName);
            if (data) setBuckets(data);
        } finally {
            setLoadingBuckets(false);
        }
    };

    const loadStorageUsers = async () => {
        setLoadingStorageUsers(true);
        try {
            const data = await listStorageUsers(agentId, serviceName);
            if (data) setStorageUsers(data);
        } finally {
            setLoadingStorageUsers(false);
        }
    };

    const handleCreateBucket = async () => {
        if (!newBucketName) return;
        setCreatingBucket(true);
        const ok = await createStorageBucket(agentId, serviceName, newBucketName);
        if (ok) {
            setNewBucketName('');
            loadBuckets();
        }
        setCreatingBucket(false);
    };

    const handleDeleteBucket = async (bucket: string) => {
        if (confirm(`Are you sure you want to delete bucket "${bucket}"?`)) {
            const ok = await deleteStorageBucket(agentId, serviceName, bucket);
            if (ok) loadBuckets();
        }
    };

    const loadServiceLogs = async () => {
        setLoadingLogs(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/logs?agentId=${agentId}&service=${serviceName}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setServiceLogs(data || []);
            }
        } catch (err) {
            console.error("Failed to load service logs:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const loadProcesses = async () => {
        setLoadingProcesses(true);
        try {
            const data = await listSubProcesses(agentId, serviceName);
            if (data) setProcesses(data);
        } finally {
            setLoadingProcesses(false);
        }
    };

    const handleProcessControl = async (processId: string, action: string) => {
        const id = `${processId}-${action}`;
        setActionLoading(id);
        const ok = await controlSubProcess(agentId, serviceName, processId, action);
        if (ok) await loadProcesses();
        setActionLoading(null);
    };

    const loadConfig = async () => {
        setLoadingConfig(true);
        setError(null);
        try {
            const data = await getServiceConfig(agentId, serviceName);
            if (data !== null) {
                setConfig(data);
            } else {
                setError('Failed to load configuration file or service does not support remote configuration.');
            }
        } finally {
            setLoadingConfig(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        setError(null);
        const success = await updateServiceConfig(agentId, serviceName, config);
        if (!success) {
            setError('Failed to save configuration.');
        }
        setSavingConfig(false);
    };

    const handleControl = async (action: string) => {
        setActionLoading(action);
        await controlService(agentId, serviceName, action);
        setActionLoading(null);
    };

    const processColumns = [
        {
            title: 'Process Name',
            key: 'name',
            render: (_: any, proc: any) => {
                const account = accounts.find(a => a.name === proc.name && a.agentId === agentId);
                const project = projects.find(p => p.id === account?.projectId);
                return (
                    <Space direction="vertical" size={0}>
                        <Space>
                            <Text strong>{proc.name}</Text>
                            {project && (
                                <Link to={`/projects/${project.id}`}>
                                    <Tag color="blue" style={{ fontSize: '10px', borderRadius: '4px' }}>{project.name}</Tag>
                                </Link>
                            )}
                        </Space>
                        <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'monospace' }}>PID: {proc.id}</Text>
                    </Space>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const isOnline = status === 'online' || status === 'running' || status === 'active' || status === 'RUNNING';
                return <Badge status={isOnline ? 'success' : 'default'} text={<Text strong style={{ textTransform: 'capitalize' }}>{status}</Text>} />;
            }
        },
        {
            title: 'Resource Usage',
            key: 'usage',
            render: (_: any, proc: any) => (
                <Space size="large">
                    <Tooltip title="CPU Usage">
                        <Space size={4}>
                            <DashboardOutlined style={{ opacity: 0.3 }} />
                            <Text style={{ fontSize: '12px' }}>{proc.cpu?.toFixed(1) || 0}%</Text>
                        </Space>
                    </Tooltip>
                    <Tooltip title="Memory Usage">
                        <Space size={4}>
                            <HddOutlined style={{ opacity: 0.3 }} />
                            <Text style={{ fontSize: '12px' }}>{proc.memory ? `${(proc.memory / (1024 * 1024)).toFixed(1)}MB` : '0MB'}</Text>
                        </Space>
                    </Tooltip>
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, proc: any) => {
                const isRunning = proc.status === 'online' || proc.status === 'running' || proc.status === 'active' || proc.status === 'RUNNING';
                return (
                    <Space size="small">
                        <Button 
                            icon={actionLoading === `${proc.id}-start` ? <SyncOutlined spin /> : <PlayCircleOutlined />} 
                            size="small"
                            type="text"
                            disabled={isRunning || !!actionLoading}
                            onClick={() => handleProcessControl(proc.id, 'start')}
                            style={{ color: isRunning ? undefined : token.colorSuccess }}
                        />
                        <Button 
                            icon={actionLoading === `${proc.id}-stop` ? <SyncOutlined spin /> : <StopOutlined />} 
                            size="small"
                            type="text"
                            disabled={!isRunning || !!actionLoading}
                            onClick={() => handleProcessControl(proc.id, 'stop')}
                            style={{ color: !isRunning ? undefined : token.colorError }}
                        />
                        <Button 
                            icon={actionLoading === `${proc.id}-restart` ? <SyncOutlined spin /> : <ReloadOutlined />} 
                            size="small"
                            type="text"
                            disabled={!!actionLoading}
                            onClick={() => handleProcessControl(proc.id, 'restart')}
                            style={{ color: token.colorPrimary }}
                        />
                    </Space>
                );
            }
        }
    ];

    const tabItems = [
        {
            key: 'info',
            label: <Space><LineChartOutlined /> Overview</Space>,
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Row gutter={[24, 24]}>
                        {['mysql', 'postgresql', 'web-nginx', 'web-caddy', 'mongodb', 'rabbitmq', 'mqtt-mosquitto', 'ftp-vsftpd'].includes(serviceType) && (
                            <Col span={24}>
                                <Card 
                                    title={<Space><SettingOutlined /> Service Settings</Space>}
                                    loading={loadingSettings}
                                    style={{ borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}`, marginBottom: '24px' }}
                                    extra={
                                        <Space>
                                            <Button 
                                                icon={<CloudDownloadOutlined />} 
                                                onClick={handleImportService} 
                                                loading={importLoading}
                                            >
                                                Import from Server
                                            </Button>
                                            <Button 
                                                type="link" 
                                                icon={<ReloadOutlined />} 
                                                onClick={loadSettings}
                                                disabled={loadingSettings}
                                            >
                                                Refresh
                                            </Button>
                                        </Space>
                                    }
                                >
                                    <Form
                                        layout="vertical"
                                        initialValues={settings}
                                        onFinish={handleUpdateSettings}
                                    >
                                        <Row gutter={[16, 16]}>
                                            {/* ===== PORT CONFIGURATION FOR ALL SERVICES ===== */}
                                            <Col span={12}>
                                                <Form.Item
                                                    name="port"
                                                    label={<Text strong style={{ fontSize: '12px' }}>Listen Port</Text>}
                                                    help="Port number this service listens on."
                                                >
                                                    <Input placeholder="e.g. 3306" style={{ borderRadius: '8px' }} />
                                                </Form.Item>
                                            </Col>

                                            {/* ===== BIND ADDRESS FOR NETWORK SERVICES ===== */}
                                            {['mongodb', 'cache-valkey', 'mysql', 'postgresql', 'rabbitmq', 'mqtt-mosquitto'].includes(serviceType) && (
                                                <Col span={12}>
                                                    <Form.Item
                                                        name="bind"
                                                        label={<Text strong style={{ fontSize: '12px' }}>Bind Address</Text>}
                                                        help="IP address to bind to (0.0.0.0 for all interfaces)."
                                                    >
                                                        <Input placeholder="0.0.0.0" style={{ borderRadius: '8px' }} />
                                                    </Form.Item>
                                                </Col>
                                            )}

                                            {/* ===== PATH CONFIGURATION FOR WEB SERVERS ===== */}
                                            {serviceType === 'web-nginx' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="docroot"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Document Root</Text>}
                                                            help="Path to website files directory."
                                                        >
                                                            <Input placeholder="/var/www/html" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="ssl_cert"
                                                            label={<Text strong style={{ fontSize: '12px' }}>SSL Certificate Path</Text>}
                                                            help="Path to TLS/SSL certificate file (.crt or .pem)."
                                                        >
                                                            <Input placeholder="/etc/ssl/certs/server.crt" style={{ borderRadius: '8px', fontFamily: 'monospace' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="ssl_key"
                                                            label={<Text strong style={{ fontSize: '12px' }}>SSL Key Path</Text>}
                                                            help="Path to TLS/SSL private key file."
                                                        >
                                                            <Input placeholder="/etc/ssl/private/server.key" style={{ borderRadius: '8px', fontFamily: 'monospace' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {/* ===== DATABASE SERVICES ===== */}
                                            {serviceType === 'mysql' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="socket"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Socket Path</Text>}
                                                            help="Path to MySQL socket file."
                                                        >
                                                            <Input placeholder="/var/run/mysqld/mysqld.sock" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="datadir"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Data Directory</Text>}
                                                            help="Path to database files."
                                                        >
                                                            <Input placeholder="/var/lib/mysql" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="log_error"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Error Log Path</Text>}
                                                            help="Path to error log file."
                                                        >
                                                            <Input placeholder="/var/log/mysql/error.log" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {serviceType === 'postgresql' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="data_directory"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Data Directory</Text>}
                                                            help="Path to PostgreSQL data directory."
                                                        >
                                                            <Input placeholder="/var/lib/postgresql/data" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="acl_rules"
                                                            label={<Text strong style={{ fontSize: '12px' }}>ACL Rules (pg_hba.conf)</Text>}
                                                            help="Host-based authentication rules. Format: TYPE DATABASE USER ADDRESS METHOD"
                                                        >
                                                            <TextArea 
                                                                rows={6} 
                                                                placeholder={`# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256`}
                                                                style={{ borderRadius: '8px', fontFamily: 'monospace' }}
                                                            />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {serviceType === 'mongodb' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="dbpath"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Data Path</Text>}
                                                            help="Path to database files."
                                                        >
                                                            <Input placeholder="/var/lib/mongodb" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="logpath"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Log Path</Text>}
                                                            help="Path to log file."
                                                        >
                                                            <Input placeholder="/var/log/mongodb/mongod.log" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {/* ===== CACHE SERVICES ===== */}
                                            {serviceType === 'cache-valkey' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="maxmemory"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Max Memory</Text>}
                                                            help="Maximum memory Valkey can use (e.g. 256mb, 1gb)."
                                                        >
                                                            <Input placeholder="256mb" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="maxmemory_policy"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Eviction Policy</Text>}
                                                            help={<span>Policy for evicting keys. See <a href="https://valkey.io/topics/lru-cache/" target="_blank" rel="noopener noreferrer">docs</a>.</span>}
                                                        >
                                                            <Input placeholder="allkeys-lru" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="appendonly"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Append Only File</Text>}
                                                            help="Enable AOF persistence (yes/no)."
                                                        >
                                                            <Input placeholder="yes" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="appendfsync"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Append Fsync</Text>}
                                                            help="How often to fsync the AOF file (always/everysec/no)."
                                                        >
                                                            <Input placeholder="everysec" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="dir"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Working Directory</Text>}
                                                            help="Path where Valkey saves RDB/AOF files."
                                                        >
                                                            <Input placeholder="/var/lib/valkey" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {/* ===== MESSAGE QUEUES ===== */}
                                            {serviceType === 'rabbitmq' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="management_port"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Management Port</Text>}
                                                            help="Port for web management interface."
                                                        >
                                                            <Input placeholder="15672" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="admin_username"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Admin Username</Text>}
                                                            help="Default administrator username."
                                                        >
                                                            <Input placeholder="admin" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="admin_password"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Admin Password</Text>}
                                                            help="Leave blank to keep current password."
                                                        >
                                                            <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="enabled_plugins"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Enabled Plugins</Text>}
                                                            help="Comma-separated list of enabled plugins."
                                                        >
                                                            <Input placeholder="rabbitmq_management,rabbitmq_peer_discovery_localnode" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {serviceType === 'mqtt-mosquitto' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="persistence"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Persistence</Text>}
                                                            help="Enable message persistence (true/false)."
                                                        >
                                                            <Input placeholder="true" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="persistence_location"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Persistence Path</Text>}
                                                            help="Path to store persistent messages."
                                                        >
                                                            <Input placeholder="/var/lib/mosquitto/" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {/* ===== STORAGE (S3) ===== */}
                                            {['s3-minio', 's3-garage'].includes(serviceType) && (
                                                <>
                                                    <Col span={16}>
                                                        <Form.Item
                                                            name="endpoint"
                                                            label={<Text strong style={{ fontSize: '12px' }}>API Endpoint</Text>}
                                                            help="S3 API endpoint URL (e.g. http://localhost:9000)."
                                                        >
                                                            <Input placeholder="http://localhost:9000" style={{ borderRadius: '8px', fontFamily: 'monospace' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={8}>
                                                        <Form.Item
                                                            name="access_key"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Admin Access Key</Text>}
                                                            help="Administrator access key."
                                                        >
                                                            <Input placeholder="minioadmin" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name="secret_key"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Admin Secret Key</Text>}
                                                            help="Leave blank to keep current secret."
                                                        >
                                                            <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}

                                            {/* ===== FTP SERVICES ===== */}
                                            {serviceType === 'ftp-vsftpd' && (
                                                <>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="anonymous_enable"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Anonymous Enable</Text>}
                                                            help="Allow anonymous FTP login (YES/NO)."
                                                        >
                                                            <Input placeholder="NO" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="local_enable"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Local Enable</Text>}
                                                            help="Allow local users to login (YES/NO)."
                                                        >
                                                            <Input placeholder="YES" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="write_enable"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Write Enable</Text>}
                                                            help="Allow write operations (YES/NO)."
                                                        >
                                                            <Input placeholder="YES" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            name="local_root"
                                                            label={<Text strong style={{ fontSize: '12px' }}>Local Root</Text>}
                                                            help="Path to FTP root directory."
                                                        >
                                                            <Input placeholder="/var/ftp" style={{ borderRadius: '8px' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </>
                                            )}
                                        </Row>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={updatingSettings}
                                            style={{ borderRadius: '8px', marginTop: '16px' }}
                                        >
                                            Save Settings
                                        </Button>
                                    </Form>
                                </Card>
                            </Col>
                        )}

                        <Col span={24} style={{ marginBottom: '32px' }}>
                            <Card style={{ backgroundColor: token.colorFillAlter, borderRadius: '16px', border: `1px solid ${token.colorBorderSecondary}` }}>
                                <Row align="middle" justify="space-between">
                                    <Col>
                                        <Space size="large">
                                            <Badge status={isOnline ? 'success' : isOffline ? 'default' : 'error'} />
                                            <div>
                                                <Title level={4} style={{ margin: 0 }}>{status.toUpperCase()}</Title>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>Service is currently {status}.</Text>
                                            </div>
                                        </Space>
                                    </Col>
                                    <Col>
                                        <Space>
                                            <Button 
                                                type="primary" 
                                                icon={actionLoading === 'start' ? <SyncOutlined spin /> : <PlayCircleOutlined />} 
                                                disabled={isOnline || !!actionLoading}
                                                onClick={() => handleControl('start')}
                                                style={{ backgroundColor: isOnline ? undefined : token.colorSuccess, border: 'none' }}
                                            >
                                                Start
                                            </Button>
                                            <Button 
                                                danger 
                                                icon={actionLoading === 'stop' ? <SyncOutlined spin /> : <StopOutlined />} 
                                                disabled={isOffline || !!actionLoading}
                                                onClick={() => handleControl('stop')}
                                            >
                                                Stop
                                            </Button>
                                            <Button 
                                                icon={actionLoading === 'restart' ? <SyncOutlined spin /> : <ReloadOutlined />} 
                                                disabled={!!actionLoading}
                                                onClick={() => handleControl('restart')}
                                            >
                                                Restart
                                            </Button>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>
                        </Col>

                        <Col span={24}>
                            <Divider orientation={"left" as any} style={{ margin: '0 0 24px 0' }}>
                                <Text strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Live Metrics</Text>
                            </Divider>
                            {metrics && Object.keys(metrics).length > 0 ? (
                                <Row gutter={[16, 16]}>
                                    {Object.entries(metrics).map(([key, rawVal]) => {
                                        const val = Number(rawVal);
                                        const isMem = key.includes('memory') || key.includes('rss');
                                        const isCpu = key.includes('cpu');
                                        const isUp = key.includes('uptime');
                                        
                                        if (key === 'is_active' || key === 'is_enabled') return null;

                                        let suffix = "";
                                        let displayVal = val;
                                        let icon = <LineChartOutlined />;
                                        
                                        if (isMem) {
                                            displayVal = Number((val / (1024 * 1024)).toFixed(1));
                                            suffix = "MB";
                                            icon = <HddOutlined />;
                                        } else if (isCpu) {
                                            displayVal = Number(val.toFixed(1));
                                            suffix = "%";
                                            icon = <DashboardOutlined />;
                                        } else if (isUp) {
                                            displayVal = Number((val / 3600).toFixed(1));
                                            suffix = "h";
                                            icon = <ClockCircleOutlined />;
                                        }

                                        return (
                                            <Col xs={24} sm={12} md={8} key={key}>
                                                <Card style={{ borderRadius: '12px', border: `1px solid ${token.colorBorderSecondary}` }} bodyStyle={{ padding: '20px' }}>
                                                    <Statistic 
                                                        title={<Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800 }}>{key.replace(/_/g, ' ')}</Text>}
                                                        value={displayVal}
                                                        suffix={<Text type="secondary" style={{ fontSize: '12px' }}>{suffix}</Text>}
                                                        prefix={icon}
                                                        valueStyle={{ fontWeight: 700, fontSize: '20px' }}
                                                    />
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            ) : (
                                <Card style={{ textAlign: 'center', padding: '40px', border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter, borderRadius: '16px' }}>
                                    <Space direction="vertical" align="center">
                                        <LineChartOutlined style={{ fontSize: '32px', opacity: 0.1 }} />
                                        <Text type="secondary" italic>No active telemetry metrics reported.</Text>
                                    </Space>
                                </Card>
                            )}
                        </Col>
                    </Row>
                </div>
            )
        },
        {
            key: 'config',
            label: <Space><SettingOutlined /> Configuration</Space>,
            children: (
                <div style={{ padding: '24px 0' }}>
                    <div style={{ marginBottom: '24px' }}>
                        {loadingConfig ? (
                            <div style={{ textAlign: 'center', padding: '60px' }}>
                                <SyncOutlined spin style={{ fontSize: '24px', color: token.colorPrimary }} />
                                <Paragraph style={{ marginTop: '16px' }}>Fetching configuration...</Paragraph>
                            </div>
                        ) : (
                            <TextArea 
                                value={config}
                                onChange={(e) => setConfig(e.target.value)}
                                style={{ 
                                    fontFamily: 'monospace', 
                                    fontSize: '12px', 
                                    height: '400px', 
                                    borderRadius: '12px',
                                    backgroundColor: token.colorFillAlter
                                }}
                                spellCheck={false}
                            />
                        )}
                    </div>
                    <Alert
                        message="Configuration Policy"
                        description="Updating the configuration will automatically reload the service to apply changes."
                        type="info"
                        showIcon
                        style={{ borderRadius: '12px', marginBottom: '24px' }}
                    />
                    <Button 
                        type="primary" 
                        icon={<SaveOutlined />} 
                        loading={savingConfig} 
                        onClick={handleSaveConfig}
                        block
                        size="large"
                        style={{ borderRadius: '12px', fontWeight: 600 }}
                    >
                        Deploy Configuration
                    </Button>
                </div>
            )
        },
        {
            key: 'processes',
            label: <Space><BranchesOutlined /> Processes</Space>,
            disabled: !['pm2', 'supervisor', 'systemd'].includes(serviceType),
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Table 
                        dataSource={processes}
                        columns={processColumns}
                        loading={loadingProcesses}
                        rowKey="id"
                        pagination={{ pageSize: 5, hideOnSinglePage: true }}
                    />
                </div>
            )
        },
        {
            key: 'activity',
            label: <Space><ClockCircleOutlined /> Activity</Space>,
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Table 
                        dataSource={serviceLogs}
                        loading={loadingLogs}
                        rowKey="id"
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        columns={[
                            {
                                title: 'Time',
                                dataIndex: 'createdAt',
                                key: 'time',
                                width: 180,
                                render: (t: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{new Date(t).toLocaleString()}</Text>
                            },
                            {
                                title: 'Event',
                                key: 'event',
                                render: (_: any, log: any) => (
                                    <Space direction="vertical" size={0}>
                                        <Text strong style={{ fontSize: '13px' }}>{log.type.replace(/_/g, ' ')}</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>{log.message}</Text>
                                    </Space>
                                )
                            },
                            {
                                title: 'Status',
                                dataIndex: 'status',
                                key: 'status',
                                width: 100,
                                render: (s: string) => {
                                    const isOk = s === 'online' || s === 'running' || s === 'active' || s === 'success';
                                    return <Badge status={isOk ? 'success' : 'default'} text={s} />;
                                }
                            }
                        ]}
                    />
                </div>
            )
        },
        {
            key: 'storage',
            label: <Space><HddOutlined /> Storage</Space>,
            disabled: !['s3-minio', 's3-garage'].includes(serviceType),
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Row gutter={[24, 24]}>
                        <Col span={24}>
                            <Card title="Buckets" size="small" extra={
                                <Space>
                                    <Input 
                                        placeholder="New bucket name" 
                                        size="small" 
                                        value={newBucketName} 
                                        onChange={(e) => setNewBucketName(e.target.value)}
                                        onPressEnter={handleCreateBucket}
                                    />
                                    <Button type="primary" size="small" onClick={handleCreateBucket} loading={creatingBucket}>Create</Button>
                                </Space>
                            }>
                                <Table 
                                    dataSource={buckets.map(b => ({ name: b }))}
                                    loading={loadingBuckets}
                                    columns={[
                                        { title: 'Bucket Name', dataIndex: 'name', key: 'name' },
                                        { 
                                            title: 'Actions', 
                                            key: 'actions', 
                                            align: 'right' as const,
                                            render: (_: any, record: any) => (
                                                <Button 
                                                    type="text" 
                                                    danger 
                                                    icon={<DeleteOutlined />} 
                                                    onClick={() => handleDeleteBucket(record.name)}
                                                />
                                            )
                                        }
                                    ]}
                                    pagination={{ pageSize: 5, hideOnSinglePage: true }}
                                    size="small"
                                />
                            </Card>
                        </Col>
                        <Col span={24}>
                            <Card title="Access Keys" size="small">
                                <Table 
                                    dataSource={storageUsers}
                                    loading={loadingStorageUsers}
                                    columns={[
                                        { title: 'Access Key (ID)', dataIndex: 'access_key', key: 'access_key' },
                                        { 
                                            title: 'Actions', 
                                            key: 'actions', 
                                            align: 'right' as const,
                                            render: (_: any, record: any) => (
                                                <Button 
                                                    type="text" 
                                                    danger 
                                                    icon={<DeleteOutlined />} 
                                                    // Add delete user logic if needed, agent supports it
                                                    onClick={async () => {
                                                        if (confirm(`Delete access key ${record.access_key}?`)) {
                                                            // We need to implement deleteStorageUser in useAgents
                                                            // For now let's just alert
                                                            alert("User deletion not yet wired to UI - call agent.DeleteUser directly.");
                                                        }
                                                    }}
                                                />
                                            )
                                        }
                                    ]}
                                    pagination={{ pageSize: 5, hideOnSinglePage: true }}
                                    size="small"
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>
            )
        }
    ];

    return (
        <Modal
            title={
                <Space size="middle">
                    <div style={{ 
                        padding: '8px', 
                        borderRadius: '10px', 
                        backgroundColor: `${token.colorPrimary}15`, 
                        color: token.colorPrimary,
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <ServiceTypeIcon type={serviceType} />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>{serviceLabel}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {serviceName} • {agentName}
                        </Text>
                    </div>
                </Space>
            }
            open={isOpen}
            onCancel={onClose}
            width={900}
            footer={null}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            {error && (
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: '24px', borderRadius: '12px' }}
                />
            )}

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab} 
                items={tabItems}
                style={{ marginTop: '16px' }}
            />
        </Modal>
    );
}
