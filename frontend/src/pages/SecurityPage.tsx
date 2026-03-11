import { useState, useEffect } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, ShieldCheck, Server } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FirewallRulesModal } from '../components/security/FirewallRulesModal';

export function SecurityPage() {
    const { agents, loading, error } = useAgents();
    const [banIp, setBanIp] = useState('');
    const [banDuration, setBanDuration] = useState('4h');
    const [banReason, setBanReason] = useState('');
    const [banning, setBanning] = useState(false);
    const { user, token } = useAuth();

    // Modal state for Firewall Rules
    const [fwModalOpen, setFwModalOpen] = useState(false);
    const [selectedAgentForFw, setSelectedAgentForFw] = useState<{id: string, name: string, activeFw: string} | null>(null);
    
    // For Option B: Unified Server View, we filter the registered servers
    const registeredServers = agents.filter(a => a.status !== 'pending');

    const activeFirewalls = registeredServers.filter(s => {
        const firewalls = s.services?.filter(svc => ['ufw', 'firewalld', 'iptables', 'nftables'].includes(svc.name));
        const activeFw = firewalls?.find(fw => (fw as any).metrics?.is_active === 1) || firewalls?.[0];
        return activeFw?.status === 'running';
    }).length;

    const [switchingFw, setSwitchingFw] = useState<Record<string, boolean>>({});

    const handleSwitchFirewall = async (agentId: string, engineName: string) => {
        setSwitchingFw(prev => ({ ...prev, [agentId]: true }));
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
                    service: engineName,
                    action: 'firewall_set_active'
                })
            });
            if (!res.ok) throw new Error('Failed to switch firewall engine');
            // Optimistically or rely on keep-alive. Keep-alive takes up to 30s. 
            // Better to force a slight UI hint but we'll just wait for state sync.
        } catch (err) {
            console.error(err);
            alert('Failed to set active firewall.');
        } finally {
            setSwitchingFw(prev => ({ ...prev, [agentId]: false }));
        }
    };
    
    const globalAlerts = registeredServers.reduce((acc, server) => {
        const cs = server.services?.find(svc => svc.name === 'crowdsec');
        // @ts-ignore - metrics is dynamically added via protocol extensions
        const active = cs?.metrics?.active_decisions || 0;
        return acc + active;
    }, 0);

    // CrowdSec Decisions Explorer
    const [decisions, setDecisions] = useState<any[]>([]);
    const [loadingDecisions, setLoadingDecisions] = useState(false);
    const [unbanningIp, setUnbanningIp] = useState<string | null>(null);

    const fetchDecisions = async () => {
        setLoadingDecisions(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/security/decisions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDecisions(data || []);
            }
        } catch (err) {
            console.error("Failed to fetch decisions", err);
        } finally {
            setLoadingDecisions(false);
        }
    };

    useEffect(() => {
        // Only fetch if we have online servers
        if (registeredServers.some(s => s.status === 'online')) {
            fetchDecisions();
        }
    }, [agents]);

    const handleGlobalUnban = async (ip: string) => {
        if (!confirm(`Are you sure you want to globally unban ${ip}?`)) return;
        setUnbanningIp(ip);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/security/unban`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ip })
            });
            if (res.ok) {
                // Remove optimistically or wait for next long-poll
                setDecisions(prev => prev.filter(d => d.value !== ip));
            }
        } catch (err) {
            console.error("Failed to unban", err);
            alert("Failed to issue global unban.");
        } finally {
            setUnbanningIp(null);
        }
    };

    const handleGlobalBan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!banIp) return;
        
        // Basic confirmation
        if (!confirm(`Are you sure you want to globally ban ${banIp} on ALL servers?`)) return;

        setBanning(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/security/ban`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ip: banIp, duration: banDuration, reason: banReason || 'Global ban from dashboard' })
            });
            
            if (!res.ok) {
                throw new Error('Failed to issue global ban');
            }
            
            setBanIp('');
            setBanReason('');
        } catch (err) {
            console.error(err);
            alert('Failed to execute global ban.');
        } finally {
            setBanning(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <ShieldCheck className="text-primary" />
                    Security
                </h1>
                <p className="text-neutral-content text-sm mt-1">
                    Centralized Fleet-Wide Dashboard and Unified Server View for CrowdSec and Firewall
                </p>
            </div>

            {error && (
                <div role="alert" className="alert alert-error shadow-lg">
                    <span>{error}</span>
                </div>
            )}

            {/* OPTION A: Fleet-Wide Dashboard (Aggregates) */}
            <section className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ShieldAlert size={18} />
                    Fleet-Wide Security Overview
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card bg-base-200 border border-white/5 shadow-sm p-6">
                        <div className="text-neutral-content text-sm font-semibold uppercase tracking-wider mb-2">Total Servers Active</div>
                        <div className="text-4xl font-black">{registeredServers.length}</div>
                    </div>
                    <div className="card bg-base-200 border border-info/20 shadow-sm p-6">
                        <div className="text-info text-sm font-semibold uppercase tracking-wider mb-2">Active Firewalls</div>
                        <div className="text-4xl font-black">{activeFirewalls}</div>
                    </div>
                    <div className="card bg-base-200 border border-warning/20 shadow-sm p-6">
                        <div className="text-warning text-sm font-semibold uppercase tracking-wider mb-2">CrowdSec Alerts (Global)</div>
                        <div className="text-4xl font-black">{globalAlerts}</div>
                    </div>
                </div>

                {user?.role !== 'user' && (
                    <div className="card bg-base-200 border border-error/20 shadow-sm p-6 mt-4">
                        <form onSubmit={handleGlobalBan} className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="flex-1">
                                <h3 className="font-bold text-error flex items-center gap-2">
                                    Global Banishment
                                </h3>
                                <p className="text-sm text-neutral-content mb-3">Ban an IP Address across all connected servers simultaneously.</p>
                                
                                <div className="flex flex-wrap gap-3">
                                    <input 
                                        type="text" 
                                        placeholder="IP Address (e.g. 192.168.1.100)" 
                                        className="input input-sm input-bordered w-full max-w-xs"
                                        value={banIp}
                                        onChange={e => setBanIp(e.target.value)}
                                        required
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Duration (e.g. 4h, 7d)" 
                                        className="input input-sm input-bordered w-24"
                                        value={banDuration}
                                        onChange={e => setBanDuration(e.target.value)}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Reason (Optional)" 
                                        className="input input-sm input-bordered w-full max-w-xs"
                                        value={banReason}
                                        onChange={e => setBanReason(e.target.value)}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-error" disabled={banning || !banIp}>
                                {banning ? <span className="loading loading-spinner loading-sm"></span> : 'Ban IP Globally'}
                            </button>
                        </form>
                    </div>
                )}

                {/* CrowdSec Decisions Table */}
                <div className="card bg-base-200 border border-white/5 shadow-sm overflow-hidden mt-6">
                    <div className="p-4 bg-base-300/30 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-neutral-content">Active Bans (CrowdSec Explorer)</h3>
                        <button onClick={fetchDecisions} className="btn btn-xs btn-ghost" disabled={loadingDecisions}>
                            {loadingDecisions ? <span className="loading loading-spinner loading-xs"></span> : 'Refresh'}
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[300px]">
                        <table className="table table-sm table-pin-rows">
                            <thead>
                                <tr>
                                    <th>IP Address</th>
                                    <th>Reason / Scenario</th>
                                    <th>Duration</th>
                                    <th>Observed On</th>
                                    <th className="text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingDecisions && decisions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6">
                                            <span className="loading loading-dots loading-md text-primary"></span>
                                        </td>
                                    </tr>
                                ) : decisions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6 text-neutral-content/60 italic">
                                            No active bans found across the fleet.
                                        </td>
                                    </tr>
                                ) : (
                                    decisions.map((d, i) => (
                                        <tr key={`${d.id}-${d.agent_id}-${i}`} className="hover:bg-base-300/30 transition-colors">
                                            <td className="font-mono text-error font-medium">{d.value}</td>
                                            <td className="text-sm opacity-80">{d.scenario}</td>
                                            <td className="font-mono text-xs">{d.duration}</td>
                                            <td>
                                                <div className="badge badge-sm badge-outline opacity-70">
                                                    {d.agent_name}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                {user?.role !== 'user' && (
                                                    <button 
                                                        onClick={() => handleGlobalUnban(d.value)}
                                                        className="btn btn-xs btn-outline hover:btn-success"
                                                        disabled={unbanningIp === d.value}
                                                    >
                                                        {unbanningIp === d.value ? <span className="loading loading-spinner loading-xs"></span> : 'Global Unban'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* OPTION B: Unified Server Security View */}
            <section className="space-y-4 pt-4 border-t border-white/5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Server size={18} />
                    Unified Server View
                </h2>
                
                <div className="overflow-x-auto border border-white/5 rounded-xl bg-base-200 shadow-sm">
                    <table className="table w-full">
                        <thead className="bg-base-300/50">
                            <tr>
                                <th>Server</th>
                                <th>Status</th>
                                <th>Firewall</th>
                                <th>CrowdSec</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8">
                                        <span className="loading loading-spinner text-primary"></span>
                                    </td>
                                </tr>
                            ) : registeredServers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-neutral-content italic">
                                        No registered servers found.
                                    </td>
                                </tr>
                            ) : (
                                registeredServers.map(server => {
                                    const allFws = server.services?.filter(s => ['ufw', 'firewalld', 'iptables', 'nftables'].includes(s.name)) || [];
                                    const activeFw = allFws.find(s => (s as any).metrics?.is_active === 1) || allFws[0];
                                    const csSvc = server.services?.find(s => s.name === 'crowdsec');
                                    
                                    return (
                                        <tr key={server.id} className="hover:bg-base-300/30 transition-colors border-b border-white/5 last:border-0">
                                            <td className="font-semibold">{server.name || server.hostname}</td>
                                            <td>
                                                <div className={twMerge(clsx(
                                                    "badge badge-sm badge-outline",
                                                    server.status === 'online' ? "badge-success" : "badge-error"
                                                ))}>
                                                    {server.status}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={twMerge(clsx(
                                                    "badge badge-sm font-semibold border-none bg-opacity-20",
                                                    activeFw?.status === 'running' ? "bg-info text-info" : "bg-neutral text-neutral-content"
                                                ))}>
                                                    {activeFw?.status || 'none'}
                                                </div>
                                                
                                                {allFws.length > 0 && (
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <select 
                                                            className="select select-bordered select-xs text-[10px] uppercase tracking-wider bg-base-100"
                                                            value={activeFw?.name}
                                                            onChange={(e) => handleSwitchFirewall(server.id, e.target.value)}
                                                            disabled={switchingFw[server.id] || server.status !== 'online' || user?.role !== 'admin'}
                                                        >
                                                            {allFws.map(fw => (
                                                                <option key={fw.name} value={fw.name}>{fw.name}</option>
                                                            ))}
                                                        </select>
                                                        {switchingFw[server.id] && <span className="loading loading-spinner loading-xs text-primary"></span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className={twMerge(clsx(
                                                    "badge badge-sm font-semibold border-none bg-opacity-20",
                                                    csSvc?.status === 'running' ? "bg-warning text-warning" : "bg-neutral text-neutral-content"
                                                ))}>
                                                    {csSvc?.status || 'unknown'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex gap-2 items-center">
                                                    {activeFw?.status === 'running' && user?.role !== 'user' && (
                                                        <button 
                                                            className="btn btn-xs btn-outline btn-primary shadow-sm"
                                                            onClick={() => {
                                                                setSelectedAgentForFw({
                                                                    id: server.id,
                                                                    name: server.name || server.hostname,
                                                                    activeFw: activeFw.name
                                                                });
                                                                setFwModalOpen(true);
                                                            }}
                                                        >
                                                            Manage Rules
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Modals */}
            <FirewallRulesModal
                isOpen={fwModalOpen}
                onClose={() => setFwModalOpen(false)}
                agentId={selectedAgentForFw?.id || ''}
                agentName={selectedAgentForFw?.name || ''}
                activeFirewallName={selectedAgentForFw?.activeFw || ''}
            />
        </div>
    );
}
