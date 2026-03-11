import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

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
            } else {
                throw new Error('No token received');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to login');
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
                        <p className="text-neutral-content mt-1">Universal Fleet Control</p>
                    </div>

                    {error && (
                        <div className="alert alert-error shadow-sm mb-4">
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Username</span>
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
                            <label className="label">
                                <span className="label-text font-medium">Password</span>
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
