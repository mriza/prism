import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../contexts/AuthContext';

interface FirewallRule {
    ID: string;
    Action: string;       // "ALLOW", "DENY"
    ToPorts: string;      // "80/tcp", "any"
    FromIP: string;       // "Anywhere", "192.168.1.0/24"
    Direction: string;    // "IN", "OUT"
    Description: string;
}

interface FirewallRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
    activeFirewallName: string; // 'ufw', 'firewalld', 'iptables', 'nftables'
}

export function FirewallRulesModal({ isOpen, onClose, agentId, agentName, activeFirewallName }: FirewallRulesModalProps) {
    const [rules, setRules] = useState<FirewallRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { token } = useAuth();

    // Form states
    const [newPort, setNewPort] = useState('');
    const [newProtocol, setNewProtocol] = useState('tcp');
    const [newAction, setNewAction] = useState('allow');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && agentId) {
            fetchRules();
        } else {
            setRules([]);
            setError('');
        }
    }, [isOpen, agentId]);

    const fetchRules = async () => {
        setLoading(true);
        setError('');
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: activeFirewallName,
                    action: 'firewall_list'
                })
            });

            if (!res.ok) throw new Error('Failed to fetch rules');
            const data = await res.json();
            
            // Check if command succeeded
            if (data.success !== undefined && data.success === false) {
                throw new Error(data.message || 'Error executing firewall_list');
            }

            // The data.message usually contains the JSON string of rules
            if (data.message && data.message !== "OK") {
                const parsedRules = JSON.parse(data.message);
                setRules(parsedRules || []);
            } else {
                setRules([]);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to communicate with agent');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPort) return;
        
        setSubmitting(true);
        setError('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: activeFirewallName,
                    action: 'firewall_add',
                    options: {
                        port: parseInt(newPort, 10),
                        protocol: newProtocol,
                        action: newAction
                    }
                })
            });

            if (!res.ok) throw new Error('Failed to add rule');
            const data = await res.json();
            if (data.success === false) {
                 throw new Error(data.message || 'Error executing firewall_add');
            }

            setNewPort('');
            await fetchRules(); // Refresh list
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add rule');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;

        setLoading(true);
        setError('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: activeFirewallName,
                    action: 'firewall_delete',
                    options: {
                        rule_id: ruleId
                    }
                })
            });

            if (!res.ok) throw new Error('Failed to delete rule');
            const data = await res.json();
            if (data.success === false) {
                 throw new Error(data.message || 'Error executing firewall_delete');
            }

            await fetchRules(); // Refresh list
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to delete rule');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box w-11/12 max-w-4xl bg-base-100 shadow-2xl border border-white/10 rounded-xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="font-bold text-2xl tracking-tight">Firewall Rules</h3>
                        <p className="text-sm text-neutral-content/70 mt-1">
                            Managing <span className="text-primary font-bold uppercase">{activeFirewallName}</span> on server <span className="font-mono text-base-content">{agentName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
                </div>

                {error && (
                    <div className="alert alert-error mb-4 shrink-0 shadow-sm rounded-lg py-3 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Add Rule Form */}
                <div className="bg-base-200/50 p-5 rounded-xl border border-white/5 mb-6 shrink-0 transition-all focus-within:ring-2 focus-within:ring-primary/20 shadow-inner">
                    <form onSubmit={handleAddRule} className="flex gap-4 items-end">
                        <div className="form-control flex-1">
                            <label className="label pb-2 pt-0.5">
                                <span className="label-text text-[11px] font-extrabold uppercase tracking-[0.15em] text-neutral-content/40">Action</span>
                            </label>
                            <select 
                                className="select select-bordered select-sm w-full bg-base-100 transition-colors focus:border-primary" 
                                value={newAction} 
                                onChange={e => setNewAction(e.target.value)}
                            >
                                <option value="allow">ALLOW</option>
                                <option value="deny">DENY</option>
                            </select>
                        </div>
                        <div className="form-control flex-1">
                            <label className="label pb-2 pt-0.5">
                                <span className="label-text text-[11px] font-extrabold uppercase tracking-[0.15em] text-neutral-content/40">Port</span>
                            </label>
                            <input 
                                type="number" 
                                min="1" max="65535"
                                placeholder="e.g. 8080"
                                className="input input-bordered input-sm w-full bg-base-100 transition-colors focus:border-primary placeholder:text-neutral-content/30" 
                                value={newPort} 
                                onChange={e => setNewPort(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-control flex-1">
                            <label className="label pb-2 pt-0.5">
                                <span className="label-text text-[11px] font-extrabold uppercase tracking-[0.15em] text-neutral-content/40">Protocol</span>
                            </label>
                            <select 
                                className="select select-bordered select-sm w-full bg-base-100 transition-colors focus:border-primary" 
                                value={newProtocol} 
                                onChange={e => setNewProtocol(e.target.value)}
                            >
                                <option value="tcp">TCP</option>
                                <option value="udp">UDP</option>
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            className="btn btn-primary btn-sm px-6 h-[32px] font-semibold tracking-wide shadow-sm"
                            disabled={submitting || !newPort}
                        >
                            {submitting ? <span className="loading loading-spinner loading-xs"></span> : 'Add Rule'}
                        </button>
                    </form>
                </div>

                {/* Rules Table */}
                <div className="overflow-y-auto flex-1 rounded-lg border border-base-300 min-h-[300px]">
                    <table className="table table-sm w-full">
                        <thead className="bg-base-300/50 sticky top-0 backdrop-blur-md z-10">
                            <tr>
                                <th className="uppercase tracking-wider text-xs">ID</th>
                                <th className="uppercase tracking-wider text-xs">Action</th>
                                <th className="uppercase tracking-wider text-xs">To Ports</th>
                                <th className="uppercase tracking-wider text-xs">From</th>
                                <th className="uppercase tracking-wider text-xs text-right">Controls</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rules.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center opacity-60">
                                            <span className="loading loading-spinner loading-md text-primary mb-3"></span>
                                            <span className="text-sm font-medium">Fetching active rules...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : rules.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-neutral-content/60 bg-base-200/20 italic">
                                        No active firewall rules found on {agentName}.
                                    </td>
                                </tr>
                            ) : (
                                rules.map((r, i) => (
                                    <tr key={i} className="hover:bg-base-200/40 transition-colors group">
                                        <td className="font-mono text-xs opacity-60">{r.ID || '-'}</td>
                                        <td>
                                            <div className={twMerge(clsx(
                                                "badge badge-xs font-bold border-none py-2 px-2 uppercase",
                                                r.Action.toUpperCase().includes('ALLOW') ? "bg-success/20 text-success" : "bg-error/20 text-error"
                                            ))}>
                                                {r.Action}
                                            </div>
                                        </td>
                                        <td className="font-mono font-medium">{r.ToPorts}</td>
                                        <td className="font-mono text-neutral-content/80 text-sm">{r.FromIP}</td>
                                        <td className="text-right">
                                            <button 
                                                onClick={() => handleDeleteRule(r.ID)}
                                                className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete Rule"
                                                disabled={loading}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Backdrop click to close */}
            <form method="dialog" className="modal-backdrop bg-black/40 backdrop-blur-sm" onClick={onClose}>
                <button>close</button>
            </form>
        </div>
    );
}
