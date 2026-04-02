import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Modal,
    Tabs,
    Button,
    Space,
    Typography,
    theme,
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
    Descriptions,
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
    DashboardOutlined,
    HddOutlined,
    ClockCircleOutlined,
    BranchesOutlined,
    SettingOutlined,
    GlobalOutlined,
    SafetyCertificateOutlined,
    CloudDownloadOutlined,
    KeyOutlined,
    ThunderboltOutlined,
    RocketOutlined
} from '@ant-design/icons';
import { useAgents } from '../../hooks/useAgents';
import type { ServiceType } from '../../types';
import { useAccounts } from '../../hooks/useAccounts';
import { useProjects } from '../../hooks/useProjects';
import { Link } from 'react-router-dom';
import { ManagementCredentialsTab } from '../services/ManagementCredentialsTab';

const { Text, Title } = Typography;
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
    serviceId: string;
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
        case 'valkey-nosql':
            return <DatabaseOutlined style={style} />;
        case 'valkey-broker':
            return <ThunderboltOutlined style={style} />;
        case 'valkey-cache':
            return <RocketOutlined style={style} />;
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
    serviceId,
    serviceName, 
    serviceLabel,
    serviceType,
    status,
    metrics
}: ServiceDetailModalProps) {
    const [activeTab, setActiveTab] = useState('info');
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);
    const [loadingProcesses, setLoadingProcesses] = useState(false);

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
    const [form] = Form.useForm();

    const {
        controlService,
        listSubProcesses,
        controlSubProcess,
        listStorageBuckets,
        createStorageBucket,
        deleteStorageBucket,
        listStorageUsers,
        getServiceSettings,
        updateServiceSettings,
    } = useAgents();

    const [importLoading, setImportLoading] = useState(false);

    // Fields shown per service type in the overview read-only table
    const SETTINGS_DISPLAY_FIELDS: Record<string, string[]> = {
        'web-nginx':       ['port', 'docroot', 'ssl_cert', 'ssl_key'],
        'web-caddy':       ['port'],
        'mysql':           ['port', 'socket', 'datadir', 'log_error'],
        'postgresql':      ['port', 'bind', 'data_directory', 'acl_rules'],
        'mongodb':         ['port', 'bind', 'dbpath', 'logpath'],
        'rabbitmq':        ['port', 'bind', 'management_port', 'admin_username', 'enabled_plugins'],
        'mqtt-mosquitto':  ['port', 'bind', 'persistence', 'persistence_location'],
        'valkey-cache':    ['port', 'bind', 'maxmemory', 'maxmemory_policy', 'appendonly', 'appendfsync', 'dir'],
        'valkey-broker':   ['port', 'bind', 'maxmemory', 'maxmemory_policy', 'appendonly', 'appendfsync', 'dir'],
        'valkey-nosql':    ['port', 'bind', 'maxmemory', 'maxmemory_policy', 'appendonly', 'appendfsync', 'dir'],
        's3-minio':        ['endpoint', 'access_key'],
        's3-garage':       ['endpoint', 'access_key'],
        'ftp-vsftpd':      ['port', 'anonymous_enable', 'local_enable', 'write_enable', 'local_root'],
        'ftp-sftpgo':      ['port', 'bind_address', 'log_level', 'data_provider_type'],
        'pm2':             ['instances', 'max_memory_restart', 'out_file', 'error_file'],
        'supervisor':      ['logfile', 'logfile_maxbytes', 'logfile_backups', 'nodaemon', 'minfds'],
    };

    const { accounts } = useAccounts();
    const { projects } = useProjects();
    const { token } = theme.useToken();

    const isOnline = status === 'online' || status === 'running' || status === 'active';
    const isOffline = status === 'offline' || status === 'stopped';

    useEffect(() => {
        if (isOpen) {
            // Load settings on open (for overview read-only display) and when config tab is active
            if (activeTab === 'info' || activeTab === 'config') loadSettings();
            if (activeTab === 'processes') loadProcesses();
            if (activeTab === 'activity') loadServiceLogs();
            if (activeTab === 'storage') {
                loadBuckets();
                loadStorageUsers();
            }
        }
    }, [isOpen, activeTab, agentId, serviceName]);

    const loadSettings = async () => {
        setLoadingSettings(true);
        try {
            const data = await getServiceSettings(agentId, serviceName);
            if (data) {
                setSettings(data);
                form.setFieldsValue(data);
            }
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
        const data = await getServiceSettings(agentId, serviceName);
        setImportLoading(false);
        if (data) {
            setSettings(data);
            form.setFieldsValue(data);
            message.success('Configuration imported from server');
        } else {
            message.error('Failed to import configuration from server');
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
                                    <Tag color="blue" style={{ fontSize: token.fontSizeSM, borderRadius: token.borderRadiusSM }}>{project.name}</Tag>
                                </Link>
                            )}
                        </Space>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontFamily: 'monospace' }}>PID: {proc.id}</Text>
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
                            <Text style={{ fontSize: token.fontSizeSM }}>{proc.cpu?.toFixed(1) || 0}%</Text>
                        </Space>
                    </Tooltip>
                    <Tooltip title="Memory Usage">
                        <Space size={4}>
                            <HddOutlined style={{ opacity: 0.3 }} />
                            <Text style={{ fontSize: token.fontSizeSM }}>{proc.memory ? `${(proc.memory / (1024 * 1024)).toFixed(1)}MB` : '0MB'}</Text>
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
                <div style={{ padding: `${token.paddingLG}px 0` }}>
                    <Row gutter={[24, 24]}>
                        {/* ===== SERVICE DESCRIPTION ===== */}
                        <Col span={24}>
                            <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                                <Space direction="vertical" size={4}>
                                    <Text strong>About this Service</Text>
                                    <Text type="secondary">{({
                                        'web-nginx': 'Nginx is a high-performance HTTP and reverse proxy server, widely used for serving static files, load balancing, and TLS termination.',
                                        'web-caddy': 'Caddy is a modern, automatic HTTPS web server with built-in TLS certificate management via Let\'s Encrypt.',
                                        'mysql': 'MySQL is a widely-used relational database management system known for reliability and ease of use in web applications.',
                                        'postgresql': 'PostgreSQL is a powerful open-source relational database with advanced features including full-text search, JSON support, and ACID compliance.',
                                        'mongodb': 'MongoDB is a document-oriented NoSQL database designed for scalability and developer flexibility using JSON-like documents.',
                                        'rabbitmq': 'RabbitMQ is a message broker that implements the AMQP protocol, enabling reliable asynchronous messaging between services.',
                                        'mqtt-mosquitto': 'Eclipse Mosquitto is a lightweight MQTT broker designed for IoT and machine-to-machine communication.',
                                        'valkey-cache': 'Valkey is an open-source in-memory data structure store used as a cache, message broker, and session store.',
                                        'valkey-broker': 'Valkey is an open-source in-memory data structure store used as a cache, message broker, and session store.',
                                        'valkey-nosql': 'Valkey is an open-source in-memory data structure store used as a cache, message broker, and session store.',
                                        's3-minio': 'MinIO is a high-performance S3-compatible object storage server suitable for storing unstructured data at scale.',
                                        's3-garage': 'Garage is a lightweight S3-compatible distributed object storage system designed for self-hosting.',
                                        'ftp-vsftpd': 'vsftpd is a secure and fast FTP server for Unix-like systems, supporting both anonymous and local user access.',
                                        'ftp-sftpgo': 'SFTPGo is a fully featured and highly configurable SFTP/FTP/WebDAV server with optional REST API and web UI.',
                                        'pm2': 'PM2 is a production process manager for Node.js applications with a built-in load balancer and monitoring capabilities.',
                                        'supervisor': 'Supervisor is a client/server system for monitoring and controlling processes on UNIX-like operating systems.',
                                        'systemd': 'systemd is the system and service manager for Linux, providing dependency management and parallel startup of services.',
                                        'firewall': 'Firewall service manages network traffic rules to protect the server from unauthorized access.',
                                        'security-crowdsec': 'CrowdSec is a collaborative security engine that detects and blocks malicious behaviors using crowd-sourced intelligence.',
                                    } as Record<string, string>)[serviceType] || 'Managed service running on this server.'}</Text>
                                </Space>
                            </Card>
                        </Col>

                        {/* ===== CURRENT SETTINGS (READ-ONLY) ===== */}
                        {Object.keys(settings).length > 0 && (
                            <Col span={24}>
                                <Card
                                    title={<Space><SettingOutlined /> Current Settings</Space>}
                                    style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                                >
                                    <Descriptions column={2} bordered size="small">
                                        {(SETTINGS_DISPLAY_FIELDS[serviceType] || Object.keys(settings))
                                            .filter(k => settings[k] !== undefined && settings[k] !== '')
                                            .map(k => (
                                                <Descriptions.Item
                                                    key={k}
                                                    label={<Text style={{ fontSize: token.fontSizeSM, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</Text>}
                                                >
                                                    <Text style={{ fontFamily: 'monospace', fontSize: token.fontSizeSM, wordBreak: 'break-all' }}>
                                                        {String(settings[k])}
                                                    </Text>
                                                </Descriptions.Item>
                                            ))
                                        }
                                    </Descriptions>
                                </Card>
                            </Col>
                        )}

                        <Col span={24} style={{ marginBottom: token.marginLG }}>
                            <Card style={{ backgroundColor: token.colorFillAlter, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
                                <Row align="middle" justify="space-between">
                                    <Col>
                                        <Space size="large">
                                            <Badge status={isOnline ? 'success' : isOffline ? 'default' : 'error'} />
                                            <div>
                                                <Title level={4} style={{ margin: 0 }}>{status.toUpperCase()}</Title>
                                                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Service is currently {status}.</Text>
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
                            <Divider titlePlacement="left" style={{ margin: '0 0 24px 0' }}>
                                <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Live Metrics</Text>
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
                                                <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }} styles={{ body: { padding: token.borderRadiusLG } }}>
                                                    <Statistic
                                                        title={<Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', fontWeight: token.fontWeightStrong }}>{key.replace(/_/g, ' ')}</Text>}
                                                        value={displayVal}
                                                        suffix={<Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{suffix}</Text>}
                                                        prefix={icon}
                                                        valueStyle={{ fontWeight: token.fontWeightStrong, fontSize: token.borderRadiusLG }}
                                                    />
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            ) : (
                                <Card style={{ textAlign: 'center', padding: token.paddingLG, border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter, borderRadius: token.borderRadiusLG }}>
                                    <Space direction="vertical" align="center">
                                        <LineChartOutlined style={{ fontSize: token.marginLG, opacity: 0.1 }} />
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
                <div style={{ padding: `${token.paddingLG}px 0` }}>
                    {['mysql', 'postgresql', 'web-nginx', 'web-caddy', 'mongodb', 'rabbitmq', 'mqtt-mosquitto', 'ftp-vsftpd', 'ftp-sftpgo', 's3-minio', 's3-garage', 'valkey-cache', 'valkey-broker', 'valkey-nosql', 'pm2', 'supervisor'].includes(serviceType) ? (
                        <Card
                            title={<Space><SettingOutlined /> Service Settings</Space>}
                            loading={loadingSettings}
                            style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
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
                                form={form}
                                layout="vertical"
                                onFinish={handleUpdateSettings}
                            >
                                <Row gutter={[16, 16]}>
                                    {/* ===== PORT CONFIGURATION FOR ALL SERVICES ===== */}
                                    <Col span={12}>
                                        <Form.Item
                                            name="port"
                                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Listen Port</Text>}
                                            help="Port number this service listens on."
                                        >
                                            <Input placeholder="e.g. 3306" style={{ borderRadius: token.borderRadius }} />
                                        </Form.Item>
                                    </Col>

                                    {/* ===== BIND ADDRESS FOR NETWORK SERVICES ===== */}
                                    {['mongodb', 'valkey-cache', 'valkey-broker', 'valkey-nosql', 'mysql', 'postgresql', 'rabbitmq', 'mqtt-mosquitto'].includes(serviceType) && (
                                        <Col span={12}>
                                            <Form.Item
                                                name="bind"
                                                label={<Text strong style={{ fontSize: token.fontSizeSM }}>Bind Address</Text>}
                                                help="IP address to bind to (0.0.0.0 for all interfaces)."
                                            >
                                                <Input placeholder="0.0.0.0" style={{ borderRadius: token.borderRadius }} />
                                            </Form.Item>
                                        </Col>
                                    )}

                                    {/* ===== PATH CONFIGURATION FOR WEB SERVERS ===== */}
                                    {serviceType === 'web-nginx' && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="docroot"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Document Root</Text>}
                                                    help="Path to website files directory."
                                                >
                                                    <Input placeholder="/var/www/html" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="ssl_cert"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>SSL Certificate Path</Text>}
                                                    help="Path to TLS/SSL certificate file (.crt or .pem)."
                                                >
                                                    <Input placeholder="/etc/ssl/certs/server.crt" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="ssl_key"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>SSL Key Path</Text>}
                                                    help="Path to TLS/SSL private key file."
                                                >
                                                    <Input placeholder="/etc/ssl/private/server.key" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
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
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Socket Path</Text>}
                                                    help="Path to MySQL socket file."
                                                >
                                                    <Input placeholder="/var/run/mysqld/mysqld.sock" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="datadir"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Data Directory</Text>}
                                                    help="Path to database files."
                                                >
                                                    <Input placeholder="/var/lib/mysql" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="log_error"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Error Log Path</Text>}
                                                    help="Path to error log file."
                                                >
                                                    <Input placeholder="/var/log/mysql/error.log" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}

                                    {serviceType === 'postgresql' && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="data_directory"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Data Directory</Text>}
                                                    help="Path to PostgreSQL data directory."
                                                >
                                                    <Input placeholder="/var/lib/postgresql/data" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="acl_rules"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>ACL Rules (pg_hba.conf)</Text>}
                                                    help="Host-based authentication rules. Format: TYPE DATABASE USER ADDRESS METHOD"
                                                >
                                                    <TextArea
                                                        rows={6}
                                                        placeholder={`# TYPE  DATABASE        USER            ADDRESS                 METHOD\nlocal   all             postgres                                peer\nlocal   all             all                                     peer\nhost    all             all             127.0.0.1/32            scram-sha-256\nhost    all             all             ::1/128                 scram-sha-256`}
                                                        style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }}
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
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Data Path</Text>}
                                                    help="Path to database files."
                                                >
                                                    <Input placeholder="/var/lib/mongodb" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="logpath"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Log Path</Text>}
                                                    help="Path to log file."
                                                >
                                                    <Input placeholder="/var/log/mongodb/mongod.log" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}

                                    {/* ===== CACHE SERVICES ===== */}
                                    {['valkey-cache', 'valkey-broker', 'valkey-nosql'].includes(serviceType) && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="maxmemory"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Max Memory</Text>}
                                                    help="Maximum memory Valkey can use (e.g. 256mb, 1gb)."
                                                >
                                                    <Input placeholder="256mb" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="maxmemory_policy"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Eviction Policy</Text>}
                                                    help={<span>Policy for evicting keys. See <a href="https://valkey.io/topics/lru-cache/" target="_blank" rel="noopener noreferrer">docs</a>.</span>}
                                                >
                                                    <Input placeholder="allkeys-lru" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="appendonly"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Append Only File</Text>}
                                                    help="Enable AOF persistence (yes/no)."
                                                >
                                                    <Input placeholder="yes" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="appendfsync"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Append Fsync</Text>}
                                                    help="How often to fsync the AOF file (always/everysec/no)."
                                                >
                                                    <Input placeholder="everysec" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="dir"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Working Directory</Text>}
                                                    help="Path where Valkey saves RDB/AOF files."
                                                >
                                                    <Input placeholder="/var/lib/valkey" style={{ borderRadius: token.borderRadius }} />
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
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Management Port</Text>}
                                                    help="Port for web management interface."
                                                >
                                                    <Input placeholder="15672" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="admin_username"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Admin Username</Text>}
                                                    help="Default administrator username."
                                                >
                                                    <Input placeholder="admin" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="admin_password"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Admin Password</Text>}
                                                    help="Leave blank to keep current password."
                                                >
                                                    <Input.Password placeholder="••••••••" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="enabled_plugins"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Enabled Plugins</Text>}
                                                    help="Comma-separated list of enabled plugins."
                                                >
                                                    <Input placeholder="rabbitmq_management,rabbitmq_peer_discovery_localnode" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}

                                    {serviceType === 'mqtt-mosquitto' && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="persistence"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Persistence</Text>}
                                                    help="Enable message persistence (true/false)."
                                                >
                                                    <Input placeholder="true" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="persistence_location"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Persistence Path</Text>}
                                                    help="Path to store persistent messages."
                                                >
                                                    <Input placeholder="/var/lib/mosquitto/" style={{ borderRadius: token.borderRadius }} />
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
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>API Endpoint</Text>}
                                                    help="S3 API endpoint URL (e.g. http://localhost:9000)."
                                                >
                                                    <Input placeholder="http://localhost:9000" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={8}>
                                                <Form.Item
                                                    name="access_key"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Admin Access Key</Text>}
                                                    help="Administrator access key."
                                                >
                                                    <Input placeholder="minioadmin" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="secret_key"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Admin Secret Key</Text>}
                                                    help="Leave blank to keep current secret."
                                                >
                                                    <Input.Password placeholder="••••••••" style={{ borderRadius: token.borderRadius }} />
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
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Anonymous Enable</Text>}
                                                    help="Allow anonymous FTP login (YES/NO)."
                                                >
                                                    <Input placeholder="NO" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="local_enable"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Local Enable</Text>}
                                                    help="Allow local users to login (YES/NO)."
                                                >
                                                    <Input placeholder="YES" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="write_enable"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Write Enable</Text>}
                                                    help="Allow write operations (YES/NO)."
                                                >
                                                    <Input placeholder="YES" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="local_root"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Local Root</Text>}
                                                    help="Path to FTP root directory."
                                                >
                                                    <Input placeholder="/var/ftp" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}

                                    {serviceType === 'ftp-sftpgo' && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="port"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Listen Port</Text>}
                                                    help="Port SFTPGo listens on (default: 2022 for SFTP, 8080 for HTTP)."
                                                >
                                                    <Input placeholder="2022" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="bind_address"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Bind Address</Text>}
                                                    help="IP address to bind to (empty for all interfaces)."
                                                >
                                                    <Input placeholder="0.0.0.0" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="log_level"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Log Level</Text>}
                                                    help="Logging verbosity (debug/info/warn/error)."
                                                >
                                                    <Input placeholder="info" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="data_provider_type"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Data Provider</Text>}
                                                    help="Backend storage for user accounts (bolt/sqlite/mysql/postgresql)."
                                                >
                                                    <Input placeholder="bolt" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}

                                    {/* ===== PROCESS MANAGERS ===== */}
                                    {serviceType === 'pm2' && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="instances"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Default Instances</Text>}
                                                    help="Number of instances for cluster mode (0 = max CPUs)."
                                                >
                                                    <Input placeholder="1" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="max_memory_restart"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Max Memory Restart</Text>}
                                                    help="Restart apps exceeding this memory limit (e.g. 512M, 1G)."
                                                >
                                                    <Input placeholder="512M" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="out_file"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Output Log Path</Text>}
                                                    help="Path to stdout log file."
                                                >
                                                    <Input placeholder="/root/.pm2/logs/app-out.log" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="error_file"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Error Log Path</Text>}
                                                    help="Path to stderr log file."
                                                >
                                                    <Input placeholder="/root/.pm2/logs/app-error.log" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}

                                    {serviceType === 'supervisor' && (
                                        <>
                                            <Col span={24}>
                                                <Form.Item
                                                    name="logfile"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Log File</Text>}
                                                    help="Path to supervisor activity log."
                                                >
                                                    <Input placeholder="/var/log/supervisor/supervisord.log" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="logfile_maxbytes"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Max Log Size</Text>}
                                                    help="Maximum log file size before rotation (e.g. 50MB)."
                                                >
                                                    <Input placeholder="50MB" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="logfile_backups"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Log Backups</Text>}
                                                    help="Number of rotated log backups to keep."
                                                >
                                                    <Input placeholder="10" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="nodaemon"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>No Daemon</Text>}
                                                    help="Run supervisord in foreground (true/false)."
                                                >
                                                    <Input placeholder="false" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item
                                                    name="minfds"
                                                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Min File Descriptors</Text>}
                                                    help="Minimum number of file descriptors for supervisord."
                                                >
                                                    <Input placeholder="1024" style={{ borderRadius: token.borderRadius }} />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}
                                </Row>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={updatingSettings}
                                    style={{ borderRadius: token.borderRadius, marginTop: token.borderRadius }}
                                >
                                    Save Settings
                                </Button>
                            </Form>
                        </Card>
                    ) : (
                        <Card style={{ textAlign: 'center', padding: token.paddingLG, border: `1px solid ${token.colorBorderSecondary}`, backgroundColor: token.colorFillAlter, borderRadius: token.borderRadiusLG }}>
                            <Space direction="vertical" align="center">
                                <SettingOutlined style={{ fontSize: token.marginLG, opacity: 0.1 }} />
                                <Text type="secondary" italic>No configurable settings available for this service type.</Text>
                            </Space>
                        </Card>
                    )}
                </div>
            )
        },
        {
            key: 'processes',
            label: <Space><BranchesOutlined /> Processes</Space>,
            disabled: !['pm2', 'supervisor', 'systemd'].includes(serviceType),
            children: (
                <div style={{ padding: `${token.paddingLG}px 0` }}>
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
                <div style={{ padding: `${token.paddingLG}px 0` }}>
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
                                render: (t: string) => <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{new Date(t).toLocaleString()}</Text>
                            },
                            {
                                title: 'Event',
                                key: 'event',
                                render: (_: any, log: any) => (
                                    <Space direction="vertical" size={0}>
                                        <Text strong style={{ fontSize: token.fontSize }}>{log.type.replace(/_/g, ' ')}</Text>
                                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{log.message}</Text>
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
                <div style={{ padding: `${token.paddingLG}px 0` }}>
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
        },
        {
            key: 'credentials',
            label: <Space><KeyOutlined /> Credentials</Space>,
            disabled: !['mysql', 'postgresql', 'mongodb', 'rabbitmq', 'mqtt-mosquitto'].includes(serviceType),
            children: (
                <ManagementCredentialsTab
                    agentId={agentId}
                    serviceId={serviceId}
                    serviceName={serviceName}
                    serviceType={serviceType}
                />
            )
        }
    ];

    return (
        <Modal
            title={
                <Space size="middle">
                    <div style={{ 
                        padding: token.borderRadiusSM, 
                        borderRadius: token.paddingSM, 
                        backgroundColor: `${token.colorPrimary}15`, 
                        color: token.colorPrimary,
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <ServiceTypeIcon type={serviceType} />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>{serviceLabel}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM, fontWeight: token.fontWeightStrong, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {serviceName} • {agentName}
                        </Text>
                    </div>
                </Space>
            }
            open={isOpen}
            onCancel={onClose}
            width={900}
            footer={null}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <Tabs
                activeKey={activeTab} 
                onChange={setActiveTab} 
                items={tabItems}
                style={{ marginTop: token.borderRadius }}
            />
        </Modal>
    );
}
