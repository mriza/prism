import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAgents } from '../hooks/useAgents';
import { FolderKanban, KeyRound, Server, Plus, ArrowRight } from 'lucide-react';

function StatCard({
    label, value, icon, colorClass, href
}: { label: string; value: number; icon: React.ReactNode; colorClass: string; href: string }) {
    return (
        <Link to={href} className="stats shadow bg-base-200 border border-white/5 hover:border-primary/30 transition-all duration-200">
            <div className="stat">
                <div className={`stat-figure ${colorClass}`}>
                    {icon}
                </div>
                <div className="stat-value text-2xl">{value}</div>
                <div className="stat-title text-neutral-content">{label}</div>
            </div>
        </Link>
    );
}

export function DashboardPage() {
    const { projects } = useProjects();
    const { accounts, independentAccounts } = useAccounts();
    const { agents, error } = useAgents();

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-neutral-content text-sm">Overview of your infrastructure</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Projects" value={projects.length} icon={<FolderKanban size={24} />} colorClass="text-primary" href="/projects" />
                <StatCard label="Service Accounts" value={accounts.length} icon={<KeyRound size={24} />} colorClass="text-secondary" href="/accounts" />
                <StatCard
                    label="Agents Online"
                    value={agents.length}
                    icon={<Server size={24} />}
                    colorClass={error ? 'text-error' : 'text-success'}
                    href="/agents"
                />
                <StatCard label="Independent Accts" value={independentAccounts.length} icon={<KeyRound size={24} />} colorClass="text-accent" href="/accounts" />
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/projects" className="card bg-base-200 border border-white/5 hover:border-primary/30 transition-all cursor-pointer">
                    <div className="card-body p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Plus size={18} className="text-primary" />
                                <span className="font-semibold">New Project</span>
                            </div>
                            <ArrowRight size={16} className="text-neutral-content" />
                        </div>
                        <p className="text-sm text-neutral-content mt-2">
                            Create a project to group your service accounts
                        </p>
                    </div>
                </Link>
                <Link to="/accounts" className="card bg-base-200 border border-white/5 hover:border-primary/30 transition-all cursor-pointer">
                    <div className="card-body p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Plus size={18} className="text-secondary" />
                                <span className="font-semibold">Add Account</span>
                            </div>
                            <ArrowRight size={16} className="text-neutral-content" />
                        </div>
                        <p className="text-sm text-neutral-content mt-2">
                            Add a DB, MQ, S3, FTP, or PM2 service account
                        </p>
                    </div>
                </Link>
            </div>

            {/* Recent projects */}
            {projects.length > 0 && (
                <div className="card bg-base-200 border border-white/5">
                    <div className="card-body p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="card-title text-base font-bold text-neutral-content uppercase tracking-wider">Recent Projects</h2>
                            <Link to="/projects" className="text-sm text-primary hover:underline italic">
                                View all →
                            </Link>
                        </div>
                        <div className="space-y-1">
                            {projects.slice(0, 5).map(p => (
                                <Link 
                                    key={p.id} 
                                    to={`/projects/${p.id}`} 
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group"
                                >
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                                    <span className="font-medium group-hover:text-primary transition-colors">{p.name}</span>
                                    {p.description && (
                                        <span className="text-xs text-neutral-content ml-auto line-clamp-1">
                                            {p.description}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

