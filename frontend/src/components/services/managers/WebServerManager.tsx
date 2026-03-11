import { useState, useEffect } from 'react'
import { Globe, Plus, Trash2, Power, Layout, FileCode } from 'lucide-react'
import { clsx } from 'clsx'

interface WebServerManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
    serviceName: string
}

export function WebServerManager({ sendCommand, serviceName }: WebServerManagerProps) {
    const [sites, setSites] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const fetchSites = async () => {
        setLoading(true)
        try {
            const data = await sendCommand('web_list_sites')
            if (data && data.message) setSites(JSON.parse(data.message))
        } catch (e) {
            console.error("Failed to fetch sites", e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSites()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className={clsx("space-y-8 animate-in fade-in duration-500", loading && "opacity-50 pointer-events-none")}>
            {/* Sites List */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Globe size={16} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">Managed Virtual Hosts</h3>
                </div>

                {sites.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                        {sites.map(site => {
                            const parts = site.match(/^(.+) \((.+)\)$/);
                            const name = parts ? parts[1] : site;
                            const status = parts ? parts[2] : 'unknown';
                            const isEnabled = status === 'enabled';

                            return (
                                <div key={site} className="flex items-center justify-between p-4 bg-base-200 rounded-2xl border border-white/5 shadow-sm group hover:border-primary/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            "p-2.5 rounded-xl border flex items-center justify-center transition-colors",
                                            isEnabled ? "bg-success/10 border-success/20 text-success" : "bg-base-300 border-white/5 text-neutral-content/40"
                                        )}>
                                            <Layout size={18} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-base-content leading-tight mb-1">{name}</div>
                                            <div className={clsx(
                                                "badge badge-xs font-black uppercase tracking-widest p-1.5",
                                                isEnabled ? "badge-success" : "badge-ghost opacity-40"
                                            )}>
                                                {status}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                await sendCommand(isEnabled ? 'web_disable_site' : 'web_enable_site', { name });
                                                fetchSites();
                                            }}
                                            className={clsx(
                                                "btn btn-sm btn-square rounded-xl transition-all",
                                                isEnabled ? "btn-warning bg-warning/10 border-warning/20 text-warning hover:bg-warning hover:text-warning-content" : "btn-success bg-success/10 border-success/20 text-success hover:bg-success hover:text-success-content"
                                            )}
                                            title={isEnabled ? 'Disable Site' : 'Enable Site'}
                                        >
                                            <Power size={14} />
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Are you sure you want to delete site "${name}"?`)) {
                                                    await sendCommand('web_delete_site', { name });
                                                    fetchSites();
                                                }
                                            }}
                                            className="btn btn-sm btn-square btn-ghost rounded-xl text-neutral-content/30 hover:text-error hover:bg-error/10"
                                            title="Delete Site"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center bg-base-200/50 rounded-2xl border border-dashed border-white/10 italic text-neutral-content/40 text-sm">
                        No sites discovered for this server instance.
                    </div>
                )}
            </div>

            {/* Add New Site Form */}
            <div className="p-6 bg-base-200/50 rounded-2xl border border-white/5 space-y-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 text-primary group-hover:scale-110 transition-transform duration-500">
                    <FileCode size={80} />
                </div>
                
                <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                    <Plus size={16} className="text-primary" />
                    <h4 className="text-[10px] font-black text-neutral-content/60 uppercase tracking-[0.2em]">Deploy New Configuration</h4>
                </div>

                <div className="space-y-4 relative z-10">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Domain Name / Identifier</label>
                        <input 
                            id="newSiteName" 
                            type="text" 
                            placeholder="e.g. app.prism.io" 
                            className="input input-sm w-full bg-base-300 border-white/5 focus:border-primary/30 font-mono text-xs rounded-xl h-10" 
                        />
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Configuration Content</label>
                        <textarea 
                            id="newSiteContent" 
                            rows={6} 
                            placeholder={serviceName === 'caddy' ? "example.com {\n  reverse_proxy localhost:8080\n}" : "server {\n  listen 80;\n  server_name example.com;\n  location / {\n    proxy_pass http://localhost:8080;\n  }\n}"} 
                            className="textarea textarea-sm w-full bg-base-300 border-white/5 focus:border-primary/30 text-xs font-mono leading-relaxed rounded-xl p-4 min-h-[120px]" 
                        />
                    </div>
                    
                    <button
                        onClick={async () => {
                            const nameEl = document.getElementById('newSiteName') as HTMLInputElement;
                            const contentEl = document.getElementById('newSiteContent') as HTMLTextAreaElement;
                            const name = nameEl.value;
                            const content = contentEl.value;
                            if (name && content) {
                                await sendCommand('web_create_site', { name, content });
                                nameEl.value = '';
                                contentEl.value = '';
                                fetchSites();
                            }
                        }}
                        className="btn btn-sm btn-primary btn-block h-10 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/10 mt-2"
                    >
                        Deploy Configuration
                    </button>
                </div>
            </div>
        </div>
    )
}
