import { Settings } from 'lucide-react';

export function SettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-neutral-content text-sm">
                        Application configuration
                    </p>
                </div>
            </div>

            <div className="card bg-base-200 border border-white/5 shadow-sm">
                <div className="card-body p-6">
                    <div className="flex flex-wrap gap-8">
                        {/* Hub connection */}
                        <div className="flex-1 min-w-[280px] space-y-4">
                            <div className="flex items-center gap-2 group">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-content transition-colors">
                                    <Settings size={16} />
                                </div>
                                <h2 className="font-bold text-base">Hub Connection</h2>
                            </div>
                            
                            <div className="form-control w-full max-w-md">
                                <label className="label py-1">
                                    <span className="label-text text-[10px] font-bold uppercase tracking-widest text-neutral-content/60">Hub URL</span>
                                </label>
                                <input
                                    type="text"
                                    defaultValue="http://localhost:65432"
                                    className="input input-bordered bg-base-300 focus:input-primary transition-all font-mono text-sm"
                                />
                                <label className="label">
                                    <span className="label-text-alt text-neutral-content/60">The primary endpoint for communicating with the PRISM hub</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-2 text-sm text-neutral-content/50 italic">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-content/30" />
                        More settings coming soon.
                    </div>
                </div>
            </div>
        </div>
    );
}

