import { Settings } from 'lucide-react';

export function SettingsPage() {
    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '1.75rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Settings</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    Application configuration
                </p>
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                    {/* Hub connection */}
                    <div style={{ flex: '1 1 280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                            <Settings size={16} color="var(--color-accent)" />
                            <h2 style={{ fontWeight: 600, fontSize: '0.9rem' }}>Hub Connection</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                                    Hub URL
                                </div>
                                <input
                                    defaultValue="http://localhost:65432"
                                    style={{
                                        width: '100%',
                                        background: 'var(--color-bg-base)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--color-text-primary)',
                                        fontFamily: 'inherit',
                                        fontSize: '0.875rem',
                                        padding: '0.5rem 0.75rem',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    More settings coming soon.
                </div>
            </div>
        </div>
    );
}
