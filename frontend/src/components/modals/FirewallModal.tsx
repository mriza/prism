import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Fields';
import { ShieldCheck, Plus, Trash2, RefreshCw, ShieldOff, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';


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
    const res = await fetch(`/api/control`, {
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
        } catch {
            setError('Could not connect to agent');
        }
        setLoading(false);
    }, [agentId]);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchRules();
        }
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
            <div className="space-y-6">
                {/* Status bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-primary">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <ShieldCheck size={18} />
                        </div>
                        <span className="text-sm font-bold">{rules.length} Active Rules</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 hover:bg-white/5"
                            onClick={fetchRules}
                            loading={loading}
                        >
                            <RefreshCw size={14} className={clsx("mr-1.5", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <div className="flex bg-base-300 p-1 rounded-lg border border-white/5">
                            <button
                                onClick={() => handleDefaultPolicy('allow')}
                                disabled={actionLoading === 'default-allow'}
                                className="btn btn-ghost btn-xs text-[10px] font-bold uppercase tracking-wider h-6 min-h-6 px-3 hover:bg-success hover:text-success-content"
                            >
                                {actionLoading === 'default-allow' ? (
                                    <span className="loading loading-spinner h-3 w-3" />
                                ) : (
                                    <ShieldOff size={12} className="mr-1" />
                                )}
                                Allow All
                            </button>
                            <button
                                onClick={() => handleDefaultPolicy('deny')}
                                disabled={actionLoading === 'default-deny'}
                                className="btn btn-ghost btn-xs text-[10px] font-bold uppercase tracking-wider h-6 min-h-6 px-3 hover:bg-error hover:text-error-content"
                            >
                                {actionLoading === 'default-deny' ? (
                                    <span className="loading loading-spinner h-3 w-3" />
                                ) : (
                                    <ShieldAlert size={12} className="mr-1" />
                                )}
                                Block All
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="alert alert-error text-xs p-3 rounded-xl border border-error/20 flex items-start">
                        <div className="p-1 rounded bg-error/10 mr-1">
                            <ShieldAlert size={14} />
                        </div>
                        <span>{error}</span>
                    </div>
                )}

                {/* Add rule form */}
                <div className="p-4 bg-base-200 rounded-xl border border-white/5 shadow-inner">
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                        <div className="flex-1 w-full">
                            <Input
                                label="Port"
                                type="number"
                                placeholder="e.g. 8080"
                                value={newPort}
                                onChange={e => setNewPort(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-[100px]">
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
                        <div className="w-full sm:w-[120px]">
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
                            className="w-full sm:w-auto h-11"
                            onClick={handleAdd}
                            loading={actionLoading === 'add'}
                            disabled={!newPort}
                        >
                            <Plus size={16} />
                            Add Rule
                        </Button>
                    </div>
                </div>

                {/* Rules Table */}
                <div className="rounded-xl border border-white/5 overflow-hidden bg-base-200/50 backdrop-blur-sm shadow-sm ring-1 ring-white/5">
                    <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                            <thead>
                                <tr className="bg-base-300/50 text-[10px] uppercase font-black tracking-[0.15em] text-neutral-content/40 border-b border-white/5 leading-none h-10">
                                    <th className="pl-4 w-12 text-center">#</th>
                                    <th>To</th>
                                    <th>Action</th>
                                    <th>From</th>
                                    <th className="pr-4 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && rules.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-neutral-content/40 italic">
                                            <span className="loading loading-spinner h-6 w-6 mb-2" />
                                            <div>Loading firewall rules...</div>
                                        </td>
                                    </tr>
                                ) : rules.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-neutral-content/40 italic">
                                            No firewall rules configured
                                        </td>
                                    </tr>
                                ) : (
                                    rules.map(rule => {
                                        const parsed = parseRule(rule.description);
                                        const isAllow = parsed.action.includes('ALLOW');
                                        const isDeny = parsed.action.includes('DENY') || parsed.action.includes('REJECT');

                                        return (
                                            <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 group last:border-0 h-12">
                                                <td className="pl-4 text-center font-mono opacity-40 text-[11px]">{rule.id}</td>
                                                <td className="font-mono font-bold text-xs text-primary/80">{parsed.to}</td>
                                                <td>
                                                    <span className={twMerge(
                                                        clsx(
                                                            "badge badge-xs font-black uppercase text-[9px] px-2 py-2 border leading-none shadow-sm",
                                                            isAllow ? "bg-success/10 text-success border-success/20" : 
                                                            isDeny ? "bg-error/10 text-error border-error/20" : 
                                                            "bg-warning/10 text-warning border-warning/20"
                                                        )
                                                    )}>
                                                        {parsed.action}
                                                    </span>
                                                </td>
                                                <td className="text-neutral-content/60 text-[11px]">{parsed.from}</td>
                                                <td className="pr-4 text-right">
                                                    <button
                                                        title="Delete rule"
                                                        onClick={() => handleDelete(rule.id)}
                                                        disabled={actionLoading === `del-${rule.id}`}
                                                        className="btn btn-ghost btn-xs btn-square text-neutral-content/30 hover:text-error hover:bg-error/10 transition-all rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    >
                                                        {actionLoading === `del-${rule.id}` ? (
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

