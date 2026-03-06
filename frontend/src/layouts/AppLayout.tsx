import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAgents } from '../hooks/useAgents';

export function AppLayout() {
    const { agents, error } = useAgents();

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Topbar */}
                <header
                    style={{
                        height: '52px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        padding: '0 1.5rem',
                        borderBottom: '1px solid var(--color-border)',
                        background: 'var(--color-bg-surface)',
                        gap: '0.75rem',
                    }}
                >
                    {/* Agent status badge */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.3rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            background: error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                            border: `1px solid ${error ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                            fontSize: '0.75rem',
                        }}
                    >
                        <span
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: error ? 'var(--color-red)' : 'var(--color-green)',
                                animation: error ? 'none' : 'pulse-dot 2s infinite',
                            }}
                        />
                        {error ? (
                            <span style={{ color: '#f87171' }}>Hub offline</span>
                        ) : (
                            <span style={{ color: '#4ade80' }}>
                                {agents.length} agent{agents.length !== 1 ? 's' : ''} online
                            </span>
                        )}
                    </div>
                </header>

                {/* Page content */}
                <main
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1.75rem',
                    }}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
