import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Fields';
import { Shield, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';


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
    const res = await fetch(`/api/control`, {
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
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchDecisions();
        }
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
            <div className="space-y-6 text-sm">
                {/* Status bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-warning">
                        <div className="p-2 rounded-lg bg-warning/10">
                            <Shield size={18} />
                        </div>
                        <span className="text-sm font-bold">{decisions.length} Active Decision{decisions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 hover:bg-white/5"
                        onClick={fetchDecisions}
                        loading={loading}
                    >
                        <RefreshCw size={14} className={clsx("mr-1.5", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>

                {/* Error */}
                {error && (
                    <div className="alert alert-error text-xs p-3 rounded-xl border border-error/20 flex items-start">
                        <div className="p-1 rounded bg-error/10 mr-1">
                            <AlertTriangle size={14} />
                        </div>
                        <span>{error}</span>
                    </div>
                )}

                {/* Add decision form */}
                <div className="p-4 bg-base-200 rounded-xl border border-white/5 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end gap-3">
                        <div className="md:col-span-2">
                            <Input
                                label="IP Address"
                                placeholder="e.g. 1.2.3.4"
                                value={newIp}
                                onChange={e => setNewIp(e.target.value)}
                            />
                        </div>
                        <div className="w-full">
                            <Input
                                label="Duration"
                                placeholder="4h"
                                value={newDuration}
                                onChange={e => setNewDuration(e.target.value)}
                            />
                        </div>
                        <div className="w-full">
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
                            className="w-full h-11"
                            onClick={handleAdd}
                            loading={actionLoading === 'add'}
                            disabled={!newIp}
                        >
                            <Plus size={16} />
                            Add Decision
                        </Button>
                        <div className="md:col-span-4 mt-1">
                            <Input
                                label="Reason (optional)"
                                placeholder="e.g. repeated failed logins"
                                value={newReason}
                                onChange={e => setNewReason(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Decisions Table */}
                <div className="rounded-xl border border-white/5 overflow-hidden bg-base-200/50 backdrop-blur-sm shadow-sm ring-1 ring-white/5">
                    <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                            <thead>
                                <tr className="bg-base-300/50 text-[10px] uppercase font-black tracking-[0.15em] text-neutral-content/40 border-b border-white/5 leading-none h-10">
                                    <th className="pl-4 w-12 text-center">ID</th>
                                    <th>Source</th>
                                    <th>Value</th>
                                    <th>Reason</th>
                                    <th>Type</th>
                                    <th>Duration</th>
                                    <th className="pr-4 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && decisions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-neutral-content/40 italic">
                                            <span className="loading loading-spinner h-6 w-6 mb-2" />
                                            <div>Loading decisions...</div>
                                        </td>
                                    </tr>
                                ) : decisions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-neutral-content/40 italic">
                                            No active decisions — all clear 🎉
                                        </td>
                                    </tr>
                                ) : (
                                    decisions.map(dec => {
                                        const isBan = dec.type === 'ban';
                                        return (
                                            <tr key={dec.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 group last:border-0 h-12">
                                                <td className="pl-4 text-center font-mono opacity-40 text-[11px]">{dec.id}</td>
                                                <td className="text-[10px] uppercase font-bold text-neutral-content/40">{dec.origin}</td>
                                                <td className="font-mono font-bold text-xs text-warning/80">{dec.value}</td>
                                                <td className="max-w-[200px] truncate text-neutral-content/60 text-[11px]" title={dec.reason}>
                                                    {dec.reason}
                                                </td>
                                                <td>
                                                    <span className={twMerge(
                                                        clsx(
                                                            "badge badge-xs font-black uppercase text-[9px] px-2 py-2 border leading-none shadow-sm",
                                                            isBan ? "bg-error/10 text-error border-error/20" : "bg-warning/10 text-warning border-warning/20"
                                                        )
                                                    )}>
                                                        {dec.type}
                                                    </span>
                                                </td>
                                                <td className="text-neutral-content/60 text-[11px] font-mono">{dec.duration}</td>
                                                <td className="pr-4 text-right">
                                                    <button
                                                        title="Delete decision"
                                                        onClick={() => handleDelete(dec.id)}
                                                        disabled={actionLoading === `del-${dec.id}`}
                                                        className="btn btn-ghost btn-xs btn-square text-neutral-content/30 hover:text-error hover:bg-error/10 transition-all rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    >
                                                        {actionLoading === `del-${dec.id}` ? (
                                                            <span className="loading loading-spinner h-3.5 w-3.5" />
                                                        ) : (
                                                            <Trash2 size={14} />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

