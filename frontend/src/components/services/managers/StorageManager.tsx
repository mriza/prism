import { useState, useEffect } from 'react'
import { HardDrive, X, Plus, Key, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface StorageManagerProps {
    sendCommand: (action: string, options?: Record<string, unknown>) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface StorageUser {
    access_key: string;
    secret_key?: string;
}

export function StorageManager({ sendCommand }: StorageManagerProps) {
    const [buckets, setBuckets] = useState<string[]>([])
    const [storageUsers, setStorageUsers] = useState<StorageUser[]>([])
    const [createdUser, setCreatedUser] = useState<StorageUser | null>(null)
    const [loading, setLoading] = useState(false)
    const [showSecret, setShowSecret] = useState(false)

    const fetchStorageData = async () => {
        setLoading(true)
        try {
            const b = await sendCommand('storage_list_buckets')
            if (b?.message) setBuckets(JSON.parse(b.message))

            const u = await sendCommand('storage_list_users')
            if (u?.message) setStorageUsers(JSON.parse(u.message))
        } catch (e) {
            console.error("Failed to fetch storage data", e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStorageData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleCreateBucket = async () => {
        const input = document.getElementById('newBucket') as HTMLInputElement;
        const val = input.value;
        if (val) {
            const res = await sendCommand('storage_create_bucket', { name: val });
            if (res) {
                input.value = '';
                fetchStorageData();
            }
        }
    }

    const handleCreateUser = async () => {
        const userEl = document.getElementById('storeUser') as HTMLInputElement;
        const passEl = document.getElementById('storePass') as HTMLInputElement;
        const user = userEl.value;
        const pass = passEl.value;
        if (user) {
            const res = await sendCommand('storage_create_user', { access_key: user, secret_key: pass });
            if (res && res.message) {
                setCreatedUser(JSON.parse(res.message));
                fetchStorageData();
                userEl.value = '';
                passEl.value = '';
                setShowSecret(true); // Auto show secret for new user
            }
        }
    }

    return (
        <div className={clsx("space-y-8 animate-in fade-in duration-500", loading && "opacity-50 pointer-events-none")}>
            {/* Buckets */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-info/10 text-info">
                        <HardDrive size={16} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">Storage Buckets</h3>
                </div>

                <div className="bg-base-300/30 rounded-2xl border border-white/5 p-4 shadow-inner space-y-4">
                    <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {buckets.length > 0 ? buckets.map(b => (
                            <div key={b} className="badge badge-lg bg-base-100 border-white/5 text-[11px] font-bold font-mono py-4 px-4 shadow-sm flex items-center gap-2 group hover:border-info/30 transition-colors">
                                <HardDrive size={12} className="text-info/50 group-hover:text-info transition-colors" />
                                {b}
                                <button 
                                    onClick={async () => {
                                        if (confirm(`Are you sure you want to delete bucket "${b}"?`)) {
                                            await sendCommand('storage_delete_bucket', { name: b })
                                            fetchStorageData()
                                        }
                                    }} 
                                    className="text-neutral-content/30 hover:text-error transition-colors ml-1 p-0.5 rounded-md hover:bg-error/10"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )) : (
                            <div className="flex items-center justify-center w-full italic text-neutral-content/30 text-xs py-2">
                                No storage buckets found.
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="e.g. static-assets" 
                            id="newBucket" 
                            className="input input-sm bg-base-100 border-white/5 focus:border-info/30 flex-1 font-mono text-xs rounded-xl" 
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateBucket()}
                        />
                        <button 
                            onClick={handleCreateBucket} 
                            className="btn btn-sm btn-info rounded-xl px-4 font-black uppercase tracking-widest text-[10px]"
                        >
                            <Plus size={14} className="mr-1" />
                            Create
                        </button>
                    </div>
                </div>
            </div>

            {/* Users */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-success/10 text-success">
                        <Key size={16} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">Access Keys</h3>
                </div>

                <div className="rounded-2xl border border-white/5 overflow-hidden bg-base-300/30 shadow-sm ring-1 ring-white/5">
                    <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                            <thead>
                                <tr className="bg-base-300/50 text-[10px] uppercase font-black tracking-[0.15em] text-neutral-content/40 border-b border-white/5 leading-none h-10">
                                    <th className="pl-6">Access Key (UID)</th>
                                    <th className="pr-6 text-right w-20">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {storageUsers.length > 0 ? storageUsers.map((u, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors border-b border-white/5 group last:border-0 h-11">
                                        <td className="pl-6 font-mono font-bold text-xs text-base-content/80">{u.access_key}</td>
                                        <td className="pr-6 text-right">
                                            <button 
                                                onClick={async () => {
                                                    if (confirm(`Are you sure you want to delete keys for user "${u.access_key}"?`)) {
                                                        await sendCommand('storage_delete_user', { access_key: u.access_key })
                                                        fetchStorageData()
                                                    }
                                                }}
                                                className="btn btn-ghost btn-xs btn-square text-neutral-content/30 hover:text-error hover:bg-error/10"
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={2} className="py-8 text-center italic text-neutral-content/30 text-xs">
                                            No access keys found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Created User Credentials Display */}
                {createdUser && (
                    <div className="alert alert-success bg-success/5 border-success/20 rounded-2xl p-5 shadow-lg animate-in slide-in-from-top-4 duration-300">
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between border-b border-success/10 pb-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-success h-5 w-5" />
                                    <h4 className="font-black text-[11px] uppercase tracking-widest text-success">Credentials Generated</h4>
                                </div>
                                <button onClick={() => setCreatedUser(null)} className="btn btn-ghost btn-xs btn-circle hover:bg-success/10 text-success/60">
                                    <X size={14} />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 p-3 rounded-xl bg-base-300 border border-white/5 shadow-inner">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 block">Access Key ID</label>
                                    <span className="font-mono text-xs text-white break-all select-all selection:bg-success/30">{createdUser.access_key}</span>
                                </div>
                                <div className="space-y-1.5 p-3 rounded-xl bg-base-300 border border-white/5 shadow-inner relative group">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 block">Secret Access Key</label>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={clsx(
                                            "font-mono text-xs break-all select-all selection:bg-success/30",
                                            showSecret ? "text-white" : "text-neutral-content/10 blur-[2px] pointer-events-none"
                                        )}>
                                            {createdUser.secret_key}
                                        </span>
                                        <button 
                                            onClick={() => setShowSecret(!showSecret)}
                                            className="btn btn-ghost btn-xs btn-square text-neutral-content/40 hover:text-success hover:bg-success/10"
                                        >
                                            {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 px-1 text-[10px] text-success/60 italic">
                                <AlertCircle size={10} />
                                <span>Save these credentials now. They will not be shown again.</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Access Key Form */}
                <div className="p-6 bg-base-200/50 rounded-2xl border border-white/5 space-y-5 shadow-lg">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                        <Plus size={16} className="text-success" />
                        <h4 className="text-[10px] font-black text-neutral-content/60 uppercase tracking-[0.2em]">Generate New Access Key</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Access Key ID (Username)</label>
                            <input id="storeUser" type="text" placeholder="e.g. backup-svc" className="input input-sm w-full bg-base-300 border-white/5 focus:border-success/30 font-mono text-xs rounded-xl h-10" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-content/40 ml-1">Custom Secret Key <span className="opacity-30">(Optional)</span></label>
                            <input id="storePass" type="text" placeholder="Leave empty for auto-gen" className="input input-sm w-full bg-base-300 border-white/5 focus:border-success/30 font-mono text-xs rounded-xl h-10" />
                        </div>
                    </div>

                    <button 
                        onClick={handleCreateUser} 
                        className="btn btn-sm btn-success btn-block h-10 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-success/10 mt-2"
                    >
                        Generate Access Credentials
                    </button>
                </div>
            </div>
        </div>
    )
}
