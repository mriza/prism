import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { ProjectFormModal } from '../components/modals/ProjectFormModal';
import { Button } from '../components/ui/Button';
import { Plus, FolderKanban, Pencil, Trash2, KeyRound, Search } from 'lucide-react';
import type { Project } from '../types';

export function ProjectsPage() {
    const { projects, createProject, updateProject, deleteProject } = useProjects();
    const { accountsByProject, deleteAccountsByProject } = useAccounts();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<Project | null>(null);
    const [search, setSearch] = useState('');
    const { user } = useAuth();

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Projects</h1>
                    <p className="text-neutral-content text-sm">
                        Group your service accounts by project
                    </p>
                </div>
                {user?.role !== 'user' && (
                    <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                        New Project
                    </Button>
                )}
            </div>

            {/* Search */}
            {projects.length > 0 && (
                <div className="relative max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-content/50" />
                    <input
                        type="search"
                        placeholder="Search projects…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input input-bordered bg-base-200 focus:input-primary w-full pl-10"
                    />
                </div>
            )}

            {/* Empty state */}
            {projects.length === 0 ? (
                <div className="card bg-base-200 border border-white/5 border-dashed py-16 flex flex-col items-center justify-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center text-neutral-content/40">
                        <FolderKanban size={32} />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-lg font-semibold">No projects yet</h3>
                        <p className="text-sm text-neutral-content max-w-xs">
                            Create your first project to start organizing service accounts
                        </p>
                    </div>
                    {user?.role !== 'user' && (
                        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                            Create Project
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(p => {
                        const accountCount = accountsByProject(p.id).length;
                        return (
                            <div
                                key={p.id}
                                className="card bg-base-200 border border-white/5 hover:border-primary/20 transition-all overflow-hidden group shadow-sm"
                            >
                                {/* Color strip */}
                                <div className="h-1" style={{ background: p.color }} />

                                <div className="p-6 space-y-4">
                                    {/* Title row */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1 flex-1">
                                            <Link to={`/projects/${p.id}`}>
                                                <h2 className="font-bold text-lg group-hover:text-primary transition-colors cursor-pointer line-clamp-1">
                                                    {p.name}
                                                </h2>
                                            </Link>
                                            {p.description && (
                                                <p className="text-sm text-neutral-content line-clamp-2 leading-relaxed">
                                                    {p.description}
                                                </p>
                                            )}
                                        </div>
                                        {user?.role !== 'user' && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setEditing(p)}
                                                    className="btn btn-ghost btn-square btn-xs text-neutral-content hover:text-base-content"
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => { if (confirm(`Delete project "${p.name}" and all its accounts?`)) { deleteAccountsByProject(p.id); deleteProject(p.id); } }}
                                                    className="btn btn-ghost btn-square btn-xs text-neutral-content hover:btn-error hover:text-error-content"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2 text-xs text-neutral-content font-medium">
                                            <KeyRound size={14} />
                                            <span>{accountCount} account{accountCount !== 1 ? 's' : ''}</span>
                                        </div>
                                        <Link
                                            to={`/projects/${p.id}`}
                                            className="btn btn-ghost btn-xs text-neutral-content group-hover:text-primary"
                                            style={{ color: p.color }}
                                        >
                                            View Details →
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

