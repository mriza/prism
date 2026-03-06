import { useState, useEffect } from 'react'
import { Database, User } from 'lucide-react'

interface DatabaseManagerProps {
    sendCommand: (action: string, options?: any) => Promise<any>
}

export function DatabaseManager({ sendCommand }: DatabaseManagerProps) {
    const [dbList, setDbList] = useState<string[]>([])
    const [dbUsers, setDbUsers] = useState<string[] | any[]>([])
    const [error, setError] = useState<string | null>(null)

    const fetchDatabases = async () => {
        const data = await sendCommand('db_list_dbs')
        if (data && data.message) {
            try {
                setDbList(JSON.parse(data.message))
            } catch (e) { setError("Failed to parse DB list") }
        }
    }

    const fetchUsers = async () => {
        const data = await sendCommand('db_list_users')
        if (data && data.message) {
            try {
                setDbUsers(JSON.parse(data.message))
            } catch (e) { setError("Failed to parse User list") }
        }
    }

    useEffect(() => {
        fetchDatabases()
        fetchUsers()
    }, [])

    return (
        <div className="space-y-6">
            {error && <div className="text-red-400 text-sm">{error}</div>}

            {/* Databases */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Databases
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {dbList.length > 0 ? dbList.map(db => (
                        <div key={db} className="bg-gray-900 p-2 rounded border border-gray-700 text-sm text-gray-300">
                            {db}
                        </div>
                    )) : <p className="text-gray-500 text-sm">No databases found.</p>}
                </div>
            </div>

            {/* Users */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Users
                </h3>
                <div className="bg-gray-900 rounded border border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-800 text-gray-400">
                            <tr>
                                <th className="p-2">User</th>
                                <th className="p-2">Host</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dbUsers.map((u: any, idx) => (
                                <tr key={idx} className="border-t border-gray-800">
                                    <td className="p-2">{u}</td>
                                    <td className="p-2">-</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
