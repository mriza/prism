import { useState, useEffect } from 'react'
import { Play, Square, RotateCw, Info, Server, AlertCircle, Activity } from 'lucide-react'
import { Modal } from './ui/Modal'
import { DatabaseManager } from './services/managers/DatabaseManager'
import { RabbitMQManager } from './services/managers/RabbitMQManager'
import { WebServerManager } from './services/managers/WebServerManager'
import { StorageManager } from './services/managers/StorageManager'
import { clsx } from 'clsx'


interface ServiceModalProps {
    isOpen: boolean
    onClose: () => void
    agentId: string
    serviceName: string
}

type Tab = 'overview' | 'control' | 'database' | 'rabbitmq' | 'sites' | 'storage'

export function ServiceModal({ isOpen, onClose, agentId, serviceName }: ServiceModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [facts, setFacts] = useState<Record<string, string> | null>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [actionOutput, setActionOutput] = useState<string | null>(null)

    const isDatabase = ['mysql', 'mariadb', 'postgresql'].includes(serviceName)
    const isRabbitMQ = serviceName === 'rabbitmq'
    const isWebServer = ['caddy', 'nginx'].includes(serviceName)
    const isStorage = ['minio', 'garage', 'seaweedfs'].includes(serviceName)

    useEffect(() => {
        if (isOpen) {
            fetchFacts()
            setActiveTab('overview')
            setActionOutput(null)
            setError(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, agentId, serviceName])

    const sendCommand = async (action: string, options: Record<string, unknown> = {}) => {
        setLoading(true)
        setError(null)
        setActionOutput(null)
        try {
            const response = await fetch(`/api/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: serviceName,
                    action: action,
                    options: options
                })
            })

            if (!response.ok) throw new Error('Command failed')

            const data = await response.json()
            if (!data.success && data.message) {
                throw new Error(data.message)
            }
            return data
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError(String(err))
            }
            return null
        } finally {
            setLoading(false)
        }
    }

    const fetchFacts = async () => {
        const data = await sendCommand('get_facts')
        if (data && data.message) {
            try {
                setFacts(JSON.parse(data.message))
            } catch {
                setFacts({ raw: data.message })
            }
        }
    }

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={serviceName} 
            size="xl"
            subtitle={`Agent: ${agentId}`}
            icon={<Server className="w-5 h-5" />}
        >
            <div className="flex flex-col h-full min-h-[400px]">
                {/* Tabs */}
                <div role="tablist" className="tabs tabs-lifted mb-6">
                    <button
                        role="tab"
                        onClick={() => setActiveTab('overview')}
                        className={clsx("tab h-10 font-bold text-xs uppercase tracking-wider", activeTab === 'overview' && "tab-active [--tab-bg:var(--color-base-200)]")}
                    >
                        Overview
                    </button>
                    <button
                        role="tab"
                        onClick={() => setActiveTab('control')}
                        className={clsx("tab h-10 font-bold text-xs uppercase tracking-wider", activeTab === 'control' && "tab-active [--tab-bg:var(--color-base-200)]")}
                    >
                        Control
                    </button>
                    {isDatabase && (
                        <button
                            role="tab"
                            onClick={() => setActiveTab('database')}
                            className={clsx("tab h-10 font-bold text-xs uppercase tracking-wider", activeTab === 'database' && "tab-active [--tab-bg:var(--color-base-200)]")}
                        >
                            Database
                        </button>
                    )}
                    {isRabbitMQ && (
                        <button
                            role="tab"
                            onClick={() => setActiveTab('rabbitmq')}
                            className={clsx("tab h-10 font-bold text-xs uppercase tracking-wider", activeTab === 'rabbitmq' && "tab-active [--tab-bg:var(--color-base-200)]")}
                        >
                            RabbitMQ
                        </button>
                    )}
                    {isWebServer && (
                        <button
                            role="tab"
                            onClick={() => setActiveTab('sites')}
                            className={clsx("tab h-10 font-bold text-xs uppercase tracking-wider", activeTab === 'sites' && "tab-active [--tab-bg:var(--color-base-200)]")}
                        >
                            Sites
                        </button>
                    )}
                    {isStorage && (
                        <button
                            role="tab"
                            onClick={() => setActiveTab('storage')}
                            className={clsx("tab h-10 font-bold text-xs uppercase tracking-wider", activeTab === 'storage' && "tab-active [--tab-bg:var(--color-base-200)]")}
                        >
                            Storage
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {error && (
                        <div className="alert alert-error text-xs mb-6 rounded-xl border border-error/20 flex items-start">
                            <AlertCircle size={16} className="mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-primary opacity-50">
                            <RotateCw className="w-8 h-8 animate-spin mb-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Processing request...</span>
                        </div>
                    )}

                    {!loading && (
                        <div className="space-y-6">
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                            <Info size={16} />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-widest">Service Information</h3>
                                    </div>
                                    
                                    {facts ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {Object.entries(facts).map(([key, value]) => (
                                                <div key={key} className="p-3 bg-base-200 rounded-xl border border-white/5 shadow-sm group hover:border-primary/30 transition-colors">
                                                    <span className="block text-[10px] text-neutral-content/40 font-black uppercase tracking-wider mb-1">
                                                        {key.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="text-sm font-mono font-bold text-primary/80 break-all leading-tight">
                                                        {String(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center bg-base-200/50 rounded-2xl border border-dashed border-white/10 italic text-neutral-content/40">
                                            No diagnostic facts available for this service.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Control Tab */}
                            {activeTab === 'control' && (
                                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <button 
                                            onClick={async () => {
                                                const res = await sendCommand('start');
                                                if (res) setActionOutput("Service Started Successfully");
                                            }} 
                                            className="flex flex-col items-center justify-center p-6 bg-base-200 hover:bg-success/10 hover:border-success/30 border border-white/5 rounded-2xl transition-all group active:scale-95"
                                        >
                                            <div className="p-3 rounded-full bg-success/10 text-success group-hover:scale-110 transition-transform mb-3 ring-4 ring-transparent group-hover:ring-success/5">
                                                <Play className="w-6 h-6 fill-current" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest">Start</span>
                                        </button>
                                        
                                        <button 
                                            onClick={async () => {
                                                const res = await sendCommand('stop');
                                                if (res) setActionOutput("Service Stopped Successfully");
                                            }} 
                                            className="flex flex-col items-center justify-center p-6 bg-base-200 hover:bg-error/10 hover:border-error/30 border border-white/5 rounded-2xl transition-all group active:scale-95"
                                        >
                                            <div className="p-3 rounded-full bg-error/10 text-error group-hover:scale-110 transition-transform mb-3 ring-4 ring-transparent group-hover:ring-error/5">
                                                <Square className="w-6 h-6 fill-current" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest">Stop</span>
                                        </button>
                                        
                                        <button 
                                            onClick={async () => {
                                                const res = await sendCommand('restart');
                                                if (res) setActionOutput("Service Restarted Successfully");
                                            }} 
                                            className="flex flex-col items-center justify-center p-6 bg-base-200 hover:bg-warning/10 hover:border-warning/30 border border-white/5 rounded-2xl transition-all group active:scale-95"
                                        >
                                            <div className="p-3 rounded-full bg-warning/10 text-warning group-hover:rotate-180 transition-transform duration-500 mb-3 ring-4 ring-transparent group-hover:ring-warning/5">
                                                <RotateCw className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest">Restart</span>
                                        </button>
                                    </div>
                                    
                                    {actionOutput && (
                                        <div className="alert alert-success text-xs font-bold uppercase tracking-wider py-4 rounded-xl border border-success/20 flex justify-center shadow-lg shadow-success/5">
                                            <Activity size={16} className="mr-2" />
                                            {actionOutput}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Manager Components */}
                            <div className="animate-in fade-in duration-500">
                                {activeTab === 'database' && (
                                    <DatabaseManager sendCommand={sendCommand} />
                                )}

                                {activeTab === 'rabbitmq' && (
                                    <RabbitMQManager sendCommand={sendCommand} setActionOutput={setActionOutput} />
                                )}

                                {activeTab === 'sites' && (
                                    <WebServerManager sendCommand={sendCommand} serviceName={serviceName} />
                                )}

                                {activeTab === 'storage' && (
                                    <StorageManager sendCommand={sendCommand} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

