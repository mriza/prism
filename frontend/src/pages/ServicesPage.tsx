import { useAgents } from '../hooks/useAgents';
import { ServiceTypeIcon } from '../components/ui/ServiceTypeIcon';
import { SERVICE_TYPE_LABELS } from '../types';
import type { ServiceType } from '../types';
import { Play, Square, RotateCw, Activity, Server as ServerIcon, AlertCircle, Info, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useMemo } from 'react';
import { ServiceDetailModal } from '../components/modals/ServiceDetailModal';

// Reverse map to find category/label
const SERVICE_NAME_TO_TYPE: Record<string, ServiceType> = {
    'mongodb': 'mongodb', 'mongod': 'mongodb',
    'mysql': 'mysql', 'mariadb': 'mysql',
    'postgresql': 'postgresql', 'postgres': 'postgresql',
    'rabbitmq': 'rabbitmq',
    'mosquitto': 'mqtt-mosquitto',
    'minio': 's3-minio',
    'garage': 's3-garage',
    'vsftpd': 'ftp-vsftpd',
    'sftpgo': 'ftp-sftpgo',
    'caddy': 'web-caddy',
    'nginx': 'web-nginx',
    'pm2': 'pm2',
    'supervisor': 'supervisor',
    'systemd': 'systemd',
    'crowdsec': 'security-crowdsec',
};

