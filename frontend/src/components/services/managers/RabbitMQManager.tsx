import { useState, useEffect } from 'react'
import { X, Plus, Users, Globe, Link } from 'lucide-react'
import { clsx } from 'clsx'

interface RabbitMQManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
    setActionOutput: (output: string | null) => void
}

interface RMQUser {
    name: string;
    tags: string;
}

export function RabbitMQManager({ sendCommand, setActionOutput }: RabbitMQManagerProps) {
    const [rmqVHosts, setRmqVHosts] = useState<string[]>([])
    const [rmqUsers, setRmqUsers] = useState<RMQUser[]>([])
    const [loading, setLoading] = useState(false)

    const fetchRmqData = async () => {
        setLoading(true)
        try {
            // VHosts
            const vhostsData = await sendCommand('rmq_list_vhosts')
            if (vhostsData?.message) setRmqVHosts(JSON.parse(vhostsData.message))

            // Users
            const usersData = await sendCommand('rmq_list_users')
            if (usersData?.message) setRmqUsers(JSON.parse(usersData.message))
        } catch (e) {
            console.error("Failed to fetch RMQ data", e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRmqData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleCreateVHost = async () => {
        const input = document.getElementById('newVhost') as HTMLInputElement;
        const val = input.value;
        if (val) {
            const res = await sendCommand('rmq_create_vhost', { name: val });
            if (res) {
                input.value = '';
                fetchRmqData();
                setActionOutput(`VHost "${val}" created successfully`);
            }
        }
    }

    const handleCreateUser = async () => {
        const userEl = document.getElementById('rmqUser') as HTMLInputElement;
        const passEl = document.getElementById('rmqPass') as HTMLInputElement;
        const tagsEl = document.getElementById('rmqTags') as HTMLSelectElement;
        const vhostEl = document.getElementById('rmqPermVhost') as HTMLSelectElement;

        const user = userEl.value;
        const pass = passEl.value;
        const tags = tagsEl.value;
        const vhost = vhostEl.value;

        if (user && pass) {
            const res = await sendCommand('rmq_create_user', { username: user, password: pass, tags });
            if (res) {
                if (vhost) {
                    await sendCommand('rmq_set_permissions', { vhost, username: user });
                }
                fetchRmqData();
                userEl.value = '';
                passEl.value = '';
                setActionOutput(`User "${user}" created successfully`);
            }
        }
    }

    return (
        <div className={clsx("space-y-8 animate-in fade-in duration-500", loading && "opacity-50 pointer-events-none")}>
            {/* VHosts */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Globe size={16} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">Virtual Hosts</h3>
                </div>

                <div className="bg-base-300/30 rounded-2xl border border-white/5 p-4 shadow-inner space-y-4">
                    <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {rmqVHosts.length > 0 ? rmqVHosts.map(vh => (
                            <div key={vh} className="badge badge-lg bg-base-100 border-white/5 text-[11px] font-bold font-mono py-4 px-3 shadow-sm flex items-center gap-2 group hover:border-error/30 transition-colors">
                                {vh}
                                <button 
                                    onClick={async () => {
                                        if (confirm(`Are you sure you want to delete vhost "${vh}"?`)) {
                                            await sendCommand('rmq_delete_vhost', { name: vh })
                                            fetchRmqData()
                                        }
                                    }} 
                                    className="text-neutral-content/30 hover:text-error transition-colors p-0.5 rounded-md hover:bg-error/10"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )) : (
                            <div className="flex items-center justify-center w-full italic text-neutral-content/30 text-xs py-2">
                                No virtual hosts found.
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="vhost name (e.g. /prod)" 
                            id="newVhost" 
                            className="input input-sm bg-base-100 border-white/5 focus:border-primary/30 flex-1 font-mono text-xs rounded-xl" 
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateVHost()}
                        />
                        <button 
                            onClick={handleCreateVHost} 
                            className="btn btn-sm btn-primary rounded-xl px-4 font-black uppercase tracking-widest text-[10px]"
                        >
                            <Plus size={14} className="mr-1" />
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Users */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
                        <Users size={16} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">Management Users</h3>
                </div>

                <div className="rounded-2xl border border-white/5 overflow-hidden bg-base-300/30 shadow-sm ring-1 ring-white/5">
                    <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                            <thead>
                                <tr className="bg-base-300/50 text-[10px] uppercase font-black tracking-[0.15em] text-neutral-content/40 border-b border-white/5 leading-none h-10">
                                    <th className="pl-6">User</th>
                                    <th>Tags</th>
                                    <th className="pr-6 text-right w-20">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rmqUsers.length > 0 ? rmqUsers.map((u, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 group last:border-0 h-11">
                                        <td className="pl-6 font-mono font-bold text-xs text-base-content/80">{u.name}</td>
                                        <td>
                                            <span className={clsx(
                                                "badge badge-xs font-black uppercase tracking-widest p-2",
                                                u.tags?.includes('administrator') ? "badge-primary" : "badge-ghost opacity-50"
                                            )}>
                                                {u.tags || 'none'}
                                            </span>
                                        </td>
                                        <td className="pr-6 text-right">
                                            <button className="btn btn-ghost btn-xs btn-square text-neutral-content/30 hover:text-error hover:bg-error/10">
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center italic text-neutral-content/30 text-xs">
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create User Form */}
                <div className="p-5 bg-base-200/50 rounded-2xl border border-white/5 space-y-4 shadow-lg">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                        <Plus size={14} className="text-success" />
                        <h4 className="text-[10px] font-black text-neutral-content/60 uppercase tracking-[0.2em]">Add New User</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Username</label>
                            <input id="rmqUser" type="text" placeholder="e.g. admin_prod" className="input input-sm w-full bg-base-300 border-white/5 focus:border-success/30 font-mono text-xs rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Password</label>
                            <input id="rmqPass" type="password" placeholder="••••••••" className="input input-sm w-full bg-base-300 border-white/5 focus:border-success/30 font-mono text-xs rounded-xl" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Access Tag</label>
                            <select id="rmqTags" className="select select-sm w-full bg-base-300 border-white/5 focus:border-success/30 font-bold text-xs rounded-xl">
                                <option value="">No Special Tags</option>
                                <option value="administrator">Administrator (Full Access)</option>
                                <option value="management">Management UI Only</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Assign to VHost</label>
                            <select id="rmqPermVhost" className="select select-sm w-full bg-base-300 border-white/5 focus:border-success/30 font-bold text-xs rounded-xl">
                                <option value="">-- No Permissions --</option>
                                {rmqVHosts.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={handleCreateUser} 
                        className="btn btn-sm btn-success btn-block rounded-xl font-black uppercase tracking-widest text-[10px] mt-2 shadow-lg shadow-success/10"
                    >
                        Create User & Grant Permissions
                    </button>
                </div>
            </div>

            {/* Bindings */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                        <Link size={16} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">MQTT Bindings <span className="text-neutral-content/40 opacity-50">(amq.topic)</span></h3>
                </div>

                <div className="p-5 bg-base-200/50 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="sm:w-1/4 space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">VHost</label>
                            <select id="bindVhost" className="select select-sm w-full bg-base-300 border-white/5 focus:border-accent/30 font-bold text-xs rounded-xl">
                                {rmqVHosts.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Destination Queue</label>
                            <input id="bindQueue" type="text" placeholder="e.g. data_inbox" className="input input-sm w-full bg-base-300 border-white/5 focus:border-accent/30 font-mono text-xs rounded-xl" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Routing Key Pattern</label>
                            <input id="bindKey" type="text" placeholder="e.g. sensor/+/data" className="input input-sm w-full bg-base-300 border-white/5 focus:border-accent/30 font-mono text-xs rounded-xl" />
                        </div>
                    </div>
                    <button 
                        onClick={async () => {
                            const vhost = (document.getElementById('bindVhost') as HTMLSelectElement).value;
                            const queue = (document.getElementById('bindQueue') as HTMLInputElement).value;
                            const key = (document.getElementById('bindKey') as HTMLInputElement).value;

                            if (vhost && queue && key) {
                                const res = await sendCommand('rmq_create_binding', {
                                    vhost,
                                    queue,
                                    exchange: 'amq.topic',
                                    routing_key: key
                                });
                                if (res) setActionOutput(`Successfully bound "${queue}" to amq.topic with pattern "${key}"`);
                            }
                        }} 
                        className="btn btn-sm btn-accent btn-block rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-accent/10"
                    >
                        Create Binding
                    </button>
                </div>
            </div>
        </div>
    )
}
