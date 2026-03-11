import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            const state = location.state as { from?: { pathname: string } } | null;
            const from = state?.from?.pathname || "/";
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, location]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || 'Invalid credentials');
            }

            const data = await res.json();
            if (data.token) {
                login(data.token);
                // Navigate immediately
                const state = location.state as { from?: { pathname: string } } | null;
                const from = state?.from?.pathname || "/";
                navigate(from, { replace: true });
            } else {
                throw new Error('No token received');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to login';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-base-300 flex items-center justify-center p-4">
            <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-white/5">
                <div className="card-body">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/30">
                            <ShieldAlert size={32} className="text-primary" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">PRISM</h2>
                        <p className="text-neutral-content mt-1 text-xs font-bold uppercase tracking-[0.2em] opacity-40">Universal Fleet Control</p>
                    </div>

                    {error && (
                        <div className="alert alert-error shadow-sm mb-4 py-3 rounded-xl border border-error/20">
                            <span className="text-xs font-bold uppercase tracking-wide">{error}</span>
                        </div>
                    )}

                    {isAuthenticated && (
                        <div className="alert alert-success shadow-sm mb-6 py-4 rounded-xl border border-success/20 flex flex-col items-center gap-3">
                            <span className="text-xs font-bold uppercase tracking-wide">You are logged in</span>
                            <button onClick={() => navigate('/')} className="btn btn-sm btn-ghost bg-success/10 hover:bg-success/20">Go to Dashboard</button>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="form-control">
                            <label className="label pb-2 pt-0.5">
                                <span className="label-text text-[11px] font-extrabold uppercase tracking-widest text-neutral-content/90">Username</span>
                            </label>
                            <input 
                                type="text" 
                                className="input input-bordered focus:border-primary transition-colors"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-control">
                            <label className="label pb-2 pt-0.5">
                                <span className="label-text text-[11px] font-extrabold uppercase tracking-widest text-neutral-content/90">Password</span>
                            </label>
                            <input 
                                type="password" 
                                className="input input-bordered focus:border-primary transition-colors"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="btn btn-primary w-full mt-4 font-bold tracking-wide"
                            disabled={loading}
                        >
                            {loading ? <span className="loading loading-spinner"></span> : 'Secure Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
