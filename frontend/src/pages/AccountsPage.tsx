import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { AccountFormModal } from '../components/modals/AccountFormModal';
import { Button } from '../components/ui/Button';
import { ServiceTypeIcon } from '../components/ui/ServiceTypeIcon';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../types';
import type { ServiceType, ServiceAccount } from '../types';
import { Plus, KeyRound, Trash2, Server, Check, Copy, Play, Eye, EyeOff, RefreshCw, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function AccountsPage() {
    const { independentAccounts, createAccount, updateAccount, deleteAccount, provisionAccount } = useAccounts();
    const [showAdd, setShowAdd] = useState(false);
    const [editAccount, setEditAccount] = useState<ServiceAccount | null>(null);
    const [filterType, setFilterType] = useState<ServiceType | 'all'>('all');
    const { user } = useAuth();

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [provisioningId, setProvisioningId] = useState<string | null>(null);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const togglePassword = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const allTypes = Object.values(SERVICE_TYPE_CATEGORIES).flat() as ServiceType[];

    const displayed = filterType === 'all'
        ? independentAccounts
        : independentAccounts.filter(a => a.type === filterType);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Independent Accounts</h1>
                    <p className="text-neutral-content text-sm">
                        Service accounts not linked to any project
                    </p>
                </div>
                {user?.role !== 'user' && (
                    <Button icon={<Plus size={16} />} onClick={() => setShowAdd(true)}>
                        Add Account
                    </Button>
                )}
            </div>

            {/* Filter chips */}
            {independentAccounts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterType('all')}
                        className={twMerge(
                            clsx(
                                "btn btn-sm rounded-full bg-transparent",
                                filterType === 'all' ? "btn-primary hover:btn-primary" : "btn-neutral border-white/10 text-neutral-content hover:bg-white/5"
                            )
                        )}
                    >
                        All ({independentAccounts.length})
                    </button>
                    {allTypes.filter(t => independentAccounts.some(a => a.type === t)).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterType(t)}
                            className={twMerge(
                                clsx(
                                    "btn btn-sm rounded-full bg-transparent",
                                    filterType === t ? "btn-primary hover:btn-primary" : "btn-neutral border-white/10 text-neutral-content hover:bg-white/5"
                                )
                            )}
                        >
                            {SERVICE_TYPE_LABELS[t]}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            {independentAccounts.length === 0 ? (
                <div className="card bg-base-200 border border-white/5 border-dashed py-16 flex flex-col items-center justify-center gap-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center text-neutral-content/40">
                        <KeyRound size={32} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold">No independent accounts</h3>
                        <p className="text-sm text-neutral-content max-w-sm">
                            Add a service account here, or add them inside a project to keep them organized
                        </p>
                    </div>
                    {user?.role !== 'user' && (
                        <Button icon={<Plus size={16} />} onClick={() => setShowAdd(true)}>
                            Add Account
                        </Button>
                    )}
                </div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-10 text-neutral-content">
                    No accounts match the selected filter.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {displayed.map(a => (
                        <div
                            key={a.id}
                            className="card bg-base-200 border border-white/5 hover:border-primary/20 transition-all group overflow-hidden shadow-sm"
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
                                        {a.endpoint && <span className="flex items-center gap-1.5">endpoint: <span className="text-base-content">{a.endpoint}</span></span>}
                                        {a.appName && <span className="flex items-center gap-1.5">app: <span className="text-base-content">{a.appName}</span></span>}
                                        {a.agentId && <div className="badge badge-neutral badge-xs py-2 px-2 gap-1"><Server size={10} /> {a.agentId}</div>}
                                    </div>

                                    {a.type === 'mongodb' && a.username && a.password && a.host && a.database && (
                                        <div className="pt-1">
                                            <div className="flex items-center gap-1 max-w-xl bg-black/30 border border-white/5 rounded-md p-1 pl-3">
                                                <code className="text-[10px] text-success flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono py-1">
                                                    mongodb://{a.username}:{showPasswords[a.id] ? a.password : '••••••••'}@{a.host}:{a.port || 27017}/{a.database}
                                                </code>
                                                <div className="flex gap-1 pr-1">
                                                    <button
                                                        onClick={() => togglePassword(a.id)}
                                                        className="btn btn-ghost btn-square btn-xs text-neutral-content hover:text-base-content"
                                                        title={showPasswords[a.id] ? "Hide Password" : "Show Password"}
                                                    >
                                                        {showPasswords[a.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const uri = `mongodb://${encodeURIComponent(a.username!)}:${encodeURIComponent(a.password!)}@${a.host}:${a.port || 27017}/${encodeURIComponent(a.database!)}`;
                                                            await navigator.clipboard.writeText(uri);
                                                            setCopiedId(a.id);
                                                            setTimeout(() => setCopiedId(null), 2000);
                                                        }}
                                                        className={twMerge(
                                                            clsx(
                                                                "btn btn-ghost btn-square btn-xs",
                                                                copiedId === a.id ? "text-success" : "text-neutral-content hover:text-base-content"
                                                            )
                                                        )}
                                                        title="Copy Connection String"
                                                    >
                                                        {copiedId === a.id ? <Check size={13} /> : <Copy size={13} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {user?.role !== 'user' && (
                                    <div className="flex items-center justify-end gap-2 shrink-0 md:ml-4 pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                                        {(a.type === 'mongodb' || a.type === 'mysql' || a.type === 'postgresql') && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    icon={<Play size={13} />}
                                                    disabled={provisioningId === a.id || !a.agentId}
                                                    onClick={async () => {
                                                        if (!a.agentId) return;

                                                        let fallbackRole = '';
                                                        if (a.type === 'mongodb') fallbackRole = 'readWrite';
                                                        if (a.type === 'mysql' || a.type === 'postgresql') fallbackRole = 'ALL PRIVILEGES';

                                                        setProvisioningId(a.id);
                                                        const ok = await provisionAccount(a.agentId, 'db_create_user', {
                                                            username: a.type === 'mongodb' ? `${a.username}@${a.database}` : a.username,
                                                            password: a.password,
                                                            role: a.role || fallbackRole,
                                                            target: a.targetEntity
                                                        });
                                                        setProvisioningId(null);
                                                        if (ok) alert('Successfully provisioned account on server.');
                                                        else alert('Failed to provision account on server.');
                                                    }}
                                                    className="h-8 min-h-0 px-3"
                                                >
                                                    {provisioningId === a.id ? '...' : 'Provision'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    icon={<RefreshCw size={13} />}
                                                    disabled={provisioningId === a.id || !a.agentId}
                                                    onClick={async () => {
                                                        if (!a.agentId) return;

                                                        let fallbackRole = '';
                                                        if (a.type === 'mongodb') fallbackRole = 'readWrite';
                                                        if (a.type === 'mysql' || a.type === 'postgresql') fallbackRole = 'ALL PRIVILEGES';

                                                        setProvisioningId(a.id);
                                                        const ok = await provisionAccount(a.agentId, 'db_update_privileges', {
                                                            username: a.type === 'mongodb' ? `${a.username}@${a.database}` : a.username,
                                                            role: a.role || fallbackRole,
                                                            target: a.targetEntity
                                                        });
                                                        setProvisioningId(null);
                                                        if (ok) alert('Successfully updated privileges on server.');
                                                        else alert('Failed to update privileges on server.');
                                                    }}
                                                    className="h-8 min-h-0 px-3"
                                                    title="Sync modifications to the target entity or role selection to the server."
                                                >
                                                    Update
                                                </Button>
                                            </>
                                        )}
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

            <AccountFormModal
                isOpen={showAdd}
                onClose={() => setShowAdd(false)}
                onSave={data => createAccount({ ...data, projectId: undefined })}
            />
            {editAccount && (
                <AccountFormModal
                    isOpen={true}
                    onClose={() => setEditAccount(null)}
                    onSave={data => updateAccount(editAccount.id, data)}
                    initial={editAccount}
                />
            )}
        </div>
    );
}

