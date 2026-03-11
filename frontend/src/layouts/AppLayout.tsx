import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAgents } from '../hooks/useAgents';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { clsx } from 'clsx';
import { LogOut, User, ChevronDown, Sun, Moon } from 'lucide-react';

export function AppLayout() {
    const { agents, error } = useAgents();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="drawer lg:drawer-open bg-base-100 min-h-screen">
            <input id="app-drawer" type="checkbox" className="drawer-toggle" />
            
            {/* Main Content Area */}
            <div className="drawer-content flex flex-col min-h-screen overflow-hidden">
                {/* Navbar */}
                <header className="navbar bg-base-200/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-10 min-h-[52px] px-4">
                    <div className="flex-none lg:hidden">
                        <label htmlFor="app-drawer" aria-label="open sidebar" className="btn btn-square btn-ghost btn-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </label>
                    </div>
                    <div className="flex-1">
                        <span className="lg:hidden font-bold ml-2">PRISM</span>
                    </div>
                    
                    <div className="flex-none gap-4">
                        {/* Agent status badge */}
                        <div className={clsx(
                            "badge gap-2 font-bold p-3 uppercase tracking-wider text-[10px] hidden sm:flex",
                            error 
                                ? "badge-error badge-outline" 
                                : "badge-success badge-outline"
                        )}>
                            <span className={clsx(
                                "w-1.5 h-1.5 rounded-full",
                                error ? "bg-error" : "bg-success animate-pulse-dot"
                            )} />
                            {error ? "Hub offline" : `${agents.length} agent${agents.length !== 1 ? 's' : ''} online`}
                        </div>

                        {/* Theme Toggle */}
                        <button 
                            onClick={toggleTheme}
                            className="btn btn-ghost btn-sm btn-square rounded-xl border border-white/5 hover:bg-white/5 h-9 w-9 text-neutral-content/60 hover:text-primary transition-all"
                            title={`Switch to ${theme === 'corporate' ? 'dark' : 'light'} mode`}
                        >
                            {theme === 'corporate' ? <Moon size={18} /> : <Sun size={18} />}
                        </button>

                        {/* User Profile Dropdown */}
                        <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2 px-2 hover:bg-white/5 h-9 rounded-xl border border-white/5">
                                <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                    <User size={14} />
                                </div>
                                <div className="text-left hidden xs:block">
                                    <div className="text-[11px] font-bold leading-none">{user?.username}</div>
                                    <div className="text-[9px] opacity-40 uppercase tracking-tighter mt-0.5">{user?.role}</div>
                                </div>
                                <ChevronDown size={12} className="opacity-40" />
                            </div>
                            <ul tabIndex={0} className="dropdown-content z-30 menu p-2 shadow-2xl bg-base-200 border border-white/5 rounded-2xl w-52 mt-2">
                                <li className="menu-title px-4 py-2 text-[10px] font-bold uppercase tracking-widest opacity-40">Account Management</li>
                                <li>
                                    <button onClick={handleLogout} className="text-error flex items-center gap-3 py-3 hover:bg-error/10 transition-colors">
                                        <LogOut size={16} />
                                        <span className="font-bold">Sign Out</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-7">
                    <Outlet />
                </main>
            </div> 
            
            {/* Sidebar Drawer Side */}
            <div className="drawer-side z-20">
                <label htmlFor="app-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
                <Sidebar />
            </div>
        </div>
    );
}

