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
    InputNumber,
} from 'antd';
import {
    PlusOutlined,
    DeleteOutlined,
    RocketOutlined,
} from '@ant-design/icons';
import type { Deployment } from '../../hooks/useDeployments';
import { useAgents } from '../../hooks/useAgents';
import { useProjects } from '../../hooks/useProjects';

const { Text } = Typography;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>) => void;
    initial?: Deployment;
    projectId?: string;
}

const RUNTIMES = [
    { value: 'nodejs', label: 'Node.js' },
    { value: 'python', label: 'Python' },
    { value: 'php', label: 'PHP' },
    { value: 'go', label: 'Go (Binary)' },
    { value: 'binary', label: 'Binary / Other' },
];

const PROCESS_MANAGERS = [
    { value: 'pm2', label: 'PM2' },
    { value: 'systemd', label: 'Systemd' },
    { value: 'supervisor', label: 'Supervisor' },
];

const PROXY_TYPES = [
    { value: 'caddy', label: 'Caddy (recommended)' },
    { value: 'nginx', label: 'Nginx' },
    { value: 'none', label: 'No Proxy' },
];

export function DeploymentFormModal({ isOpen, onClose, onSave, initial, projectId }: Props) {
    const [form] = Form.useForm();
    const { agents } = useAgents();
    const { projects } = useProjects();
    const { token: token } = theme.useToken();
    const [envFields, setEnvFields] = useState<{ key: string; value: string }[]>(
        initial?.envVars ? Object.entries(initial.envVars).map(([key, value]) => ({ key, value })) : []
    );

    const onlineAgents = agents.filter(a => a.status === 'approved' || a.status === 'online' || a.status === 'offline');

    const addEnvVar = () => setEnvFields(prev => [...prev, { key: '', value: '' }]);
    const removeEnvVar = (idx: number) => setEnvFields(prev => prev.filter((_, i) => i !== idx));
    const updateEnvVar = (idx: number, field: 'key' | 'value', val: string) => {
        setEnvFields(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    };

    const handleSave = (values: any) => {
        // Build envVars from fields
        const envVars: Record<string, string> = {};
        envFields.forEach(f => {
            if (f.key.trim()) envVars[f.key.trim()] = f.value;
        });

        const data = {
            ...values,
            envVars,
            projectId: values.projectId || projectId || '',
            status: initial?.status || 'stopped',
        };
        onSave(data);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            title={
                <Space>
                    <RocketOutlined style={{ color: token.colorPrimary }} />
                    <Text strong style={{ fontSize: token.fontSizeHeading5 }}>
                        {initial ? 'Edit Deployment' : 'New Deployment'}
                    </Text>
                </Space>
            }
            footer={null}
            width={800}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={initial ?? {
                    runtime: 'nodejs',
                    processManager: 'pm2',
                    proxyType: 'caddy',
                    projectId: projectId || '',
                }}
                style={{ marginTop: token.borderRadius }}
            >
                {/* Project & Server */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="projectId" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Project</Text>} rules={[{ required: true }]}>
                            <Select
                                placeholder="Select Project"
                                disabled={!!projectId}
                                options={projects.map(p => ({ value: p.id, label: p.name }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="serverId" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Target Server</Text>} rules={[{ required: true }]}>
                            <Select
                                placeholder="Select Server"
                                options={onlineAgents.map(a => ({ value: a.id, label: a.name || a.hostname || a.id }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Name & Description */}
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="name" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>App Name</Text>} rules={[{ required: true }]}>
                            <Input placeholder="e.g. my-api-service" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="description" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Description</Text>}>
                            <Input placeholder="Brief description" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="left" style={{ fontSize: token.borderRadiusSM }}>Source</Divider>

                <Row gutter={16}>
                    <Col span={16}>
                        <Form.Item name="sourceUrl" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Git Repository URL</Text>} rules={[{ required: true }]} help="Releases will be downloaded from this repo">
                            <Input placeholder="https://github.com/user/repo" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="sourceToken" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Access Token</Text>} help="Optional, for private repos">
                            <Input.Password placeholder="ghp_..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="left" style={{ fontSize: token.borderRadiusSM }}>Runtime & Process</Divider>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="runtime" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Runtime</Text>} rules={[{ required: true }]}>
                            <Select options={RUNTIMES} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="runtimeVersion" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Version</Text>} help="e.g. 18.x, 3.11">
                            <Input placeholder="18.x" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="processManager" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Process Manager</Text>} rules={[{ required: true }]}>
                            <Select options={PROCESS_MANAGERS} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item name="startCommand" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Start Command</Text>} rules={[{ required: true }]}>
                            <Input placeholder="e.g. npm start, python main.py, ./myapp" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="left" style={{ fontSize: token.borderRadiusSM }}>Network & Proxy</Divider>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="internalPort" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>App Port</Text>}>
                            <InputNumber placeholder="3000" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="proxyType" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Reverse Proxy</Text>}>
                            <Select options={PROXY_TYPES} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="domainName" label={<Text strong style={{ fontSize: token.borderRadiusSM }}>Domain</Text>}>
                            <Input placeholder="api.myapp.com" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="left" style={{ fontSize: token.borderRadiusSM }}>Environment Variables</Divider>

                {envFields.map((field, idx) => (
                    <Row gutter={8} key={idx} style={{ marginBottom: token.borderRadiusSM }}>
                        <Col span={10}>
                            <Input
                                placeholder="KEY"
                                value={field.key}
                                onChange={e => updateEnvVar(idx, 'key', e.target.value)}
                                style={{ fontFamily: 'monospace' }}
                            />
                        </Col>
                        <Col span={12}>
                            <Input
                                placeholder="value"
                                value={field.value}
                                onChange={e => updateEnvVar(idx, 'value', e.target.value)}
                                style={{ fontFamily: 'monospace' }}
                            />
                        </Col>
                        <Col span={2}>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeEnvVar(idx)} />
                        </Col>
                    </Row>
                ))}
                <Button type="dashed" onClick={addEnvVar} block icon={<PlusOutlined />} style={{ marginBottom: `${token.marginLG}px` }}>
                    Add Variable
                </Button>

                <div style={{
                    marginTop: token.borderRadius,
                    paddingTop: token.borderRadius,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: token.borderRadiusSM
                }}>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="primary" htmlType="submit" icon={<RocketOutlined />} style={{ fontWeight: 600 }}>
                        {initial ? 'Save Changes' : 'Create Deployment'}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
