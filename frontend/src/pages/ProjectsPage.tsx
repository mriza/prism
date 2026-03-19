import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { ProjectFormModal } from '../components/modals/ProjectFormModal';
import { 
    Row, 
    Col, 
    Card, 
    Button, 
    Input, 
    Typography, 
    Space, 
    Empty, 
    theme, 
    Tooltip,
    Divider
} from 'antd';
import { 
    PlusOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    KeyOutlined, 
    SearchOutlined, 
    RocketOutlined 
} from '@ant-design/icons';
import type { Project } from '../types';
import { PageContainer } from '../components/PageContainer';

const { Text, Title, Paragraph } = Typography;

export function ProjectsPage() {
    const { projects, createProject, updateProject, deleteProject } = useProjects();
    const { accountsByProject, deleteAccountsByProject } = useAccounts();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<Project | null>(null);
    const [search, setSearch] = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();
    const { token } = theme.useToken();

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <PageContainer 
            title="Project Portfolio" 
            description="Group and orchestrate your service accounts by logical project domains for unified management."
            extra={
                user?.role !== 'user' && (
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<PlusOutlined />} 
                        onClick={() => setShowCreate(true)}
                        style={{ borderRadius: '8px', fontWeight: 600 }}
                    >
                        New Project
                    </Button>
                )
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Search */}
                {projects.length > 0 && (
                    <Input
                        placeholder="Filter projects..."
                        prefix={<SearchOutlined style={{ color: token.colorTextDisabled }} />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ maxWidth: '400px', borderRadius: '10px' }}
                        size="large"
                    />
                )}

                {/* Content Area */}
                {projects.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <Space direction="vertical">
                                <Text strong>Portfolio Empty</Text>
                                <Text type="secondary">Create your first project to start grouping infrastructure assets.</Text>
                            </Space>
                        }
                    />
                ) : (
                    <Row gutter={[24, 24]}>
                        {filtered.map(p => {
                            const accountCount = accountsByProject(p.id).length;
                            const projectColor = p.color === 'primary' ? token.colorPrimary : 
                                               p.color === 'secondary' ? '#722ed1' : 
                                               p.color === 'accent' ? '#fa8c16' : token.colorPrimary;
                            return (
                                <Col xs={24} md={12} lg={8} key={p.id}>
                                    <Card
                                        hoverable
                                        style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '16px' }}
                                        bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                            <Space align="center">
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: projectColor }} />
                                                <Title level={4} style={{ margin: 0, cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                                                    {p.name}
                                                </Title>
                                            </Space>
                                            
                                            {user?.role !== 'user' && (
                                                <Space size="small">
                                                    <Tooltip title="Edit Project">
                                                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditing(p)} />
                                                    </Tooltip>
                                                    <Tooltip title="Delete Project">
                                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => { 
                                                            if (confirm(`Authorize permanent deletion of project "${p.name}" and all associated assets?`)) { 
                                                                deleteAccountsByProject(p.id); 
                                                                deleteProject(p.id); 
                                                            } 
                                                        }} />
                                                    </Tooltip>
                                                </Space>
                                            )}
                                        </div>

                                        <Paragraph type="secondary" style={{ fontSize: '13px', minHeight: '40px' }} ellipsis={{ rows: 2 }}>
                                            {p.description || <Text type="secondary" italic>No description provided</Text>}
                                        </Paragraph>

                                        <Divider style={{ margin: '16px 0' }} />

                                        <Space style={{ marginBottom: '24px' }}>
                                            <KeyOutlined style={{ color: token.colorTextDisabled }} />
                                            <Text strong style={{ fontSize: '12px' }}>{accountCount} Assets</Text>
                                        </Space>

                                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                ID {p.id.substring(0, 8)}
                                            </Text>
                                            <Button 
                                                type="link" 
                                                icon={<RocketOutlined />} 
                                                onClick={() => navigate(`/projects/${p.id}`)}
                                                style={{ display: 'flex', alignItems: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}
                                            >
                                                Orchestrate
                                            </Button>
                                        </div>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                )}
            </Space>

            {/* Create modal */}
            <ProjectFormModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onSave={data => createProject(data)}
            />

            {/* Edit modal */}
            {editing && (
                <ProjectFormModal
                    isOpen
                    onClose={() => setEditing(null)}
                    onSave={data => { updateProject(editing.id, data); setEditing(null); }}
                    initial={editing}
                />
            )}
        </PageContainer>
    );
}

export default ProjectsPage;
