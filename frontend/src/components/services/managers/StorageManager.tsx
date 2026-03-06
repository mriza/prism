import { useState, useEffect } from 'react'
import { Database, X } from 'lucide-react'

interface StorageManagerProps {
    sendCommand: (action: string, options?: any) => Promise<any>
}

export function StorageManager({ sendCommand }: StorageManagerProps) {
    const [buckets, setBuckets] = useState<string[]>([])
    const [storageUsers, setStorageUsers] = useState<any[]>([])
    const [createdUser, setCreatedUser] = useState<any | null>(null)

    const fetchStorageData = async () => {
        const b = await sendCommand('storage_list_buckets')
        if (b?.message) setBuckets(JSON.parse(b.message))

        const u = await sendCommand('storage_list_users')
        if (u?.message) setStorageUsers(JSON.parse(u.message))
    }

    useEffect(() => {
        fetchStorageData()
    }, [])

    return (
        <div className="space-y-8">
            {/* Buckets */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">Buckets</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                    {buckets.map(b => (
                        <span key={b} className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-200 border border-gray-600 flex items-center gap-2">
                            <Database className="w-3 h-3 text-indigo-400" />
                            {b}
                            <button onClick={async () => {
                                if (confirm(`Delete bucket ${b}?`)) {
                                    await sendCommand('storage_delete_bucket', { name: b })
                                    fetchStorageData()
                                }
                            }} className="text-red-400 hover:text-red-300 ml-1"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {buckets.length === 0 && <span className="text-gray-500 italic text-sm">No buckets.</span>}
                </div>
                <div className="flex gap-2">
                    <input type="text" placeholder="New Bucket Name" id="newBucket" className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-sm flex-1 text-white" />
                    <button onClick={async () => {
                        const val = (document.getElementById('newBucket') as HTMLInputElement).value;
                        if (val) {
                            await sendCommand('storage_create_bucket', { name: val });
                            (document.getElementById('newBucket') as HTMLInputElement).value = '';
                            fetchStorageData();
                        }
                    }} className="px-3 py-1 bg-indigo-600 rounded text-sm hover:bg-indigo-500 text-white">Create</button>
                </div>
            </div>

            {/* Users */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">Users / Keys</h3>
                <div className="bg-gray-900 rounded border border-gray-700 overflow-hidden mb-3">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-800 text-gray-400">
                            <tr><th className="p-2">Access Key</th><th className="p-2 text-right">Action</th></tr>
                        </thead>
                        <tbody>
                            {storageUsers.map((u: any, idx) => (
                                <tr key={idx} className="border-t border-gray-800">
                                    <td className="p-2 font-mono">{u.access_key}</td>
                                    <td className="p-2 text-right">
                                        <button onClick={async () => {
                                            if (confirm(`Delete user ${u.access_key}?`)) {
                                                await sendCommand('storage_delete_user', { access_key: u.access_key })
                                                fetchStorageData()
                                            }
                                        }} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Created User Display */}
                {createdUser && (
                    <div className="p-3 mb-3 bg-green-900/30 border border-green-800 rounded-lg text-sm space-y-1 relative">
                        <button onClick={() => setCreatedUser(null)} className="absolute top-2 right-2 text-green-400 hover:text-green-300"><X className="w-4 h-4" /></button>
                        <h4 className="font-bold text-green-400">User Created!</h4>
                        <p><span className="text-green-500/70 w-24 inline-block">Access Key:</span> <span className="font-mono text-white select-all">{createdUser.access_key}</span></p>
                        <p><span className="text-green-500/70 w-24 inline-block">Secret Key:</span> <span className="font-mono text-white select-all">{createdUser.secret_key}</span></p>
                    </div>
                )}

                <div className="p-3 bg-gray-800/50 rounded border border-gray-700 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-300 uppercase">Create User</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <input id="storeUser" type="text" placeholder="Access Key (Name)" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                        <input id="storePass" type="text" placeholder="Secret Key (Optional)" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white" />
                    </div>
                    <button onClick={async () => {
                        const user = (document.getElementById('storeUser') as HTMLInputElement).value;
                        const pass = (document.getElementById('storePass') as HTMLInputElement).value;
                        if (user) {
                            const res = await sendCommand('storage_create_user', { access_key: user, secret_key: pass });
                            if (res && res.message) {
                                setCreatedUser(JSON.parse(res.message));
                                fetchStorageData();
                                (document.getElementById('storeUser') as HTMLInputElement).value = '';
                                (document.getElementById('storePass') as HTMLInputElement).value = '';
                            }
                        }
                    }} className="w-full py-1 bg-green-700 hover:bg-green-600 rounded text-sm text-white">Create User</button>
                </div>
            </div>
        </div>
    )
}
