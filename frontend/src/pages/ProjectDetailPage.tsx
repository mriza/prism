import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { AccountFormModal } from '../components/modals/AccountFormModal';
import { ProjectFormModal } from '../components/modals/ProjectFormModal';
import { Button } from '../components/ui/Button';
import { ServiceTypeIcon } from '../components/ui/ServiceTypeIcon';
import { SERVICE_TYPE_LABELS } from '../types';
import { Plus, ArrowLeft, Pencil, Trash2, Server, KeyRound, Copy, Check, Play, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import type { ServiceAccount } from '../types';

export function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { projects, updateProject, deleteProject } = useProjects();
    const { accountsByProject, createAccount, updateAccount, deleteAccount, deleteAccountsByProject, provisionAccount } = useAccounts();
    const navigate = useNavigate();
    const { user } = useAuth();

    const project = projects.find(p => p.id === id);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [editAccount, setEditAccount] = useState<ServiceAccount | null>(null);
    const [showEditProject, setShowEditProject] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [provisioningId, setProvisioningId] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-neutral-content">Project not found.</p>
                <Link to="/projects" className="btn btn-primary btn-sm">← Back to projects</Link>
            </div>
        );
    }

    const accounts = accountsByProject(project.id);

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="text-sm">
                <Link to="/projects" className="flex items-center gap-1.5 text-neutral-content hover:text-primary transition-colors">
                    <ArrowLeft size={14} /> <span>Projects</span>
                </Link>
            </nav>

            {/* Project header card */}
            <div className="card bg-base-200 border border-white/5 overflow-hidden">
                <div className="h-1.5 w-full" style={{ background: project.color }} />
                <div className="card-body p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/10" style={{ background: `${project.color}20` }}>
                                <KeyRound size={28} style={{ color: project.color }} />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-2xl font-bold">{project.name}</h1>
                                {project.description && (
                                    <p className="text-neutral-content text-sm max-w-2xl">
                                        {project.description}
                                    </p>
                                )}
                            </div>
                        </div>
                        {user?.role !== 'user' && (
                            <div className="flex gap-2 shrink-0">
                                <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEditProject(true)}>
                                    Edit Project
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    icon={<Trash2 size={14} />}
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
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 mt-8 border-t border-white/5">
                        <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-content/60">Service Accounts</div>
                            <div className="text-xl font-bold">{accounts.length}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-content/60">Date Created</div>
                            <div className="text-base font-semibold">{new Date(project.createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Accounts section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <span>Service Accounts</span>
                        <div className="badge badge-neutral badge-sm font-mono">{accounts.length}</div>
                    </h2>
                    {user?.role !== 'user' && (
                        <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowAddAccount(true)}>
                            Add Account
                        </Button>
                    )}
                </div>

                {accounts.length === 0 ? (
                    <div className="card bg-base-200 border border-white/5 border-dashed py-12 flex flex-col items-center justify-center gap-4">
                        <KeyRound size={32} className="text-neutral-content/40" />
                        <p className="text-sm text-neutral-content">No accounts in this project yet.</p>
                        {user?.role !== 'user' && (
                            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setShowAddAccount(true)}>
                                Add First Account
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {accounts.map(a => (
                            <div
                                key={a.id}
                                className="card bg-base-200 border border-white/5 hover:border-primary/20 transition-all group overflow-hidden"
                            >
                                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="shrink-0 flex items-center gap-4">
                                        <ServiceTypeIcon type={a.type} size={42} />
                                        <div className="md:hidden">
                                            <div className="font-bold text-base">{a.name}</div>
                                            <div className="text-xs text-neutral-content uppercase tracking-wider font-semibold">{SERVICE_TYPE_LABELS[a.type]}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="hidden md:block font-bold text-base line-clamp-1">{a.name}</div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-content font-medium">
                                            <span className="hidden md:inline text-primary uppercase tracking-wider">{SERVICE_TYPE_LABELS[a.type]}</span>
                                            {a.host && <span className="flex items-center gap-1.5"><Server size={12} className="opacity-60" /> {a.host}{a.port ? `:${a.port}` : ''}</span>}
                                            {a.database && <span className="flex items-center gap-1.5">db: <span className="text-base-content">{a.database}</span></span>}
                                            {a.bucket && <span className="flex items-center gap-1.5">bucket: <span className="text-base-content">{a.bucket}</span></span>}
                                            {a.appName && <span className="flex items-center gap-1.5">app: <span className="text-base-content">{a.appName}</span></span>}
                                            {a.agentId && <div className="badge badge-neutral badge-xs py-2 px-2 gap-1"><Server size={10} /> {a.agentId}</div>}
                                        </div>

                                        {/* Connection Info / Credentials Blocks */}
                                        <div className="pt-2 grid grid-cols-1 gap-2">
                                            {/* Database URI (Mongo/MySQL/Postgre) */}
                                            {(a.type === 'mongodb' || a.type === 'mysql' || a.type === 'postgresql') && a.username && a.password && a.host && (
                                                <div className="flex items-center gap-1 max-w-xl bg-black/30 border border-white/5 rounded-md p-1 pl-3">
                                                    <code className="text-[10px] text-success flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono py-1">
                                                        {a.type === 'mongodb' 
                                                            ? `mongodb://${a.username}:${showPasswords[a.id] ? a.password : '••••••••'}@${a.host}:${a.port || 27017}/${a.database}`
                                                            : `${a.type}://${a.username}:${showPasswords[a.id] ? a.password : '••••••••'}@${a.host}:${a.port}/${a.database}`
                                                        }
                                                    </code>
                                                    <div className="flex gap-1 pr-1">
                                                        <button
                                                            onClick={() => togglePassword(a.id)}
                                                            className="btn btn-ghost btn-square btn-xs text-neutral-content hover:text-base-content"
                                                        >
                                                            {showPasswords[a.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const uri = a.type === 'mongodb'
                                                                    ? `mongodb://${encodeURIComponent(a.username!)}:${encodeURIComponent(a.password!)}@${a.host}:${a.port || 27017}/${encodeURIComponent(a.database!)}`
                                                                    : `${a.type}://${encodeURIComponent(a.username!)}:${encodeURIComponent(a.password!)}@${a.host}:${a.port}/${encodeURIComponent(a.database!)}`;
                                                                await navigator.clipboard.writeText(uri);
                                                                setCopiedId(a.id);
                                                                setTimeout(() => setCopiedId(null), 2000);
                                                            }}
                                                            className={clsx("btn btn-ghost btn-square btn-xs", copiedId === a.id ? "text-success" : "text-neutral-content")}
                                                        >
                                                            {copiedId === a.id ? <Check size={13} /> : <Copy size={13} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* S3 Credentials */}
                                            {(a.type === 's3-minio' || a.type === 's3-garage') && a.accessKey && (
                                                <div className="flex items-center gap-3 text-[11px] font-mono bg-base-300/50 p-3 rounded-xl border border-white/5">
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex justify-between border-b border-white/5 pb-1">
                                                            <span className="opacity-40 uppercase">Endpoint</span>
                                                            <span className="text-white">{a.endpoint || a.host}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-white/5 pb-1">
                                                            <span className="opacity-40 uppercase">AccessKey</span>
                                                            <code className="text-primary">{a.accessKey}</code>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="opacity-40 uppercase">SecretKey</span>
                                                            <div className="flex items-center gap-2">
                                                                <code className="text-success">{showPasswords[a.id] ? a.secretKey : '••••••••••••••••'}</code>
                                                                <button onClick={() => togglePassword(a.id)} className="opacity-20 hover:opacity-100 transition-opacity">
                                                                    {showPasswords[a.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* MQTT/FTP Credentials */}
                                            {(a.type === 'mqtt-mosquitto' || a.type === 'ftp-vsftpd') && a.username && (
                                                <div className="flex items-center gap-1 max-w-xl bg-black/20 border border-white/5 rounded-md p-1 pl-3">
                                                    <span className="text-[10px] opacity-40 uppercase mr-2 font-bold">{a.type === 'mqtt-mosquitto' ? 'MQTT' : 'FTP'}</span>
                                                    <code className="text-[10px] text-neutral-content flex-1 font-mono">
                                                        {a.username} : {showPasswords[a.id] ? a.password : '••••••••'}
                                                    </code>
                                                    <button onClick={() => togglePassword(a.id)} className="btn btn-ghost btn-xs text-neutral-content">
                                                        {showPasswords[a.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {user?.role !== 'user' && (
                                        <div className="flex items-center justify-end gap-2 shrink-0 md:ml-4 pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                                            {/* Logic for manual provisioning/sync */}
                                            {(() => {
                                                const isDb = a.type === 'mongodb' || a.type === 'mysql' || a.type === 'postgresql';
                                                const isStorage = a.type === 's3-minio' || a.type === 's3-garage';
                                                const isWeb = a.type === 'web-caddy' || a.type === 'web-nginx';
                                                const isFTP = a.type === 'ftp-vsftpd';
                                                const handleProvision = async () => {
                                                    setProvisioningId(a.id);
                                                    let action = '';
                                                    let options: Record<string, unknown> = {};
                                                    const isMongo = a.type === 'mongodb';
                                                    
                                                    if (isDb) {
                                                        action = 'db_create_user';
                                                        const fallbackRole = isMongo ? 'readWrite' : 'ALL PRIVILEGES';
                                                        options = {
                                                            username: isMongo ? `${a.username}@${a.database}` : a.username,
                                                            password: a.password,
                                                            role: a.role || fallbackRole,
                                                            target: a.targetEntity
                                                        };
                                                    } else if (a.type === 'rabbitmq') {
                                                        action = 'db_sync';
                                                        options = { bindings: a.bindings };
                                                    } else if (a.type === 'mqtt-mosquitto') {
                                                        action = 'mq_create_user';
                                                        options = { username: a.username, password: a.password };
                                                    } else if (isStorage) {
                                                        action = 'storage_create_bucket';
                                                        options = { name: a.bucket };
                                                        // Also create user
                                                        await provisionAccount(a.agentId!, 'storage_create_user', { access_key: a.accessKey, secret_key: a.secretKey });
                                                    } else if (isWeb) {
                                                        action = 'proxy_create';
                                                        options = { domain: a.endpoint, port: Number(a.port) };
                                                    } else if (isFTP) {
                                                        action = 'ftp_create_user';
                                                        options = { username: a.username, password: a.password, root_path: a.rootPath };
                                                    }

                                                    if (action) {
                                                        const ok = await provisionAccount(a.agentId!, action, options);
                                                        if (ok) alert('Successfully provisioned on server.');
                                                        else alert('Failed to provision on server.');
                                                    }
                                                    setProvisioningId(null);
                                                };

                                                return (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            icon={<Play size={13} />}
                                                            disabled={provisioningId === a.id}
                                                            onClick={handleProvision}
                                                            className="h-8 min-h-0 px-3"
                                                        >
                                                            {provisioningId === a.id ? '...' : 'Provision'}
                                                        </Button>
                                                        {isDb && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                icon={<RefreshCw size={13} />}
                                                                disabled={provisioningId === a.id}
                                                                onClick={async () => {
                                                                    setProvisioningId(a.id);
                                                                    const isMongo = a.type === 'mongodb';
                                                                    const fallbackRole = isMongo ? 'readWrite' : 'ALL PRIVILEGES';
                                                                    const ok = await provisionAccount(a.agentId!, 'db_update_privileges', {
                                                                        username: isMongo ? `${a.username}@${a.database}` : a.username,
                                                                        role: a.role || fallbackRole,
                                                                        target: a.targetEntity
                                                                    });
                                                                    setProvisioningId(null);
                                                                    if (ok) alert('Successfully updated privileges.');
                                                                    else alert('Failed to update privileges.');
                                                                }}
                                                                className="h-8 min-h-0 px-3"
                                                            >
                                                                Sync
                                                            </Button>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                            <button
                                                onClick={() => setEditAccount(a)}
                                                className="btn btn-ghost btn-square btn-sm text-neutral-content hover:text-primary"
                                                title="Edit Account"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm(`Delete account "${a.name}"?`)) deleteAccount(a.id); }}
                                                className="btn btn-ghost btn-square btn-sm text-neutral-content hover:btn-error hover:text-error-content"
                                                title="Delete Account"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AccountFormModal
                isOpen={showAddAccount}
                onClose={() => setShowAddAccount(false)}
                onSave={data => createAccount(data)}
                projectId={project.id}
            />
            {editAccount && (
                <AccountFormModal
                    isOpen={true}
                    onClose={() => setEditAccount(null)}
                    onSave={data => updateAccount(editAccount.id, data)}
                    initial={editAccount}
                />
            )}
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

