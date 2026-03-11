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
            const res = await fetch(`${apiBase}/api/agents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
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

    return { agents, loading, error, approveAgent, deleteAgent, refreshAgents: fetchAgents };
}
