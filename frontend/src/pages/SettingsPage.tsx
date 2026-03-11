import { Settings, Folder } from 'lucide-react';
import { Input } from '../components/ui/Fields';

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
                            
                            <Input
                                label="Hub URL"
                                defaultValue="http://localhost:65432"
                                description="The primary endpoint for communicating with the PRISM hub"
                                className="bg-base-300 font-mono text-sm max-w-md"
                            />
                        </div>

                        {/* FTP Server (vsftpd) */}
                        <div className="flex-1 min-w-[280px] space-y-4">
                            <div className="flex items-center gap-2 group">
                                <div className="p-1.5 rounded-lg bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-secondary-content transition-colors">
                                    <Folder size={16} />
                                </div>
                                <h2 className="font-bold text-base">FTP Server (vsftpd)</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4 max-w-md">
                                <Input
                                    label="Default Root Path Template"
                                    defaultValue="/var/ftp/virtual_users/{username}"
                                    description="Template used for new account home directories"
                                    className="bg-base-300 font-mono text-sm"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="System User"
                                        defaultValue="ftpuser"
                                        description="Local account for mapping"
                                        className="bg-base-300 text-sm"
                                    />
                                    <Input
                                        label="PAM Service"
                                        defaultValue="vsftpd.virtual"
                                        description="PAM config filename"
                                        className="bg-base-300 text-sm"
                                    />
                                </div>
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

