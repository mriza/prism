import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Agent } from '../types';
import { useAppConfig } from './AppConfigContext';
import { useAuth } from './AuthContext';
import { useWebSocketAgents } from '../hooks/useWebSocketAgents';

interface AgentsContextType {
    agents: Agent[];
    loading: boolean;
    error: string | null;
    refreshAgents: () => Promise<void>;
    wsConnected: boolean;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: ReactNode }) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { config } = useAppConfig();
    const { token, isAuthenticated } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchAgents = useCallback(async () => {
        if (!isAuthenticated || !token) return;

        try {
            const res = await fetch(`${apiBase}/api/agents`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error('Agent API error');
            const data = await res.json();
            const newData = data || [];

            setAgents((prev: Agent[]) => {
                if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
                return newData;
            });
            setError(null);
        } catch (err) {
            setError('Cannot connect to Hub (port 65432)');
        } finally {
            setLoading(false);
        }
    }, [apiBase, token, isAuthenticated]);

    // Handle real-time agent updates via WebSocket
    const handleAgentUpdate = useCallback((update: { type: string, payload: any }) => {
        console.log('Agent update received:', update);
        
        setAgents(prev => {
            switch (update.type) {
                case 'agent_connected':
                    // Add new agent or update existing
                    const exists = prev.find(a => a.id === update.payload.id);
                    if (exists) {
                        return prev.map(a => a.id === update.payload.id ? { ...a, ...update.payload, status: 'online' } : a);
                    }
                    return [...prev, { ...update.payload, status: 'online' }];
                    
                case 'agent_disconnected':
                    // Mark agent as offline
                    return prev.map(a => 
                        a.id === update.payload.id || a.hostname === update.payload.hostname 
                            ? { ...a, status: 'offline' } 
                            : a
                    );
                    
                case 'agent_updated':
                    // Update agent info
                    return prev.map(a => a.id === update.payload.id ? { ...a, ...update.payload } : a);

                case 'agent_approved':
                    // Update agent name/description/status after admin approves
                    return prev.map(a =>
                        a.id === update.payload.id
                            ? { ...a, name: update.payload.name, description: update.payload.description, status: 'approved' }
                            : a
                    );

                case 'agent_deleted':
                    // Remove deleted agent from list immediately
                    return prev.filter(a => a.id !== update.payload.id);

                default:
                    return prev;
            }
        });
    }, []);

    // Connect to WebSocket for real-time updates
    const { connected: wsConnected } = useWebSocketAgents(handleAgentUpdate);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAgents();
            // Polling as fallback, but WebSocket will provide real-time updates
            const interval = setInterval(fetchAgents, config.uiRefreshRate);
            return () => clearInterval(interval);
        }
    }, [fetchAgents, config.uiRefreshRate, isAuthenticated]);

    return (
        <AgentsContext.Provider value={{ agents, loading, error, refreshAgents: fetchAgents, wsConnected }}>
            {children}
        </AgentsContext.Provider>
    );
}

export function useAgentsContext() {
    const context = useContext(AgentsContext);
    if (context === undefined) {
        throw new Error('useAgentsContext must be used within an AgentsProvider');
    }
    return context;
}
