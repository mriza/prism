import { useState } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Select, 
    Space, 
    Typography, 
    Button, 
    Row, 
    Col, 
    Divider, 
    Card,
    Radio
} from 'antd';
import { 
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import type { ServiceAccount, ServiceType } from '../../types';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../../types';
import { useAgents } from '../../hooks/useAgents';

const { Text } = Typography;

type AccountDraft = Omit<ServiceAccount, 'id' | 'createdAt'>;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: AccountDraft) => void;
    /** When set, locks the category for all accounts created through this modal */
    category?: AccountDraft['category'];
    projectId?: string;
    initial?: ServiceAccount;
}

const defaultDraft = (category: AccountDraft['category'] = 'project', projectId?: string): AccountDraft => ({
    category,
    type: 'mysql',
    projectId,
    projectName: undefined,
    serverId: '',
    serviceId: '',
    agentId: '',
    name: '',
    host: 'localhost',
    port: undefined,
    database: '',
    databases: [],
    username: '',
    password: '',
    permissions: undefined,
    status: 'active',
    lastActivity: undefined,
    role: '',
    targetEntity: '',
    vhost: '/',
    bindings: [],
    endpoint: '',
    accessKey: '',
    secretKey: '',
    bucket: '',
    rootPath: '/home',
    appName: '',
    script: '',
    cwd: '',
    tags: [],
    quota: undefined,
    quotaEnabled: false,
    pm2Port: undefined,
    pm2ProxyType: undefined,
    pm2ProxyDomain: undefined,
    // Valkey-specific fields
    databaseIndex: undefined,
    aclCategory: undefined,
    channelPattern: undefined,
});

const DEFAULT_PORTS: Partial<Record<ServiceType, number>> = {
    mysql: 3306,
    postgresql: 5432,
    mongodb: 27017,
    rabbitmq: 5672,
    'mqtt-mosquitto': 1883,
    'ftp-vsftpd': 21,
    'ftp-sftpgo': 22,
    'web-caddy': 80,
    'web-nginx': 80,
    'valkey-cache': 6379,
    'valkey-broker': 6379,
    'valkey-nosql': 6379,
};

const SERVICE_NAME_MAP: Partial<Record<ServiceType, string[]>> = {
    mongodb: ['mongodb', 'mongod'],
    mysql: ['mysql', 'mariadb'],
    postgresql: ['postgresql', 'postgres'],
    rabbitmq: ['rabbitmq'],
    'mqtt-mosquitto': ['mosquitto'],
    's3-minio': ['minio'],
    's3-garage': ['garage'],
    'ftp-vsftpd': ['vsftpd'],
    'ftp-sftpgo': ['sftpgo'],
    'web-caddy': ['caddy'],
    'web-nginx': ['nginx'],
    'valkey-cache': ['valkey'],
    'valkey-broker': ['valkey'],
    'valkey-nosql': ['valkey'],
};

