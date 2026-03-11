import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../contexts/AuthContext';
import { HardDrive, Server, Cpu, ShieldCheck, Shield, Disc, AlertCircle } from 'lucide-react';
import { FirewallModal } from '../components/modals/FirewallModal';
import { CrowdSecModal } from '../components/modals/CrowdSecModal';
import { ApproveServerModal } from '../components/modals/ApproveServerModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function ServersPage() {
    const { agents, loading, error, deleteAgent } = useAgents();
    const [fwAgent, setFwAgent] = useState<string | null>(null);
    const [csAgent, setCsAgent] = useState<string | null>(null);
    const [approvingAgentId, setApprovingAgentId] = useState<string | null>(null);
    const { user } = useAuth();

    const pendingAgents = agents.filter(a => a.status === 'pending');
    const registeredServers = agents.filter(a => a.status !== 'pending');

    const getApprovingAgent = () => {
        if (!approvingAgentId) return null;
        return agents.find(a => a.id === approvingAgentId) || null;
    };

    const handleDelete = async (id: string, nameOrHost: string) => {
        if (confirm(`Are you sure you want to remove the server "${nameOrHost}"?`)) {
            await deleteAgent(id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Servers</h1>
                    <p className="text-neutral-content text-sm">
                        Manage your connected infrastructure
                    </p>
                </div>
            </div>

            {error && (
                <div role="alert" className="alert alert-error shadow-lg">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Pending Approvals Section */}
            {pendingAgents.length > 0 && user?.role === 'admin' && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-warning">
                        <AlertCircle size={18} />
                        Pending Approvals
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingAgents.map(agent => (
                            <div key={agent.id} className="card bg-warning/5 border border-warning/30 hover:border-warning/50 transition-all overflow-hidden shadow-sm">
                                <div className="p-5 flex flex-col gap-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                                                <Server size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{agent.hostname}</div>
                                                <div className="text-xs text-neutral-content/70">{agent.osInfo || 'Unknown OS'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-neutral-content/80">
                                        Agent detected waiting for approval to join the fleet.
                                    </div>
                                    <div className="flex gap-2 w-full mt-2">
                                        <button 
                                            onClick={() => setApprovingAgentId(agent.id)}
                                            className="btn btn-sm btn-success flex-1"
                                        >
                                            Review & Approve
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(agent.id, agent.hostname)}
                                            className="btn btn-sm btn-outline btn-error flex-1"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Registered Servers Section */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <HardDrive size={18} />
                    Registered Servers
                </h2>

                {loading && registeredServers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                        <p className="text-neutral-content animate-pulse">Connecting to hub…</p>
                    </div>
                ) : registeredServers.length === 0 ? (
                    <div className="card bg-base-200 border border-white/5 border-dashed py-16 flex flex-col items-center justify-center gap-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center text-neutral-content/40">
                            <HardDrive size={32} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">No registered servers</h3>
                            <p className="text-sm text-neutral-content max-w-sm">
                                Start a PRISM agent on a server to see it here and begin managing its services
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {registeredServers.map(server => (
                            <div
                                key={server.id}
                                className="card bg-base-200 border border-white/5 hover:border-white/10 transition-all overflow-hidden shadow-sm"
                            >
                                {/* Card header */}
                                <div className="bg-base-300/50 px-5 py-3 border-b border-white/5 flex flex-col gap-1.5 justify-center">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <HardDrive size={18} className={server.status === 'online' ? "text-success" : "text-neutral-content/50"} />
                                            <div className="font-bold tracking-tight text-white">{server.name || server.hostname}</div>
                                        </div>
                                        <div className="flex items-center">
                                            {server.status === 'online' ? (
                                                <div className="badge badge-success badge-outline badge-sm gap-1.5 py-2 font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
                                                    Online
                                                </div>
                                            ) : (
                                                <div className="badge badge-error badge-outline badge-sm gap-1.5 py-2 font-semibold">
                                                    Offline
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-neutral-content/60 font-mono tracking-wider ml-7">{server.hostname} • {server.osInfo || 'Unknown OS'}</div>
                                </div>

                                {/* Body */}
                                <div className="card-body p-5 space-y-4">
                                    {server.description && (
                                        <div className="text-sm text-neutral-content/80 italic border-l-2 border-white/10 pl-3">
                                            {server.description}
                                        </div>
                                    )}

                                    {/* Services */}
                                    <div className="pt-2">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-content/60 mb-3">
                                            <Cpu size={12} />
                                            Managed Services
                                        </div>
                                        
                                        {server.services && server.services.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {server.services.map(svc => {
                                                    const isUfw = svc.name === 'ufw';
                                                    const isCrowdSec = svc.name === 'crowdsec';
                                                    const isClickable = isUfw || isCrowdSec;

                                                    let statusColorClass = 'bg-neutral-content/50';
                                                    if (svc.status === 'running') statusColorClass = 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]';
                                                    else if (svc.status === 'stopped' || svc.status === 'error') statusColorClass = 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.4)]';

                                                    const handleClick = isUfw
                                                        ? () => setFwAgent(server.id)
                                                        : isCrowdSec
                                                            ? () => setCsAgent(server.id)
                                                            : undefined;

                                                    return (
                                                        <button
                                                            key={svc.name}
                                                            title={isClickable ? `Click to manage ${svc.name}` : `Status: ${svc.status}`}
                                                            onClick={handleClick}
                                                            disabled={!isClickable}
                                                            className={twMerge(
                                                                clsx(
                                                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                                                                    isUfw ? "bg-info/10 border-info/30 text-info-content hover:bg-info/20 hover:border-info/50" :
                                                                    isCrowdSec ? "bg-warning/10 border-warning/30 text-warning-content hover:bg-warning/20 hover:border-warning/50" :
                                                                    "bg-base-300 border-white/5 text-neutral-content",
                                                                    !isClickable && "cursor-default"
                                                                )
                                                            )}
                                                        >
                                                            <span className={twMerge(clsx("w-2 h-2 rounded-full", statusColorClass))} />
                                                            {isUfw ? <ShieldCheck size={12} className="text-info" /> : isCrowdSec ? <Shield size={12} className="text-warning" /> : <Disc size={12} />}
                                                            <span>{svc.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-neutral-content bg-base-300/30 rounded-lg p-3 text-center italic border border-white/5 border-dashed">
                                                No active services detected
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="pt-4 mt-auto">
                                        {user?.role !== 'user' && (
                                            <button 
                                                onClick={() => handleDelete(server.id, server.name || server.hostname)}
                                                className="btn btn-sm btn-outline btn-error w-full"
                                            >
                                                Remove Server
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {fwAgent && (
                <FirewallModal
                    isOpen={true}
                    onClose={() => setFwAgent(null)}
                    agentId={fwAgent}
                />
            )}
            {csAgent && (
                <CrowdSecModal
                    isOpen={true}
                    onClose={() => setCsAgent(null)}
                    agentId={csAgent}
                />
            )}
            {approvingAgentId && (
                <ApproveServerModal
                    isOpen={true}
                    onClose={() => setApprovingAgentId(null)}
                    agentId={approvingAgentId}
                    hostname={getApprovingAgent()?.hostname || ''}
                />
            )}
        </div>
    );
}
