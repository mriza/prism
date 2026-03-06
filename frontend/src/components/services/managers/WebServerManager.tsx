import { useState, useEffect } from 'react'

interface WebServerManagerProps {
    sendCommand: (action: string, options?: any) => Promise<any>
    serviceName: string
}

export function WebServerManager({ sendCommand, serviceName }: WebServerManagerProps) {
    const [sites, setSites] = useState<string[]>([])

    const fetchSites = async () => {
        const data = await sendCommand('web_list_sites')
        if (data && data.message) setSites(JSON.parse(data.message))
    }

    useEffect(() => {
        fetchSites()
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">Managed Sites</h3>
                {sites.length > 0 ? (
                    <div className="space-y-2">
                        {sites.map(site => {
                            // site string format: "name (status)"
                            const parts = site.match(/^(.+) \((.+)\)$/);
                            const name = parts ? parts[1] : site;
                            const status = parts ? parts[2] : 'unknown';
                            const isEnabled = status === 'enabled';

                            return (
                                <div key={site} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                                    <div>
                                        <div className="font-medium text-gray-200">{name}</div>
                                        <div className={`text-xs ${isEnabled ? 'text-green-400' : 'text-gray-400'}`}>{status}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                await sendCommand(isEnabled ? 'web_disable_site' : 'web_enable_site', { name });
                                                fetchSites();
                                            }}
                                            className={`px-3 py-1 text-xs rounded border ${isEnabled ? 'border-yellow-600 text-yellow-500 hover:bg-yellow-900/20' : 'border-green-600 text-green-500 hover:bg-green-900/20'}`}
                                        >
                                            {isEnabled ? 'Disable' : 'Enable'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Delete site ${name}?`)) {
                                                    await sendCommand('web_delete_site', { name });
                                                    fetchSites();
                                                }
                                            }}
                                            className="px-2 py-1 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500 italic text-sm">No sites found.</p>
                )}
            </div>

            <div className="p-4 bg-gray-800/50 rounded border border-gray-700 space-y-3">
                <h4 className="text-sm font-semibold text-gray-300 uppercase">Add New Site</h4>
                <input id="newSiteName" type="text" placeholder="Site Name (e.g. example.com)" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                <textarea id="newSiteContent" rows={5} placeholder={serviceName === 'caddy' ? "example.com {\n  reverse_proxy localhost:8080\n}" : "server {\n  listen 80;\n  server_name example.com;\n  location / {\n    proxy_pass http://localhost:8080;\n  }\n}"} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 font-mono" />
                <button
                    onClick={async () => {
                        const name = (document.getElementById('newSiteName') as HTMLInputElement).value;
                        const content = (document.getElementById('newSiteContent') as HTMLTextAreaElement).value;
                        if (name && content) {
                            await sendCommand('web_create_site', { name, content });
                            (document.getElementById('newSiteName') as HTMLInputElement).value = '';
                            (document.getElementById('newSiteContent') as HTMLTextAreaElement).value = '';
                            fetchSites();
                        }
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all"
                >
                    Create Site
                </button>
            </div>
        </div>
    )
}
