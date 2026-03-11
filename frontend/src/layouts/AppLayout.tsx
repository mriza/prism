import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAgents } from '../hooks/useAgents';
import { clsx } from 'clsx';

export function AppLayout() {
    const { agents, error } = useAgents();

    return (
        <div className="drawer lg:drawer-open bg-base-100 min-h-screen">
            <input id="app-drawer" type="checkbox" className="drawer-toggle" />
            
            {/* Main Content Area */}
            <div className="drawer-content flex flex-col min-h-screen overflow-hidden">
                {/* Navbar */}
                <header className="navbar bg-base-200/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-10 min-h-[52px]">
                    <div className="flex-none lg:hidden">
                        <label htmlFor="app-drawer" aria-label="open sidebar" className="btn btn-square btn-ghost btn-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </label>
                    </div>
                    <div className="flex-1">
                        <span className="lg:hidden font-bold ml-2">PRISM</span>
                    </div>
                    
                    {/* Agent status badge */}
                    <div className="flex-none gap-2 px-2">
                        <div className={clsx(
                            "badge gap-2 font-bold p-3 uppercase tracking-wider text-[10px]",
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

