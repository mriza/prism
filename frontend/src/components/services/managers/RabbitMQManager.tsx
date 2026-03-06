import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface RabbitMQManagerProps {
    sendCommand: (action: string, options?: any) => Promise<any>
    setActionOutput: (output: string | null) => void
}

export function RabbitMQManager({ sendCommand, setActionOutput }: RabbitMQManagerProps) {
    const [rmqVHosts, setRmqVHosts] = useState<string[]>([])
    const [rmqUsers, setRmqUsers] = useState<any[]>([])

    const fetchRmqData = async () => {
        // VHosts
        const vhostsData = await sendCommand('rmq_list_vhosts')
        if (vhostsData?.message) setRmqVHosts(JSON.parse(vhostsData.message))

        // Users
        const usersData = await sendCommand('rmq_list_users')
        if (usersData?.message) setRmqUsers(JSON.parse(usersData.message))
    }

    useEffect(() => {
        fetchRmqData()
    }, [])

    return (
        <div className="space-y-8">
            {/* VHosts */}
            <div>
                <h3 className="text-md font-medium text-indigo-300 mb-2 flex items-center gap-2">Virtual Hosts</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                    {rmqVHosts.map(vh => (
                        <span key={vh} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-200 border border-gray-600 flex items-center gap-2">
                            {vh}
                            <button onClick={async () => {
                                if (confirm(`Delete vhost ${vh}?`)) {
                                    await sendCommand('rmq_delete_vhost', { name: vh })
                                    fetchRmqData()
                                }
                            }} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="New VHost Name" id="newVhost" className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-sm flex-1 text-white" />
                    <button onClick={async () => {
                        const val = (document.getElementById('newVhost') as HTMLInputElement).value;
                        if (val) {
                            await sendCommand('rmq_create_vhost', { name: val });
                            (document.getElementById('newVhost') as HTMLInputElement).value = '';
                            fetchRmqData();
                        }
                    }} className="px-3 py-1 bg-indigo-600 rounded text-sm hover:bg-indigo-500 text-white">Add</button>
                </div>
            </div>

            {/* Users */}
            <div>
                <h3 className="text-md font-medium text-indigo-300 mb-2 flex items-center gap-2">Users</h3>
                <div className="bg-gray-900 rounded border border-gray-700 overflow-hidden mb-3">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-800 text-gray-400">
                            <tr><th className="p-2">User</th><th className="p-2">Tags</th><th className="p-2">Action</th></tr>
                        </thead>
                        <tbody>
                            {rmqUsers.map((u: any, idx) => (
                                <tr key={idx} className="border-t border-gray-800">
                                    <td className="p-2">{u.name}</td>
                                    <td className="p-2">{u.tags}</td>
                                    <td className="p-2"><button className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-gray-800/50 rounded border border-gray-700 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase">Create User</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <input id="rmqUser" type="text" placeholder="Username" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                        <input id="rmqPass" type="password" placeholder="Password" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                    </div>
                    <div className="flex gap-2">
                        <select id="rmqTags" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm flex-1 text-white">
                            <option value="">(No Tags)</option>
                            <option value="administrator">Administrator</option>
                            <option value="management">Management</option>
                        </select>
                        <select id="rmqPermVhost" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm flex-1 text-white">
                            <option value="">-- Assign VHost --</option>
                            {rmqVHosts.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <button onClick={async () => {
                        const user = (document.getElementById('rmqUser') as HTMLInputElement).value;
                        const pass = (document.getElementById('rmqPass') as HTMLInputElement).value;
                        const tags = (document.getElementById('rmqTags') as HTMLSelectElement).value;
                        const vhost = (document.getElementById('rmqPermVhost') as HTMLSelectElement).value;

                        if (user && pass) {
                            await sendCommand('rmq_create_user', { username: user, password: pass, tags });
                            if (vhost) {
                                // Default full permissions
                                await sendCommand('rmq_set_permissions', { vhost, username: user });
                            }
                            fetchRmqData();
                            // clear inputs
                            (document.getElementById('rmqUser') as HTMLInputElement).value = '';
                            (document.getElementById('rmqPass') as HTMLInputElement).value = '';
                        }
                    }} className="w-full py-1 bg-green-700 hover:bg-green-600 rounded text-sm text-white">Create User & Assign Permissions</button>
                </div>
            </div>

            {/* Bindings */}
            <div>
                <h3 className="text-md font-medium text-indigo-300 mb-2 flex items-center gap-2">MQTT Bindings (amq.topic)</h3>
                <div className="p-3 bg-gray-800/50 rounded border border-gray-700 space-y-2">
                    <div className="flex gap-2">
                        <select id="bindVhost" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-1/4 text-white">
                            {rmqVHosts.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <input id="bindQueue" type="text" placeholder="Destination Queue" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm flex-1 text-white" />
                        <input id="bindKey" type="text" placeholder="Routing Key (e.g. device.1.#)" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm flex-1 text-white" />
                    </div>
                    <button onClick={async () => {
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
                            if (res) setActionOutput(`Bound ${queue} to amq.topic (${key})`);
                        }
                    }} className="w-full py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm text-white">Create Binding</button>
                </div>
            </div>
        </div>
    )
}
