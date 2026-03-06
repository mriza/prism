import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { ProjectFormModal } from '../components/modals/ProjectFormModal';
import { Button } from '../components/ui/Button';
import { Plus, FolderKanban, Pencil, Trash2, KeyRound } from 'lucide-react';
import type { Project } from '../types';

export function ProjectsPage() {
    const { projects, createProject, updateProject, deleteProject } = useProjects();
    const { accountsByProject, deleteAccountsByProject } = useAccounts();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<Project | null>(null);
    const [search, setSearch] = useState('');

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Projects</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                        Group your service accounts by project
                    </p>
                </div>
                <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                    New Project
                </Button>
            </div>

            {/* Search */}
            {projects.length > 0 && (
                <input
                    type="search"
                    placeholder="Search projects…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        maxWidth: '320px',
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'inherit',
                        fontSize: '0.875rem',
                        padding: '0.5rem 0.75rem',
                        marginBottom: '1.25rem',
                        outline: 'none',
                    }}
                />
            )}

            {/* Empty state */}
            {projects.length === 0 ? (
                <div
                    className="card"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4rem 2rem',
                        borderStyle: 'dashed',
                        gap: '1rem',
                    }}
                >
                    <FolderKanban size={40} color="var(--color-text-muted)" />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>No projects yet</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            Create your first project to start organizing service accounts
                        </div>
                    </div>
                    <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                        Create Project
                    </Button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {filtered.map(p => {
                        const accountCount = accountsByProject(p.id).length;
                        return (
                            <div
                                key={p.id}
                                className="card"
                                style={{ overflow: 'hidden', transition: 'var(--transition)' }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = p.color + '55';
                                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${p.color}10`;
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                }}
                            >
                                {/* Color strip */}
                                <div style={{ height: '4px', background: p.color }} />

                                <div style={{ padding: '1.25rem' }}>
                                    {/* Title row */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <Link
                                            to={`/projects/${p.id}`}
                                            style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
                                        >
                                            <h2
                                                style={{ fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = p.color)}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                                            >
                                                {p.name}
                                            </h2>
                                        </Link>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                            <button
                                                onClick={() => setEditing(p)}
                                                style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                title="Edit"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm(`Delete project "${p.name}" and all its accounts?`)) { deleteAccountsByProject(p.id); deleteProject(p.id); } }}
                                                style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                                title="Delete"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {p.description && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                                            {p.description}
                                        </p>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            <KeyRound size={12} />
                                            {accountCount} account{accountCount !== 1 ? 's' : ''}
                                        </div>
                                        <Link
                                            to={`/projects/${p.id}`}
                                            style={{ fontSize: '0.75rem', color: p.color, textDecoration: 'none', fontWeight: 500 }}
                                        >
                                            View →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
        </div>
    );
}
