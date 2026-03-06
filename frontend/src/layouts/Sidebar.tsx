import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderKanban,
    KeyRound,
    Server,
    Settings,
    Zap,
} from 'lucide-react';

const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/accounts', label: 'Accounts', icon: KeyRound },
    { to: '/agents', label: 'Agents', icon: Server },
    { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    return (
        <aside
            style={{
                width: '220px',
                flexShrink: 0,
                background: 'var(--color-bg-surface)',
                borderRight: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                position: 'sticky',
                top: 0,
            }}
        >
            {/* Brand */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '1.25rem 1.25rem 1rem',
                    borderBottom: '1px solid var(--color-border)',
                }}
            >
                <div
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 0 12px rgba(99,102,241,0.4)',
                    }}
                >
                    <Zap size={16} color="#fff" />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>PRISM</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Infra Manager
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '0.75rem 0.625rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            padding: '0.55rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? '#fff' : 'var(--color-text-secondary)',
                            background: isActive ? 'var(--color-accent)' : 'transparent',
                            boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                            transition: 'var(--transition)',
                        })}
                        onMouseEnter={e => {
                            const el = e.currentTarget;
                            if (!el.classList.contains('active')) {
                                el.style.background = 'rgba(255,255,255,0.05)';
                                el.style.color = 'var(--color-text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            const el = e.currentTarget;
                            if (!el.classList.contains('active')) {
                                el.style.background = 'transparent';
                                el.style.color = 'var(--color-text-secondary)';
                            }
                        }}
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div
                style={{
                    padding: '0.75rem 1.25rem',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: '0.7rem',
                    color: 'var(--color-text-muted)',
                }}
            >
                v0.1.0-alpha
            </div>
        </aside>
    );
}