export function ServicesPage() {
    const { agents, controlService, loading, error } = useAgents();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedService, setSelectedService] = useState<{
        agentId: string;
        agentName: string;
        serviceName: string;
        serviceLabel: string;
        serviceType: ServiceType;
        status: string;
        metrics?: Record<string, number>;
    } | null>(null);

    const handleControl = async (e: React.MouseEvent, agentId: string, service: string, action: string) => {
        e.stopPropagation(); // Prevent opening modal
        const id = `${agentId}-${service}-${action}`;
        setActionLoading(id);
        await controlService(agentId, service, action);
        setActionLoading(null);
    };

    // Static Sorting: Alphabetical by Agent Name, then by Service Label
    const sortedAgents = useMemo(() => {
        return [...agents]
            .filter(a => a.status !== 'pending' && a.status !== 'rejected')
            .sort((a, b) => (a.name || a.hostname).localeCompare(b.name || b.hostname))
            .map(agent => ({
                ...agent,
                services: [...agent.services].sort((a, b) => {
                    const labelA = SERVICE_TYPE_LABELS[SERVICE_NAME_TO_TYPE[a.name] || 'systemd'] || a.name;
                    const labelB = SERVICE_TYPE_LABELS[SERVICE_NAME_TO_TYPE[b.name] || 'systemd'] || b.name;
                    return labelA.localeCompare(labelB);
                })
            }));
    }, [agents]);

    const filteredAgents = useMemo(() => {
        if (!searchTerm) return sortedAgents;
        const lowSearch = searchTerm.toLowerCase();
        return sortedAgents.map(agent => ({
            ...agent,
            services: agent.services.filter(svc => {
                const label = (SERVICE_TYPE_LABELS[SERVICE_NAME_TO_TYPE[svc.name] || 'systemd'] || svc.name).toLowerCase();
                return label.includes(lowSearch) || svc.name.toLowerCase().includes(lowSearch);
            })
        })).filter(agent => agent.services.length > 0);
    }, [sortedAgents, searchTerm]);

    if (loading && agents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-neutral-content font-bold uppercase tracking-widest text-xs opacity-40">Loading fleet data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Services</h1>
                    <p className="text-neutral-content text-sm opacity-70">Monitor and manage individual services across your infrastructure.</p>
                </div>
                
                <div className="relative w-full sm:w-80 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-content/40 group-focus-within:text-primary transition-colors">
                        <Search size={18} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search services..."
                        className="input input-bordered w-full pl-12 bg-base-200/50 rounded-2xl border-white/5 focus:border-primary/50 transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="alert alert-error shadow-xl rounded-2xl border border-error/20 py-4">
                    <AlertCircle size={20} />
                    <div className="flex flex-col">
                        <span className="font-bold uppercase tracking-wide text-[10px]">Connectivity Issue</span>
                        <span className="text-sm opacity-80">{error}</span>
                    </div>
                </div>
            )}

            <div className="space-y-10">
                {filteredAgents.map(agent => (
                    <div key={agent.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Agent Header */}
                        <div className="flex items-center gap-4 px-2">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "p-2 rounded-xl bg-base-300 border border-white/5",
                                    agent.status === 'online' ? "text-success" : "text-neutral-content/30"
                                )}>
                                    <ServerIcon size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-none">{agent.name || agent.hostname}</h3>
                                    <p className="text-[9px] uppercase font-black tracking-widest opacity-20 mt-1">{agent.hostname} / {agent.osInfo}</p>
                                </div>
                            </div>
                            <div className="h-px flex-1 bg-white/5" />
                        </div>

                        {/* Services Table */}
                        <div className="bg-base-200 rounded-[2rem] border border-white/5 overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="table table-auto w-full border-separate border-spacing-0">
                                    <thead>
                                        <tr className="bg-base-300/30">
                                            <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-content/30 border-none">Service</th>
                                            <th className="py-5 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-content/30 border-none">Status</th>
                                            <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-content/30 border-none text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {agent.services.map((svc, idx) => {
                                            const type = SERVICE_NAME_TO_TYPE[svc.name] || 'systemd' as ServiceType;
                                            const isOnline = svc.status === 'online' || svc.status === 'running';
                                            const isOffline = svc.status === 'offline' || svc.status === 'stopped';
                                            const label = SERVICE_TYPE_LABELS[type] || svc.name;
                                            
                                            return (
                                                <tr 
                                                    key={`${agent.id}-${svc.name}-${idx}`} 
                                                    className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                                                    onClick={() => setSelectedService({
                                                        agentId: agent.id,
                                                        agentName: agent.name || agent.hostname,
                                                        serviceName: svc.name,
                                                        serviceLabel: label,
                                                        serviceType: type,
                                                        status: svc.status,
                                                        metrics: svc.metrics
                                                    })}
                                                >
                                                    {/* Service Name & Icon */}
                                                    <td className="py-5 px-8 border-none">
                                                        <div className="flex items-center gap-4">
                                                            <div className={clsx(
                                                                "p-3 rounded-2xl transition-all duration-300",
                                                                isOnline ? "bg-success/10 text-success" : "bg-base-300 text-neutral-content/40"
                                                            )}>
                                                                <ServiceTypeIcon type={type} size={22} />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-sm tracking-tight flex items-center gap-2">
                                                                    {label}
                                                                    <Info size={12} className="opacity-0 group-hover:opacity-30 transition-opacity" />
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-0.5 opacity-30">
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest">{svc.name}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="py-5 px-4 border-none">
                                                        <div className={clsx(
                                                            "badge badge-sm py-2 px-3 gap-1.5 font-bold uppercase tracking-[0.1em] text-[9px] border-none",
                                                            isOnline ? "bg-success/10 text-success" : 
                                                            isOffline ? "bg-base-300 text-neutral-content/40" : 
                                                            "bg-error/10 text-error"
                                                        )}>
                                                            <div className={clsx("w-1 h-1 rounded-full", isOnline && "bg-current animate-pulse")} />
                                                            {svc.status}
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-5 px-8 border-none text-right">
                                                        <div className="flex items-center justify-end gap-1 px-1">
                                                            <button 
                                                                className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-success/10 hover:text-success disabled:opacity-20"
                                                                onClick={(e) => handleControl(e, agent.id, svc.name, 'start')}
                                                                disabled={isOnline || !!actionLoading}
                                                                title="Start"
                                                            >
                                                                {actionLoading === `${agent.id}-${svc.name}-start` 
                                                                    ? <span className="loading loading-spinner loading-xs"></span>
                                                                    : <Play size={14} />
                                                                }
                                                            </button>
                                                            <button 
                                                                className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-error/10 hover:text-error disabled:opacity-20"
                                                                onClick={(e) => handleControl(e, agent.id, svc.name, 'stop')}
                                                                disabled={isOffline || !!actionLoading}
                                                                title="Stop"
                                                            >
                                                                {actionLoading === `${agent.id}-${svc.name}-stop`
                                                                    ? <span className="loading loading-spinner loading-xs"></span>
                                                                    : <Square size={14} />
                                                                }
                                                            </button>
                                                            <button 
                                                                className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-primary/10 hover:text-primary disabled:opacity-20"
                                                                onClick={(e) => handleControl(e, agent.id, svc.name, 'restart')}
                                                                disabled={!!actionLoading}
                                                                title="Restart"
                                                            >
                                                                {actionLoading === `${agent.id}-${svc.name}-restart`
                                                                    ? <span className="loading loading-spinner loading-xs"></span>
                                                                    : <RotateCw size={14} />
                                                                }
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredAgents.length === 0 && (
                <div className="card bg-base-200 border border-white/5 py-32 flex flex-col items-center justify-center gap-6 rounded-[3rem] shadow-xl animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 rounded-[2rem] bg-base-300 flex items-center justify-center text-neutral-content/10">
                        <Activity size={48} />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-neutral-content font-black uppercase tracking-[0.2em] text-[10px] opacity-20">Fleet Status</p>
                        <p className="text-sm font-bold opacity-60">No services match your request.</p>
                    </div>
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="btn btn-ghost btn-sm rounded-xl text-primary font-bold text-[10px] uppercase tracking-widest"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            )}

            {selectedService && (
                <ServiceDetailModal
                    isOpen={true}
                    onClose={() => setSelectedService(null)}
                    {...selectedService}
                />
            )}
        </div>
    );
}
