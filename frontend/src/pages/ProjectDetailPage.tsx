import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { AccountFormModal } from '../components/modals/AccountFormModal';
import { ProjectFormModal } from '../components/modals/ProjectFormModal';
import { Button } from '../components/ui/Button';
import { ServiceTypeIcon } from '../components/ui/ServiceTypeIcon';
import { SERVICE_TYPE_LABELS } from '../types';
import { Plus, ArrowLeft, Pencil, Trash2, Server, KeyRound } from 'lucide-react';

export function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { projects, updateProject, deleteProject } = useProjects();
    const { accountsByProject, createAccount, deleteAccount, deleteAccountsByProject } = useAccounts();
    const navigate = useNavigate();

    const project = projects.find(p => p.id === id);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showEditProject, setShowEditProject] = useState(false);

    if (!project) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>Project not found.</p>
                <Link to="/projects" style={{ color: 'var(--color-accent)', fontSize: '0.875rem' }}>← Back to projects</Link>
            </div>
        );
    }

    const accounts = accountsByProject(project.id);

    return (
        <div className="animate-fade-in">
            {/* Breadcrumb */}
            <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: '1.25rem' }}>
                <ArrowLeft size={13} /> Projects
            </Link>

            {/* Project header */}
            <div
                className="card"
                style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: `4px solid ${project.color}` }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: project.color + '20', border: `1px solid ${project.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <KeyRound size={20} color={project.color} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{project.name}</h1>
                            {project.description && (
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                                    {project.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => setShowEditProject(true)}>
                            Edit
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            onClick={() => {
                                if (confirm(`Delete project "${project.name}" and all its accounts?`)) {
                                    deleteAccountsByProject(project.id);
                                    deleteProject(project.id);
                                    navigate('/projects');
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accounts</div>
                        <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{accounts.length}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Accounts */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: 600 }}>Service Accounts</h2>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddAccount(true)}>
                    Add Account
                </Button>
            </div>

            {accounts.length === 0 ? (
                <div
                    className="card"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', borderStyle: 'dashed', gap: '0.75rem' }}
                >
                    <KeyRound size={32} color="var(--color-text-muted)" />
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        No accounts in this project yet.
                    </p>
                    <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddAccount(true)}>
                        Add First Account
                    </Button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {accounts.map(a => (
                        <div
                            key={a.id}
                            className="card"
                            style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'var(--transition)' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                        >
                            <ServiceTypeIcon type={a.type} size={38} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', gap: '1rem' }}>
                                    <span>{SERVICE_TYPE_LABELS[a.type]}</span>
                                    {a.host && <span>{a.host}{a.port ? `:${a.port}` : ''}</span>}
                                    {a.database && <span>db: {a.database}</span>}
                                    {a.bucket && <span>bucket: {a.bucket}</span>}
                                    {a.appName && <span>app: {a.appName}</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)', padding: '0.2rem 0.5rem', borderRadius: '5px' }}>
                                    <Server size={11} />
                                    {a.agentId || 'no agent'}
                                </div>
                                <button
                                    onClick={() => { if (confirm(`Delete account "${a.name}"?`)) deleteAccount(a.id); }}
                                    style={{ padding: '0.35rem', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            <AccountFormModal
                isOpen={showAddAccount}
                onClose={() => setShowAddAccount(false)}
                onSave={data => createAccount(data)}
                projectId={project.id}
            />
            {showEditProject && (
                <ProjectFormModal
                    isOpen
                    onClose={() => setShowEditProject(false)}
                    onSave={data => { updateProject(project.id, data); setShowEditProject(false); }}
                    initial={project}
                />
            )}
        </div>
    );
}
