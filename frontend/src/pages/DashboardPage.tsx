import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAccounts } from '../hooks/useAccounts';
import { useAgents } from '../hooks/useAgents';
import { FolderKanban, KeyRound, Server, Plus, ArrowRight } from 'lucide-react';

function StatCard({
    label, value, icon, color, href
}: { label: string; value: number; icon: React.ReactNode; color: string; href: string }) {
    return (
        <Link to={href} style={{ textDecoration: 'none' }}>
            <div
                className="card"
                style={{
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = color + '55';
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${color}15`;
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
            >
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: color + '20',
                        border: `1px solid ${color}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color,
                    }}
                >
                    {icon}
                </div>
                <div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{label}</div>
                </div>
            </div>
        </Link>
    );
}

export function DashboardPage() {
    const { projects } = useProjects();
    const { accounts, independentAccounts } = useAccounts();
    const { agents, error } = useAgents();

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Dashboard
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Overview of your infrastructure
                </p>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <StatCard label="Projects" value={projects.length} icon={<FolderKanban size={22} />} color="#6366f1" href="/projects" />
                <StatCard label="Service Accounts" value={accounts.length} icon={<KeyRound size={22} />} color="#ec4899" href="/accounts" />
                <StatCard
                    label="Agents Online"
                    value={agents.length}
                    icon={<Server size={22} />}
                    color={error ? '#ef4444' : '#22c55e'}
                    href="/agents"
                />
                <StatCard label="Independent Accts" value={independentAccounts.length} icon={<KeyRound size={22} />} color="#f97316" href="/accounts" />
            </div>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <Link to="/projects" style={{ textDecoration: 'none' }}>
                    <div
                        className="card"
                        style={{ padding: '1.25rem', cursor: 'pointer', transition: 'var(--transition)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <Plus size={16} color="var(--color-accent)" />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>New Project</span>
                            </div>
                            <ArrowRight size={14} color="var(--color-text-muted)" />
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                            Create a project to group your service accounts
                        </p>
                    </div>
                </Link>
                <Link to="/accounts" style={{ textDecoration: 'none' }}>
                    <div
                        className="card"
                        style={{ padding: '1.25rem', cursor: 'pointer', transition: 'var(--transition)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <Plus size={16} color="#ec4899" />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add Account</span>
                            </div>
                            <ArrowRight size={14} color="var(--color-text-muted)" />
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                            Add a DB, MQ, S3, FTP, or PM2 service account
                        </p>
                    </div>
                </Link>
            </div>

            {/* Recent projects */}
            {projects.length > 0 && (
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h2 style={{ fontWeight: 600, fontSize: '0.9rem' }}>Recent Projects</h2>
                        <Link to="/projects" style={{ fontSize: '0.75rem', color: 'var(--color-accent)', textDecoration: 'none' }}>
                            View all →
                        </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {projects.slice(0, 5).map(p => (
                            <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.625rem',
                                        borderRadius: 'var(--radius-md)',
                                        transition: 'var(--transition)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.name}</span>
                                    {p.description && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                                            {p.description}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
