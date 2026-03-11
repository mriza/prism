import { useState, useEffect, useCallback } from 'react';
import type { Agent } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useAgents() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/agents`, {});
            if (!res.ok) throw new Error('Agent API error');
            const data = await res.json();
            setAgents(data || []);
            setError(null);
        } catch {
            setError('Cannot connect to Hub (port 65432)');
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 5000); // Poll every 5 seconds for approvals
        return () => clearInterval(interval);
    }, [fetchAgents]);

    const approveAgent = async (id: string, name: string, description: string) => {
        try {
            const res = await fetch(`${apiBase}/api/agents/${id}/approve`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });
            if (res.ok) {
                await fetchAgents();
                return true;
            }
        } catch (e) {
            console.error('Failed to approve agent', e);
        }
        return false;
    };

    const deleteAgent = async (id: string) => {
        try {
            const res = await fetch(`${apiBase}/api/agents/${id}`, { 
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchAgents();
                return true;
            }
        } catch (e) {
            console.error('Failed to delete agent', e);
        }
        return false;
    };

    const controlService = async (agentId: string, service: string, action: string) => {
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    agent_id: agentId,
                    service,
                    action
                })
            });
            if (res.ok) {
                await fetchAgents(); // Refresh to get updated status
                return true;
            }
        } catch (e) {
            console.error('Failed to control service', e);
        }
        return false;
    };

    const getServiceConfig = async (agentId: string, service: string) => {
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agentId, service, action: 'service_get_config' })
            });
            if (res.ok) {
                const data = await res.json();
                return data.output; // The response from agent is {status, output, error}
            }
        } catch (e) {
            console.error('Failed to get service config', e);
        }
        return null;
    };

    const updateServiceConfig = async (agentId: string, service: string, content: string) => {
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    agent_id: agentId, 
                    service, 
                    action: 'service_update_config',
                    options: { content }
                })
            });
            return res.ok;
        } catch (e) {
            console.error('Failed to update service config', e);
        }
        return false;
    };

    return { 
        agents, 
        loading, 
        error, 
        approveAgent, 
        deleteAgent, 
        controlService,
        getServiceConfig,
        updateServiceConfig,
        refreshAgents: fetchAgents 
    };
}
