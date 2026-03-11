import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2, Play, Square, RotateCw, Activity, Cpu, HardDrive, Clock } from 'lucide-react';
import { useAgents } from '../../hooks/useAgents';
import { ServiceTypeIcon } from '../ui/ServiceTypeIcon';
import type { ServiceType } from '../../types';
import { clsx } from 'clsx';

interface ServiceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
    serviceName: string;
    serviceLabel: string;
    serviceType: ServiceType;
    status: string;
    metrics?: Record<string, number>;
}

export function ServiceDetailModal({ 
    isOpen, 
    onClose, 
    agentId, 
    agentName, 
    serviceName, 
    serviceLabel,
    serviceType,
    status,
    metrics
}: ServiceDetailModalProps) {
    const { getServiceConfig, updateServiceConfig, controlService } = useAgents();
    const [config, setConfig] = useState<string>('');
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'config'>('info');

    const isOnline = status === 'online' || status === 'running';
    const isOffline = status === 'offline' || status === 'stopped';

    useEffect(() => {
        if (isOpen && activeTab === 'config') {
            loadConfig();
        }
    }, [isOpen, activeTab, agentId, serviceName]);

    const loadConfig = async () => {
        setLoadingConfig(true);
        setError(null);
        const data = await getServiceConfig(agentId, serviceName);
        if (data !== null) {
            setConfig(data);
        } else {
            setError('Failed to load configuration file or service does not support remote configuration.');
        }
        setLoadingConfig(false);
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        setError(null);
        const success = await updateServiceConfig(agentId, serviceName, config);
        if (success) {
            // Optional: Show success toast or just stay
        } else {
            setError('Failed to save configuration.');
        }
        setSavingConfig(false);
    };

    const handleControl = async (action: string) => {
        setActionLoading(action);
        await controlService(agentId, serviceName, action);
        setActionLoading(null);
    };

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-4xl bg-base-200 border border-white/10 rounded-3xl p-0 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-base-300/50">
                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "p-3 rounded-2xl transition-all duration-300",
                            isOnline ? "bg-success/10 text-success" : "bg-base-300 text-neutral-content/40"
                        )}>
                            <ServiceTypeIcon type={serviceType} size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold tracking-tight">{serviceLabel}</h3>
                            <p className="text-[10px] text-neutral-content/60 uppercase tracking-[0.2em] font-black mt-1">
                                {serviceName} @ {agentName}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 flex gap-1 bg-base-300/30 border-b border-white/5">
                    <button 
                        onClick={() => setActiveTab('info')}
                        className={clsx(
                            "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'info' ? "border-primary text-primary" : "border-transparent text-neutral-content/40 hover:text-neutral-content"
                        )}
                    >
                        Overview & Metrics
                    </button>
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={clsx(
                            "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'config' ? "border-primary text-primary" : "border-transparent text-neutral-content/40 hover:text-neutral-content"
                        )}
                    >
                        Configuration
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="alert alert-error rounded-2xl py-3 border border-error/20 mb-6">
                            <AlertCircle size={18} />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    {activeTab === 'info' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Status and Controls */}
                            <div className="flex flex-wrap items-center justify-between gap-6 p-6 bg-base-300/50 rounded-[2rem] border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "px-4 py-2 rounded-full font-black uppercase tracking-widest text-[10px] flex items-center gap-2",
                                        isOnline ? "bg-success/10 text-success" : 
                                        isOffline ? "bg-base-200 text-neutral-content/40" : "bg-error/10 text-error"
                                    )}>
                                        <div className={clsx("w-1.5 h-1.5 rounded-full", isOnline && "animate-pulse bg-success", isOffline && "bg-neutral-content/40", !isOnline && !isOffline && "bg-error")} />
                                        {status}
                                    </div>
                                    <p className="text-sm text-neutral-content/60 font-medium italic">Service is currently {status}.</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        className="btn btn-sm px-4 bg-base-100 border-none hover:bg-success/10 hover:text-success rounded-xl gap-2 font-bold text-[10px] uppercase tracking-widest"
                                        onClick={() => handleControl('start')}
                                        disabled={isOnline || !!actionLoading}
                                    >
                                        {actionLoading === 'start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                        Start
                                    </button>
                                    <button 
                                        className="btn btn-sm px-4 bg-base-100 border-none hover:bg-error/10 hover:text-error rounded-xl gap-2 font-bold text-[10px] uppercase tracking-widest"
                                        onClick={() => handleControl('stop')}
                                        disabled={isOffline || !!actionLoading}
                                    >
                                        {actionLoading === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                                        Stop
                                    </button>
                                    <button 
                                        className="btn btn-sm px-4 bg-base-100 border-none hover:bg-primary/10 hover:text-primary rounded-xl gap-2 font-bold text-[10px] uppercase tracking-widest"
                                        onClick={() => handleControl('restart')}
                                        disabled={!!actionLoading}
                                    >
                                        {actionLoading === 'restart' ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                                        Restart
                                    </button>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div>
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-content/40 mb-4 ml-2">
                                    <Activity size={12} />
                                    Live Metrics & Stats
                                </h4>
                                {metrics && Object.keys(metrics).length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(metrics).map(([key, rawVal]) => {
                                            const val = Number(rawVal);
                                            const isMem = key.includes('memory') || key.includes('rss');
                                            const isCpu = key.includes('cpu');
                                            const isUp = key.includes('uptime');
                                            
                                            let displayVal = val.toString();
                                            let icon = <Activity size={16} />;
                                            let colorClass = "text-primary";

                                            if (isMem) {
                                                displayVal = `${(val / (1024 * 1024)).toFixed(1)} MB`;
                                                icon = <HardDrive size={16} />;
                                                colorClass = "text-blue-400";
                                            } else if (isCpu) {
                                                displayVal = `${val.toFixed(1)}%`;
                                                icon = <Cpu size={16} />;
                                                colorClass = "text-amber-400";
                                            } else if (isUp) {
                                                displayVal = `${(val / 3600).toFixed(1)}h`;
                                                icon = <Clock size={16} />;
                                                colorClass = "text-success";
                                            }
                                            
                                            if (key === 'is_active' || key === 'is_enabled') return null;

                                            return (
                                                <div key={key} className="p-4 bg-base-300/30 rounded-2xl border border-white/5 flex items-center gap-4">
                                                    <div className={clsx("p-2 rounded-xl bg-base-300", colorClass)}>
                                                        {icon}
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-content/30 truncate" title={key}>
                                                            {key.replace(/_/g, ' ')}
                                                        </p>
                                                        <p className="text-sm font-mono font-bold text-white mt-0.5">
                                                            {displayVal}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-12 border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center text-center opacity-30">
                                        <Activity size={32} className="mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">No active metrics recorded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="relative flex-1 min-h-[400px]">
                                {loadingConfig ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300/50 rounded-[2rem] z-10 gap-4">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Fetching config file...</p>
                                    </div>
                                ) : (
                                    <textarea
                                        className="textarea textarea-bordered w-full h-full font-mono text-xs p-6 bg-base-300/50 focus:outline-none focus:border-primary/50 transition-all rounded-[2rem] resize-none border-white/5 shadow-inner"
                                        value={config}
                                        onChange={(e) => setConfig(e.target.value)}
                                        spellCheck={false}
                                        placeholder="# Configuration file content..."
                                    />
                                )}
                            </div>
                            
                            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                <div className="flex items-center gap-3 text-primary">
                                    <AlertCircle size={18} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Saving will restart or reload the service automatically.</p>
                                </div>
                                <button 
                                    onClick={handleSaveConfig} 
                                    className="btn btn-primary rounded-xl px-8 min-w-[140px]"
                                    disabled={loadingConfig || savingConfig || !!error}
                                >
                                    {savingConfig ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Update Config</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="modal-backdrop bg-black/80 backdrop-blur-md" onClick={onClose}></div>
        </div>
    );
}
