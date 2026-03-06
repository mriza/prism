import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { AccountFormModal } from '../components/modals/AccountFormModal';
import { Button } from '../components/ui/Button';
import { ServiceTypeIcon } from '../components/ui/ServiceTypeIcon';
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_CATEGORIES } from '../types';
import type { ServiceType } from '../types';
import { Plus, KeyRound, Trash2, Server } from 'lucide-react';

export function AccountsPage() {
    const { independentAccounts, createAccount, deleteAccount } = useAccounts();
    const [showAdd, setShowAdd] = useState(false);
    const [filterType, setFilterType] = useState<ServiceType | 'all'>('all');

    const allTypes = Object.values(SERVICE_TYPE_CATEGORIES).flat() as ServiceType[];

    const displayed = filterType === 'all'
        ? independentAccounts
        : independentAccounts.filter(a => a.type === filterType);

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Independent Accounts</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                        Service accounts not linked to any project
                    </p>
                </div>
                <Button icon={<Plus size={16} />} onClick={() => setShowAdd(true)}>
                    Add Account
                </Button>
            </div>

            {/* Filter chips */}
            {independentAccounts.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                    <button
                        onClick={() => setFilterType('all')}
                        style={{
                            padding: '0.3rem 0.75rem',
                            borderRadius: '20px',
                            border: `1px solid ${filterType === 'all' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            background: filterType === 'all' ? 'var(--color-accent-subtle)' : 'transparent',
                            color: filterType === 'all' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                        }}
                    >
                        All ({independentAccounts.length})
                    </button>
                    {allTypes.filter(t => independentAccounts.some(a => a.type === t)).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterType(t)}
                            style={{
                                padding: '0.3rem 0.75rem',
                                borderRadius: '20px',
                                border: `1px solid ${filterType === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                background: filterType === t ? 'var(--color-accent-subtle)' : 'transparent',
                                color: filterType === t ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                fontFamily: 'inherit',
                            }}
                        >
                            {SERVICE_TYPE_LABELS[t]}
                        </button>
                    ))}
                </div>
            )}

            {/* Empty */}
            {independentAccounts.length === 0 ? (
                <div
                    className="card"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', borderStyle: 'dashed', gap: '1rem' }}
                >
                    <KeyRound size={40} color="var(--color-text-muted)" />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>No independent accounts</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            Add a service account here, or add them inside a project
                        </div>
                    </div>
                    <Button icon={<Plus size={16} />} onClick={() => setShowAdd(true)}>
                        Add Account
                    </Button>
                </div>
            ) : displayed.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No accounts match the selected filter.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {displayed.map(a => (
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
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <span>{SERVICE_TYPE_LABELS[a.type]}</span>
                                    {a.host && <span>{a.host}{a.port ? `:${a.port}` : ''}</span>}
                                    {a.database && <span>db: {a.database}</span>}
                                    {a.bucket && <span>bucket: {a.bucket}</span>}
                                    {a.endpoint && <span>{a.endpoint}</span>}
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

            <AccountFormModal
                isOpen={showAdd}
                onClose={() => setShowAdd(false)}
                onSave={data => createAccount({ ...data, projectId: undefined })}
            />
        </div>
    );
}
