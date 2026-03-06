import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Fields';
import { ShieldCheck, Plus, Trash2, RefreshCw, ShieldOff, ShieldAlert } from 'lucide-react';

const HUB = import.meta.env.VITE_HUB_URL || '';

interface FirewallRule {
    id: string;
    description: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
}

async function controlAgent(agentId: string, action: string, options?: Record<string, unknown>) {
    const res = await fetch(`${HUB}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, service: 'ufw', action, options }),
    });
    return res.json();
}

export function FirewallModal({ isOpen, onClose, agentId }: Props) {
    const [rules, setRules] = useState<FirewallRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newPort, setNewPort] = useState('');
    const [newProtocol, setNewProtocol] = useState('tcp');
    const [newAction, setNewAction] = useState('allow');
    const [actionLoading, setActionLoading] = useState('');

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await controlAgent(agentId, 'ufw_list');
            if (data.success) {
                const parsed = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
                setRules(parsed || []);
            } else {
                setError(data.message || 'Failed to fetch rules');
            }
        } catch (e) {
            setError('Could not connect to agent');
        }
        setLoading(false);
    }, [agentId]);

    useEffect(() => {
        if (isOpen) fetchRules();
    }, [isOpen, fetchRules]);

    const handleAdd = async () => {
        if (!newPort) return;
        setActionLoading('add');
        await controlAgent(agentId, 'ufw_add', {
            port: parseFloat(newPort),
            protocol: newProtocol,
            action: newAction,
        });
        setNewPort('');
        await fetchRules();
        setActionLoading('');
    };

    const handleDelete = async (ruleId: string) => {
        setActionLoading(`del-${ruleId}`);
        await controlAgent(agentId, 'ufw_delete', { rule_id: ruleId });
        await fetchRules();
        setActionLoading('');
    };

    const handleDefaultPolicy = async (policy: string) => {
        setActionLoading(`default-${policy}`);
        await controlAgent(agentId, 'ufw_default', { policy, direction: 'incoming' });
        await fetchRules();
        setActionLoading('');
    };

    // Parse rule description into structured columns
    const parseRule = (desc: string) => {
        // e.g. "22/tcp                     ALLOW IN    Anywhere"
        const parts = desc.split(/\s{2,}/);
        return {
            to: parts[0]?.trim() || '',
            action: parts[1]?.trim() || '',
            from: parts[2]?.trim() || '',
        };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Firewall — ${agentId}`} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Status bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', fontSize: '0.8rem' }}>
                        <ShieldCheck size={16} />
                        <span>{rules.length} active rules</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={fetchRules} loading={loading}>
                            Refresh
                        </Button>
                        <Button variant="secondary" size="sm" icon={<ShieldOff size={12} />} onClick={() => handleDefaultPolicy('allow')} loading={actionLoading === 'default-allow'}>
                            Allow All
                        </Button>
                        <Button variant="danger" size="sm" icon={<ShieldAlert size={12} />} onClick={() => handleDefaultPolicy('deny')} loading={actionLoading === 'default-deny'}>
                            Block All
                        </Button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '0.625rem 0.875rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        fontSize: '0.8rem',
                    }}>
                        {error}
                    </div>
                )}

                {/* Add rule form */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    padding: '0.875rem',
                    background: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                }}>
                    <div style={{ flex: 1 }}>
                        <Input
                            label="Port"
                            type="number"
                            placeholder="e.g. 8080"
                            value={newPort}
                            onChange={e => setNewPort(e.target.value)}
                        />
                    </div>
                    <div style={{ width: '90px' }}>
                        <Select
                            label="Protocol"
                            value={newProtocol}
                            onChange={e => setNewProtocol(e.target.value)}
                            options={[
                                { value: 'tcp', label: 'TCP' },
                                { value: 'udp', label: 'UDP' },
                            ]}
                        />
                    </div>
                    <div style={{ width: '100px' }}>
                        <Select
                            label="Action"
                            value={newAction}
                            onChange={e => setNewAction(e.target.value)}
                            options={[
                                { value: 'allow', label: 'Allow' },
                                { value: 'deny', label: 'Deny' },
                                { value: 'reject', label: 'Reject' },
                            ]}
                        />
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        icon={<Plus size={14} />}
                        onClick={handleAdd}
                        loading={actionLoading === 'add'}
                        disabled={!newPort}
                    >
                        Add
                    </Button>
                </div>

                {/* Rules table */}
                <div style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                }}>
                    {/* Table header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 1fr 1fr 1fr 50px',
                        padding: '0.625rem 0.875rem',
                        background: 'var(--color-bg-elevated)',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--color-text-secondary)',
                    }}>
                        <span>#</span>
                        <span>To</span>
                        <span>Action</span>
                        <span>From</span>
                        <span></span>
                    </div>

                    {/* Table rows */}
                    {loading && rules.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            Loading rules…
                        </div>
                    ) : rules.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            No firewall rules configured
                        </div>
                    ) : (
                        rules.map(rule => {
                            const parsed = parseRule(rule.description);
                            const isAllow = parsed.action.includes('ALLOW');
                            const isDeny = parsed.action.includes('DENY') || parsed.action.includes('REJECT');

                            return (
                                <div
                                    key={rule.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '50px 1fr 1fr 1fr 50px',
                                        padding: '0.5rem 0.875rem',
                                        borderBottom: '1px solid var(--color-border)',
                                        fontSize: '0.8rem',
                                        alignItems: 'center',
                                        transition: 'var(--transition)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{rule.id}</span>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                        {parsed.to}
                                    </span>
                                    <span>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: isAllow ? 'rgba(34,197,94,0.12)' : isDeny ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
                                            color: isAllow ? '#4ade80' : isDeny ? '#f87171' : '#facc15',
                                            border: `1px solid ${isAllow ? 'rgba(34,197,94,0.25)' : isDeny ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'}`,
                                        }}>
                                            {parsed.action}
                                        </span>
                                    </span>
                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{parsed.from}</span>
                                    <button
                                        title="Delete rule"
                                        onClick={() => handleDelete(rule.id)}
                                        disabled={actionLoading === `del-${rule.id}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'var(--color-text-muted)',
                                            cursor: 'pointer',
                                            transition: 'var(--transition)',
                                            opacity: actionLoading === `del-${rule.id}` ? 0.4 : 1,
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
}
