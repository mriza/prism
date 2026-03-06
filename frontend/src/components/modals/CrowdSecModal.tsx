import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Fields';
import { Shield, Plus, Trash2, RefreshCw } from 'lucide-react';

const HUB = import.meta.env.VITE_HUB_URL || '';

interface Decision {
    id: number;
    origin: string;
    scope: string;
    value: string;
    reason: string;
    type: string;
    duration: string;
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
        body: JSON.stringify({ agent_id: agentId, service: 'crowdsec', action, options }),
    });
    return res.json();
}

export function CrowdSecModal({ isOpen, onClose, agentId }: Props) {
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newIp, setNewIp] = useState('');
    const [newDuration, setNewDuration] = useState('4h');
    const [newReason, setNewReason] = useState('');
    const [newType, setNewType] = useState('ban');
    const [actionLoading, setActionLoading] = useState('');

    const fetchDecisions = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await controlAgent(agentId, 'crowdsec_list');
            if (data.success) {
                let parsed = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
                if (!Array.isArray(parsed)) parsed = [];
                setDecisions(parsed);
            } else {
                setError(data.message || 'Failed to fetch decisions');
            }
        } catch {
            setError('Could not connect to agent');
        }
        setLoading(false);
    }, [agentId]);

    useEffect(() => {
        if (isOpen) fetchDecisions();
    }, [isOpen, fetchDecisions]);

    const handleAdd = async () => {
        if (!newIp) return;
        setActionLoading('add');
        await controlAgent(agentId, 'crowdsec_add', {
            ip: newIp,
            duration: newDuration,
            reason: newReason || 'manual via PRISM',
            type: newType,
        });
        setNewIp('');
        setNewReason('');
        await fetchDecisions();
        setActionLoading('');
    };

    const handleDelete = async (id: number) => {
        setActionLoading(`del-${id}`);
        await controlAgent(agentId, 'crowdsec_delete', { id: String(id) });
        await fetchDecisions();
        setActionLoading('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`CrowdSec — ${agentId}`} size="xl">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Status bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fb923c', fontSize: '0.8rem' }}>
                        <Shield size={16} />
                        <span>{decisions.length} active decision{decisions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={fetchDecisions} loading={loading}>
                        Refresh
                    </Button>
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

                {/* Add decision form */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    padding: '0.875rem',
                    background: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    flexWrap: 'wrap',
                }}>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                        <Input
                            label="IP Address"
                            placeholder="e.g. 1.2.3.4"
                            value={newIp}
                            onChange={e => setNewIp(e.target.value)}
                        />
                    </div>
                    <div style={{ width: '90px' }}>
                        <Input
                            label="Duration"
                            placeholder="4h"
                            value={newDuration}
                            onChange={e => setNewDuration(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '100px' }}>
                        <Input
                            label="Reason"
                            placeholder="optional"
                            value={newReason}
                            onChange={e => setNewReason(e.target.value)}
                        />
                    </div>
                    <div style={{ width: '100px' }}>
                        <Select
                            label="Type"
                            value={newType}
                            onChange={e => setNewType(e.target.value)}
                            options={[
                                { value: 'ban', label: 'Ban' },
                                { value: 'captcha', label: 'Captcha' },
                                { value: 'throttle', label: 'Throttle' },
                            ]}
                        />
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        icon={<Plus size={14} />}
                        onClick={handleAdd}
                        loading={actionLoading === 'add'}
                        disabled={!newIp}
                    >
                        Add
                    </Button>
                </div>

                {/* Decisions table */}
                <div style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                }}>
                    {/* Table header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '55px 80px 1fr 1fr 80px 70px 50px',
                        padding: '0.625rem 0.875rem',
                        background: 'var(--color-bg-elevated)',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--color-text-secondary)',
                    }}>
                        <span>ID</span>
                        <span>Source</span>
                        <span>Value</span>
                        <span>Reason</span>
                        <span>Type</span>
                        <span>Duration</span>
                        <span></span>
                    </div>

                    {/* Table rows */}
                    {loading && decisions.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            Loading decisions…
                        </div>
                    ) : decisions.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            No active decisions — all clear 🎉
                        </div>
                    ) : (
                        decisions.map(dec => {
                            const isBan = dec.type === 'ban';
                            return (
                                <div
                                    key={dec.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '55px 80px 1fr 1fr 80px 70px 50px',
                                        padding: '0.5rem 0.875rem',
                                        borderBottom: '1px solid var(--color-border)',
                                        fontSize: '0.78rem',
                                        alignItems: 'center',
                                        transition: 'var(--transition)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{dec.id}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{dec.origin}</span>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-primary)', fontWeight: 500, fontSize: '0.78rem' }}>
                                        {dec.value}
                                    </span>
                                    <span style={{
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '0.73rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                        title={dec.reason}
                                    >
                                        {dec.reason}
                                    </span>
                                    <span>
                                        <span style={{
                                            display: 'inline-flex',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: '4px',
                                            fontSize: '0.68rem',
                                            fontWeight: 600,
                                            background: isBan ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
                                            color: isBan ? '#f87171' : '#facc15',
                                            border: `1px solid ${isBan ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'}`,
                                        }}>
                                            {dec.type?.toUpperCase()}
                                        </span>
                                    </span>
                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>{dec.duration}</span>
                                    <button
                                        title="Delete decision"
                                        onClick={() => handleDelete(dec.id)}
                                        disabled={actionLoading === `del-${dec.id}`}
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
                                            opacity: actionLoading === `del-${dec.id}` ? 0.4 : 1,
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
