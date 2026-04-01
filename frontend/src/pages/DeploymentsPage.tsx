import { useState } from 'react';
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
} from '@ant-design/icons';
import { useDeployments } from '../hooks/useDeployments';
import { useProjects } from '../hooks/useProjects';
import { DeploymentFormModal } from '../components/modals/DeploymentFormModal';
import type { Deployment } from '../hooks/useDeployments';

const { Title, Text } = Typography;

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

export function DeploymentsPage() {
    const { deployments, loading, createDeployment, updateDeployment, deleteDeployment, triggerDeploy } = useDeployments();
    const { projects } = useProjects();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingDeployment, setEditingDeployment] = useState<Deployment | undefined>();
    const [searchText, setSearchText] = useState('');
    const { token } = theme.useToken();

    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

    const filtered = deployments.filter(d =>
        !searchText ||
        d.name.toLowerCase().includes(searchText.toLowerCase()) ||
        d.domainName?.toLowerCase().includes(searchText.toLowerCase()) ||
        d.sourceUrl.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
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
                            setModalOpen(true);
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

    return (
        <div style={{ padding: token.paddingLG }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginLG }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        <RocketOutlined style={{ marginRight: token.marginXS }} />
                        Deployments
                    </Title>
                    <Text type="secondary">Manage application deployments via Git releases</Text>
                </div>
                <Space>
                    <Input
                        placeholder="Search deployments..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 240 }}
                        allowClear
                    />
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setEditingDeployment(undefined);
                            setModalOpen(true);
                        }}
                    >
                        New Deployment
                    </Button>
                </Space>
            </div>

            <Table
                dataSource={filtered}
                columns={columns}
                rowKey="id"
                loading={loading}
                locale={{
                    emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No deployments yet. Create your first deployment!"
                        />
                    ),
                }}
                pagination={{ pageSize: 15, showSizeChanger: true }}
            />

            <DeploymentFormModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingDeployment(undefined);
                }}
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
        </div>
    );
}
