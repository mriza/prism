import { useAgents } from '../hooks/useAgents';
import { Server, Cpu, ShieldCheck, Disc, AlertCircle } from 'lucide-react';

export function AgentsPage() {
    const { agents, loading, error } = useAgents();

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '1.75rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Agents</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    Connected servers and their managed services
                </p>
            </div>

            {error && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '1rem 1.25rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem',
                    }}
                >
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {loading && agents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                    Connecting to hub…
                </div>
            ) : agents.length === 0 ? (
                <div
                    className="card"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', borderStyle: 'dashed', gap: '0.75rem' }}
                >
                    <Server size={40} color="var(--color-text-muted)" />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>No agents connected</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                            Start a FITZ agent on a server to see it here
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className="card"
                            style={{ overflow: 'hidden', transition: 'var(--transition)' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                        >
                            {/* Card header */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-elevated)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <Server size={16} color="#22c55e" />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{agent.id}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', color: '#4ade80' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 2s infinite', display: 'inline-block' }} />
                                    Online
                                </div>
                            </div>

                            {/* Services */}
                            <div style={{ padding: '1rem 1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                                    <Cpu size={11} />
                                    Managed Services
                                </div>
                                {agent.services && agent.services.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                        {agent.services.map(svc => (
                                            <span
                                                key={svc}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    padding: '0.25rem 0.6rem',
                                                    borderRadius: '6px',
                                                    background: 'var(--color-bg-elevated)',
                                                    border: '1px solid var(--color-border)',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--color-text-secondary)',
                                                }}
                                            >
                                                {svc === 'ufw' ? <ShieldCheck size={11} color="#60a5fa" /> : <Disc size={11} />}
                                                {svc}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                        No active services detected
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