export function AccountFormModal({ isOpen, onClose, onSave, category = 'project', projectId, initial }: Props) {
    const [form] = Form.useForm();
    const { agents } = useAgents();
    const [selectedType, setSelectedType] = useState<ServiceType>(initial?.type ?? 'mysql');

    const getMatchingAgents = (type: ServiceType) => {
        const names = SERVICE_NAME_MAP[type] || [];
        return agents.filter(a =>
            (a.status === 'approved' || a.status === 'online' || a.status === 'offline') &&
            a.services.some(s => names.includes(s.name))
        );
    };

    const handleSelectType = (t: ServiceType) => {
        const matches = getMatchingAgents(t);
        const autoAgent = matches.length === 1 ? matches[0] : null;

        setSelectedType(t);
        // We only reset specific fields so we don't obliterate everything if the user was just switching types,
        // although usually this is only useful when first opening.
        form.setFieldsValue({
            type: t,
            port: DEFAULT_PORTS[t],
            agentId: autoAgent ? autoAgent.id : undefined,
            host: autoAgent ? (autoAgent.hostname || 'localhost') : 'localhost'
        });
    };

    const handleSave = (values: any) => {
        const { agentId, databases, databaseIndex, aclCategory, channelPattern, ...rest } = values;
        
        // Auto-set primary database from first item in databases array
        // For Valkey NoSQL, convert databaseIndex to databases array
        let finalDatabases = databases || [];
        if (selectedType === 'valkey-nosql' && databaseIndex !== undefined) {
            finalDatabases = [`db${databaseIndex}`];
        }
        
        const data = {
            ...rest,
            serverId: agentId,
            agentId,
            category,
            type: selectedType,
            projectId,
            database: finalDatabases.length > 0 ? finalDatabases[0] : '',
            databases: finalDatabases,
            // Store Valkey-specific fields
            aclCategory: selectedType === 'valkey-cache' ? aclCategory : undefined,
            channelPattern: selectedType === 'valkey-broker' ? channelPattern : undefined,
        };
        
        onSave(data);
        onClose();
    };

    const matchingAgents = getMatchingAgents(selectedType);
    const isProxy = ['web-caddy', 'web-nginx'].includes(selectedType);

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            title={
                <Space direction="vertical" size={0}>
                    <Text strong className="prism-section-header prism-heading-3 prism-opacity-1">
                        {initial ? (isProxy ? 'Edit Web Proxy' : 'Edit Account') : (isProxy ? 'Provision Web Proxy' : 'Provision Account')}
                    </Text>
                    <Text type="secondary" className="prism-text-sm">
                        {isProxy ? 'Configure reverse proxy domains and routing' : 'Configure service connection and access credentials'}
                    </Text>
                </Space>
            }
            footer={null}
            width={800}
            className="prism-card"
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={initial ?? defaultDraft(category, projectId)}
                className="prism-margin-lg"
            >
                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item name="type" label={<Text strong className="prism-text-sm">Service Type</Text>} rules={[{ required: true }]}>
                            <Select
                                placeholder="Select Service Type"
                                className="prism-full-width prism-rounded"
                                onChange={handleSelectType}
                                disabled={!!initial}
                            >
                                {Object.entries(SERVICE_TYPE_CATEGORIES).map(([cat, types]) => (
                                    <Select.OptGroup label={cat} key={cat}>
                                        {types.map(t => (
                                            <Select.Option key={t} value={t}>
                                                <Space>
                                                    {SERVICE_TYPE_LABELS[t]}
                                                </Space>
                                            </Select.Option>
                                        ))}
                                    </Select.OptGroup>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                        <Col span={24}>
                            <Form.Item name="name" label={<Text strong className="prism-text-sm">Display name</Text>} rules={[{ required: true }]}>
                                <Input placeholder="e.g. main-db" className="prism-rounded" />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="agentId" label={<Text strong className="prism-text-sm">Service instance</Text>} rules={[{ required: true }]}>
                                <Select
                                    placeholder="Select server instance"
                                    className="prism-rounded"
                                    options={matchingAgents.map(a => ({
                                        value: a.id,
                                        label: `${SERVICE_TYPE_LABELS[selectedType]} on ${a.name || a.id}`
                                    }))}
                                />
                            </Form.Item>
                        </Col>

                        {(['mongodb', 'mysql', 'postgresql', 'rabbitmq', 'mqtt-mosquitto', 'web-caddy', 'web-nginx', 'ftp-vsftpd', 'ftp-sftpgo', 'valkey-cache', 'valkey-broker', 'valkey-nosql'].includes(selectedType)) && (
                            <>
                                <Col span={8}>
                                    <Form.Item name="host" label={<Text strong className="prism-text-sm">Host</Text>}>
                                        <Input placeholder="localhost" className="prism-rounded" />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="port" label={<Text strong className="prism-text-sm">Port</Text>}>
                                        <Input placeholder={String(DEFAULT_PORTS[selectedType])} className="prism-rounded" />
                                    </Form.Item>
                                </Col>
                            </>
                        )}
                    </Row>

                    <Divider className="prism-margin-lg" />

                    {isProxy && (
                        <>
                            <Divider titlePlacement="left" className="prism-margin-top-0">
                                <Text strong className="prism-text-sm prism-uppercase" style={{ letterSpacing: '0.1em' }}>Site Configuration</Text>
                            </Divider>
                            <Row gutter={24}>
                                <Col span={24}>
                                    <Form.Item name="vhost" label={<Text strong className="prism-text-sm">Domain Name</Text>} rules={[{ required: true }]}>
                                        <Input placeholder="e.g. example.com or api.example.com" className="prism-rounded" />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item name="proxyTypeConfig" initialValue="proxy" label={<Text strong className="prism-text-sm">Website Mode</Text>}>
                                        <Radio.Group optionType="button" buttonStyle="solid">
                                            <Radio.Button value="website">Static / PHP Website</Radio.Button>
                                            <Radio.Button value="proxy">Reverse Proxy</Radio.Button>
                                        </Radio.Group>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item
                                noStyle
                                shouldUpdate={(prev, curr) => prev.proxyTypeConfig !== curr.proxyTypeConfig}
                            >
                                {({ getFieldValue }) => {
                                    const pType = getFieldValue('proxyTypeConfig');
                                    if (pType === 'proxy') {
                                        return (
                                            <Row gutter={24}>
                                                <Col span={24}>
                                                    <Form.Item name="endpoint" label={<Text strong className="prism-text-sm">Target/Upstream URL</Text>} rules={[{ required: true }]} help="The internal URL where your app is running (e.g., PM2 / Node.js node)">
                                                        <Input placeholder="http://localhost:3000" className="prism-rounded" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        );
                                    } else {
                                        return (
                                            <Row gutter={24}>
                                                <Col span={12}>
                                                    <Form.Item name="rootPath" label={<Text strong className="prism-text-sm">Web Root Directory</Text>} rules={[{ required: true }]} help="Absolute path to your static/php files">
                                                        <Input placeholder="/var/www/html/mysite" className="prism-rounded" />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={12}>
                                                    <Form.Item name="targetEntity" label={<Text strong className="prism-text-sm">Dynamic Interpreter</Text>} help="Leave empty for static sites. E.g. unix//var/run/php/php8.1-fpm.sock">
                                                        <Input placeholder="PHP-FPM socket path or URL" className="prism-rounded" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        );
                                    }
                                }}
                            </Form.Item>
                        </>
                    )}

                    {/* Service specific fields */}
                    {['mongodb', 'mysql', 'postgresql', 'rabbitmq', 'valkey-nosql', 'valkey-broker', 'valkey-cache'].includes(selectedType) && (
                        <Row gutter={24}>
                            <Col span={12}>
                                <Form.Item name="username" label={<Text strong className="prism-text-sm">Username</Text>}>
                                    <Input className="prism-rounded" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="password" label={<Text strong className="prism-text-sm">Password</Text>}>
                                    <Input.Password className="prism-rounded" />
                                </Form.Item>
                            </Col>

                            {/* RabbitMQ: No databases field */}
                            {selectedType === 'rabbitmq' && (
                                <Col span={24}>
                                    <Form.Item name="vhost" label={<Text strong className="prism-text-sm">Default VHost</Text>}>
                                        <Input placeholder="/" className="prism-rounded" />
                                    </Form.Item>
                                </Col>
                            )}

                            {/* Valkey NoSQL: Database index selector (0-15) */}
                            {selectedType === 'valkey-nosql' && (
                                <Col span={24}>
                                    <Form.Item name="databaseIndex" label={<Text strong className="prism-text-sm">Database Index (0-15)</Text>}>
                                        <Select placeholder="Select database index" className="prism-full-width prism-rounded">
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <Select.Option key={i} value={i}>{i}</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            )}
                            
                            {/* Valkey Cache: ACL Category selector */}
                            {selectedType === 'valkey-cache' && (
                                <Col span={24}>
                                    <Form.Item name="aclCategory" label={<Text strong className="prism-text-sm">ACL Category</Text>}>
                                        <Select placeholder="Select ACL category" className="prism-full-width prism-rounded">
                                            <Select.Option value="@read">Read Only (+@read)</Select.Option>
                                            <Select.Option value="@write">Write Only (+@write)</Select.Option>
                                            <Select.Option value="@all">All Commands (+@all)</Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            )}
                            
                            {/* Valkey Broker: Pub/Sub channel pattern */}
                            {selectedType === 'valkey-broker' && (
                                <Col span={24}>
                                    <Form.Item name="channelPattern" label={<Text strong className="prism-text-sm">Pub/Sub Channel Pattern</Text>}>
                                        <Input placeholder="e.g. events:* or #" className="prism-rounded" />
                                    </Form.Item>
                                </Col>
                            )}
                            
                            {/* Traditional databases (MySQL, PostgreSQL, MongoDB): Multi-tag databases field */}
                            {['mongodb', 'mysql', 'postgresql'].includes(selectedType) && (
                                <Col span={24}>
                                    <Form.Item name="databases" label={<Text strong className="prism-text-sm">Databases (Multi-value available in API)</Text>}>
                                        <Select mode="tags" placeholder="Press enter to add databases" className="prism-full-width prism-rounded" />
                                    </Form.Item>
                                </Col>
                            )}
                        </Row>
                    )}

                    {selectedType === 'rabbitmq' && (
                        <div className="prism-margin-top">
                            <Divider titlePlacement="left">
                                <Text strong className="prism-text-sm">VHosts & MQTT Bindings</Text>
                            </Divider>
                            <Form.List name="bindings">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Card key={key} size="small" className="prism-card prism-margin-sm">
                                                <Row gutter={16}>
                                                    <Col span={10}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'vhost']}
                                                            label="VHost"
                                                            rules={[{ required: true, message: 'Missing vhost' }]}
                                                        >
                                                            <Input placeholder="/host" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={14}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'destinationQueue']}
                                                            label="Destination Queue"
                                                            rules={[{ required: true, message: 'Missing queue' }]}
                                                        >
                                                            <Input placeholder="user.queue" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={10}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'sourceExchange']}
                                                            label="Exchange"
                                                            initialValue="amq.topic"
                                                        >
                                                            <Input placeholder="amq.topic" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'routingKey']}
                                                            label="Routing Key (Pattern)"
                                                        >
                                                            <Input placeholder="topic/+" />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={2} className="prism-flex-center prism-margin-top-sm">
                                                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                                                    </Col>
                                                </Row>
                                            </Card>
                                        ))}
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                            Add Binding
                                        </Button>
                                    </>
                                )}
                            </Form.List>
                        </div>
                    )}
                    
                <div className="prism-flex-between prism-margin-lg prism-padding-top prism-border-top">
                    <Button onClick={onClose} className="prism-rounded">Cancel</Button>
                    <Button type="primary" htmlType="submit" className="prism-rounded prism-text-bold">
                        {initial ? 'Save Changes' : (isProxy ? 'Create Proxy' : 'Confirm & Create')}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
