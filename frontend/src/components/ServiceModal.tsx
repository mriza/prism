import { useState, useEffect } from 'react'
import { X, Play, Square, RotateCw, Info, Server } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { DatabaseManager } from './services/managers/DatabaseManager'
import { RabbitMQManager } from './services/managers/RabbitMQManager'
import { WebServerManager } from './services/managers/WebServerManager'
import { StorageManager } from './services/managers/StorageManager'

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
    }, [isOpen, agentId, serviceName])

    const sendCommand = async (action: string, options: any = {}) => {
        setLoading(true)
        setError(null)
        setActionOutput(null)
        try {
            const response = await fetch('http://localhost:65432/api/control', {
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
        } catch (err: any) {
            setError(err.message)
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
            } catch (e) {
                setFacts({ raw: data.message })
            }
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 rounded-lg">
                            <Server className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{serviceName}</h2>
                            <p className="text-sm text-gray-400">Agent: {agentId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={twMerge("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'overview' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-300")}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('control')}
                        className={twMerge("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'control' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-300")}
                    >
                        Control
                    </button>
                    {isDatabase && (
                        <button
                            onClick={() => setActiveTab('database')}
                            className={twMerge("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'database' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-300")}
                        >
                            Database
                        </button>
                    )}
                    {isRabbitMQ && (
                        <button
                            onClick={() => setActiveTab('rabbitmq')}
                            className={twMerge("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'rabbitmq' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-300")}
                        >
                            RabbitMQ
                        </button>
                    )}
                    {isWebServer && (
                        <button
                            onClick={() => setActiveTab('sites')}
                            className={twMerge("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'sites' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-300")}
                        >
                            Sites
                        </button>
                    )}
                    {isStorage && (
                        <button
                            onClick={() => setActiveTab('storage')}
                            className={twMerge("flex-1 py-3 text-sm font-medium border-b-2 transition-colors", activeTab === 'storage' ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-300")}
                        >
                            Storage
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-200 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {loading && <div className="text-center py-4"><RotateCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>}

                    {/* Overview Tab */}
                    {activeTab === 'overview' && !loading && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                <Info className="w-5 h-5" /> Service Facts
                            </h3>
                            {facts ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(facts).map(([key, value]) => (
                                        <div key={key} className="bg-gray-700/50 p-3 rounded-lg">
                                            <span className="block text-xs text-gray-400 uppercase">{key.replace('_', ' ')}</span>
                                            <span className="text-sm font-mono text-white break-words">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">No facts available.</p>
                            )}
                        </div>
                    )}

                    {/* Control Tab */}
                    {activeTab === 'control' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <button onClick={async () => {
                                    const res = await sendCommand('start');
                                    if (res) setActionOutput("Service Started");
                                }} className="flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-green-900/40 hover:border-green-500 border border-gray-600 rounded-xl transition-all group">
                                    <Play className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform mb-2" />
                                    <span className="text-sm font-medium text-gray-200">Start</span>
                                </button>
                                <button onClick={async () => {
                                    const res = await sendCommand('stop');
                                    if (res) setActionOutput("Service Stopped");
                                }} className="flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-red-900/40 hover:border-red-500 border border-gray-600 rounded-xl transition-all group">
                                    <Square className="w-8 h-8 text-red-500 group-hover:scale-110 transition-transform mb-2" />
                                    <span className="text-sm font-medium text-gray-200">Stop</span>
                                </button>
                                <button onClick={async () => {
                                    const res = await sendCommand('restart');
                                    if (res) setActionOutput("Service Restarted");
                                }} className="flex flex-col items-center justify-center p-4 bg-gray-700 hover:bg-yellow-900/40 hover:border-yellow-500 border border-gray-600 rounded-xl transition-all group">
                                    <RotateCw className="w-8 h-8 text-yellow-500 group-hover:spin transition-transform mb-2" />
                                    <span className="text-sm font-medium text-gray-200">Restart</span>
                                </button>
                            </div>
                            {actionOutput && (
                                <div className="p-3 bg-green-900/30 border border-green-800 text-green-200 rounded-lg text-sm text-center">
                                    {actionOutput}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manager Components */}
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
        </div>
    )
}
