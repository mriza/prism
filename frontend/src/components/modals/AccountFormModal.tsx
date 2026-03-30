import { useState } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Select, 
    Space, 
    Typography, 
    theme, 
    Button, 
    Row, 
    Col, 
    Divider, 
    Card
} from 'antd';
import { 
    LeftOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import type { ServiceAccount, ServiceType } from '../../types';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../../types';
import { ServiceTypeIcons } from '../ServiceTypeIcons';
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
    'security-crowdsec': 8080,
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
    pm2: ['pm2'],
    supervisor: ['supervisor'],
    systemd: ['systemd'],
    'security-crowdsec': ['crowdsec'],
};

export function AccountFormModal({ isOpen, onClose, onSave, category = 'project', projectId, initial }: Props) {
    const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
    const [form] = Form.useForm();
    const { agents } = useAgents();
    const { token } = theme.useToken();
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
        form.setFieldsValue({
            ...defaultDraft(category, projectId),
            type: t,
            port: DEFAULT_PORTS[t],
            agentId: autoAgent ? autoAgent.id : '',
            host: autoAgent ? (autoAgent.hostname || 'localhost') : 'localhost'
        });
        setStep(2);
    };

    const handleSave = (values: any) => {
        const { agentId, ...rest } = values;
        onSave({ ...rest, serverId: agentId, agentId, category, type: selectedType, projectId });
        onClose();
    };

    const matchingAgents = getMatchingAgents(selectedType);

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            title={
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: '16px' }}>
                        {initial ? 'Edit Account' : step === 1 ? 'Select Service Type' : `Add ${SERVICE_TYPE_LABELS[selectedType]} Account`}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px', fontWeight: 400 }}>
                        {step === 1 ? "Choose the infrastructure layer for this new credential" : "Enter the final connection parameters and access roles"}
                    </Text>
                </Space>
            }
            footer={null}
            width={800}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            {step === 1 ? (
                /* Step 1: Service type picker */
                <div style={{ padding: '24px 0' }}>
                    {Object.entries(SERVICE_TYPE_CATEGORIES).map(([category, types]) => (
                        <div key={category} style={{ marginBottom: '32px' }}>
                            <Divider orientation={"left" as any} style={{ margin: '0 0 20px 0' }}>
                                <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.3 }}>{category}</Text>
                            </Divider>
                            <Row gutter={[16, 16]}>
                                {types.map(t => (
                                    <Col xs={12} sm={8} md={6} key={t}>
                                        <Card 
                                            hoverable 
                                            onClick={() => handleSelectType(t)}
                                            style={{ 
                                                textAlign: 'center', 
                                                borderRadius: '16px', 
                                                border: `1px solid ${token.colorBorderSecondary}`,
                                                backgroundColor: token.colorFillAlter
                                            }}
                                            bodyStyle={{ padding: '24px 12px' }}
                                        >
                                            <div style={{ 
                                                fontSize: '32px', 
                                                marginBottom: '12px',
                                                color: token.colorPrimary
                                            }}>
                                                <ServiceTypeIcons type={t} />
                                            </div>
                                            <Text strong style={{ fontSize: '13px' }}>{SERVICE_TYPE_LABELS[t]}</Text>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    ))}
                </div>
            ) : (
                /* Step 2: Account details */
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={initial ?? defaultDraft(category, projectId)}
                    style={{ marginTop: '24px' }}
                >
                    {!initial && (
                        <Button 
                            type="text" 
                            icon={<LeftOutlined />} 
                            onClick={() => setStep(1)}
                            style={{ 
                                marginBottom: '24px', 
                                fontSize: '11px', 
                                fontWeight: 800, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.1em',
                                color: token.colorTextDisabled
                            }}
                        >
                            Back to service types
                        </Button>
                    )}

                    <Row gutter={24}>
                        <Col span={24}>
                            <Form.Item name="name" label={<Text strong style={{ fontSize: '12px' }}>Display name</Text>} rules={[{ required: true }]}>
                                <Input placeholder="e.g. main-db" style={{ borderRadius: '8px' }} />
                            </Form.Item>
                        </Col>
                        
                        <Col span={12}>
                            <Form.Item name="agentId" label={<Text strong style={{ fontSize: '12px' }}>Service instance</Text>} rules={[{ required: true }]}>
                                <Select 
                                    placeholder="Select server instance"
                                    style={{ borderRadius: '8px' }}
                                    options={matchingAgents.map(a => ({ 
                                        value: a.id, 
                                        label: `${SERVICE_TYPE_LABELS[selectedType]} on ${a.name || a.id}` 
                                    }))}
                                />
                            </Form.Item>
                        </Col>
                        
                        {(['mongodb', 'mysql', 'postgresql', 'rabbitmq', 'mqtt-mosquitto', 'web-caddy', 'web-nginx', 'ftp-vsftpd', 'ftp-sftpgo'].includes(selectedType)) && (
                            <>
                                <Col span={8}>
                                    <Form.Item name="host" label={<Text strong style={{ fontSize: '12px' }}>Host</Text>}>
                                        <Input placeholder="localhost" style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={4}>
                                    <Form.Item name="port" label={<Text strong style={{ fontSize: '12px' }}>Port</Text>}>
                                        <Input placeholder={String(DEFAULT_PORTS[selectedType])} style={{ borderRadius: '8px' }} />
                                    </Form.Item>
                                </Col>
                            </>
                        )}
                    </Row>

                    <Divider style={{ margin: '24px 0' }} />

                    {/* Service specific fields */}
                    {['mongodb', 'mysql', 'postgresql', 'rabbitmq'].includes(selectedType) && (
                        <Row gutter={24}>
                            <Col span={12}>
                                <Form.Item name="username" label={<Text strong style={{ fontSize: '12px' }}>Username</Text>}>
                                    <Input style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="password" label={<Text strong style={{ fontSize: '12px' }}>Password</Text>}>
                                    <Input.Password style={{ borderRadius: '8px' }} />
                                </Form.Item>
                            </Col>
                            {selectedType !== 'rabbitmq' && (
                                <Col span={24}>
                                    <Form.Item name="databases" label={<Text strong style={{ fontSize: '12px' }}>Databases (Multi-value available in API)</Text>}>
                                        <Select mode="tags" placeholder="Press enter to add databases" style={{ width: '100%', borderRadius: '8px' }} />
                                    </Form.Item>
                                </Col>
                            )}
                        </Row>
                    )}

                    {selectedType === 'rabbitmq' && (
                        <div style={{ marginTop: '16px' }}>
                            <Divider orientation={"left" as any}>
                                <Text strong style={{ fontSize: '12px' }}>VHosts & MQTT Bindings</Text>
                            </Divider>
                            <Form.List name="bindings">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Card key={key} size="small" style={{ marginBottom: '16px', borderRadius: '12px' }}>
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
                                                    <Col span={2} style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
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
                    
                    <div style={{ 
                        marginTop: '32px', 
                        paddingTop: '16px', 
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <Button onClick={onClose} style={{ borderRadius: '8px' }}>Cancel</Button>
                        <Button type="primary" htmlType="submit" style={{ borderRadius: '8px', fontWeight: 600 }}>
                            {initial ? 'Save Account' : 'Confirm & Create'}
                        </Button>
                    </div>
                </Form>
            )}
        </Modal>
    );
}
