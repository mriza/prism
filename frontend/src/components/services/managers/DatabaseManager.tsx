import { useState, useEffect } from 'react'
import { Database, User, AlertCircle, RefreshCw } from 'lucide-react'

interface DatabaseManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function DatabaseManager({ sendCommand }: DatabaseManagerProps) {
    const [dbList, setDbList] = useState<string[]>([])
    const [dbUsers, setDbUsers] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchDatabases = async () => {
        const data = await sendCommand('db_list_dbs')
        if (data && data.message) {
            try {
                setDbList(JSON.parse(data.message))
            } catch { setError("Failed to parse DB list") }
        }
    }

    const fetchUsers = async () => {
        const data = await sendCommand('db_list_users')
        if (data && data.message) {
            try {
                setDbUsers(JSON.parse(data.message))
            } catch { setError("Failed to parse User list") }
        }
    }

    const refreshData = async () => {
        setLoading(true)
        setError(null)
        await Promise.all([fetchDatabases(), fetchUsers()])
        setLoading(false)
    }

    useEffect(() => {
        refreshData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {error && (
                <div className="alert alert-error text-xs p-3 rounded-xl border border-error/20 flex items-start">
                    <AlertCircle size={16} className="mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-8 text-primary opacity-50">
                    <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Updating...</span>
                </div>
            )}

            {!loading && (
                <>
                    {/* Databases */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-info/10 text-info">
                                    <Database size={16} />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest leading-none">Databases</h3>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 p-4 bg-base-300/30 rounded-2xl border border-white/5 shadow-inner min-h-[60px]">
                            {dbList.length > 0 ? dbList.map(db => (
                                <div key={db} className="badge badge-lg bg-base-100 border-white/5 text-[11px] font-bold font-mono py-4 px-4 shadow-sm hover:border-info/30 transition-colors">
                                    {db}
                                </div>
                            )) : (
                                <div className="flex items-center justify-center w-full italic text-neutral-content/30 text-xs">
                                    No databases found.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Users */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-success/10 text-success">
                                <User size={16} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest leading-none">Database Users</h3>
                        </div>
                        
                        <div className="rounded-2xl border border-white/5 overflow-hidden bg-base-300/30 shadow-sm ring-1 ring-white/5">
                            <div className="overflow-x-auto">
                                <table className="table table-sm w-full">
                                    <thead>
                                        <tr className="bg-base-300/50 text-[10px] uppercase font-black tracking-[0.15em] text-neutral-content/40 border-b border-white/5 leading-none h-10">
                                            <th className="pl-6">User</th>
                                            <th className="pr-6 text-right">Host</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dbUsers.length > 0 ? dbUsers.map((u, idx) => (
                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 group last:border-0 h-11">
                                                <td className="pl-6 font-mono font-bold text-xs text-base-content/80">{u}</td>
                                                <td className="pr-6 text-right font-mono text-[10px] text-neutral-content/40">-</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={2} className="py-8 text-center italic text-neutral-content/30 text-xs">
                                                    No database users found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
