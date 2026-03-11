import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    FolderKanban,
    KeyRound,
    Server,
    Settings,
    Zap,
    AppWindow,
    ShieldCheck,
    Users,
    LogOut
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/accounts', label: 'Accounts', icon: KeyRound },
    { to: '/servers', label: 'Servers', icon: Server },
    { to: '/services', label: 'Services', icon: AppWindow },
    { to: '/security', label: 'Security', icon: ShieldCheck },
    { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
        <aside className="menu bg-base-200 text-base-content min-h-full w-64 p-4 border-r border-white/5 flex flex-col gap-4">
            {/* Brand */}
            <div className="flex items-center gap-3 px-2 py-2 border-b border-white/10 mx-2 pb-6">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                    <Zap size={20} className="text-white" />
                </div>
                <div>
                    <div className="font-bold text-lg leading-none text-white tracking-wide">PRISM</div>
                    <div className="text-[10px] text-primary font-bold tracking-[0.2em] uppercase mt-1">
                        Infra Manager
                    </div>
                </div>
            </div>

            {/* Nav */}
            <ul className="menu w-full gap-1 flex-1">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            end={end}
                            className={({ isActive }) => twMerge(
                                "flex items-center gap-3 py-3 px-4 transition-all duration-200 rounded-xl",
                                isActive 
                                    ? "bg-primary text-primary-content active shadow-lg shadow-primary/20 font-bold" 
                                    : "text-neutral-content hover:bg-base-300 hover:text-base-content"
                            )}
                            onClick={() => {
                                // Close drawer on mobile click
                                const drawer = document.getElementById('app-drawer') as HTMLInputElement;
                                if (drawer && window.innerWidth < 1024) drawer.checked = false;
                            }}
                        >
                            <Icon size={18} />
                            {label}
                        </NavLink>
                    </li>
                ))}
                
                {user?.role === 'admin' && (
                    <li key="/users">
                        <NavLink
                            to="/users"
                            className={({ isActive }) => twMerge(
                                "flex items-center gap-3 py-3 px-4 transition-all duration-200 rounded-xl",
                                isActive 
                                    ? "bg-primary text-primary-content active shadow-lg shadow-primary/20 font-bold" 
                                    : "text-neutral-content hover:bg-base-300 hover:text-base-content"
                            )}
                            onClick={() => {
                                const drawer = document.getElementById('app-drawer') as HTMLInputElement;
                                if (drawer && window.innerWidth < 1024) drawer.checked = false;
                            }}
                        >
                            <Users size={18} />
                            Users
                        </NavLink>
                    </li>
                )}
            </ul>

            {/* Footer */}
            <div className="mt-auto px-2 pb-4 space-y-4">
                <button 
                    onClick={() => {
                        logout();
                        navigate('/login');
                    }}
                    className="flex items-center gap-3 w-full py-3 px-4 text-error hover:bg-error/10 transition-colors rounded-xl font-bold"
                >
                    <LogOut size={18} />
                    Logout
                </button>
                <div className="opacity-40 text-xs font-mono uppercase tracking-widest text-center py-4 border-t border-white/10">
                    v0.1.0-alpha
                </div>
            </div>
        </aside>
    );
}

