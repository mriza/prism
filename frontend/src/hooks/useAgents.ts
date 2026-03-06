import { useState, useEffect } from 'react';
import type { Agent } from '../types';

export function useAgents() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetch_ = async () => {
            try {
                const res = await fetch('http://localhost:65432/api/agents');
                if (!res.ok) throw new Error('Agent API error');
                const data = await res.json();
                setAgents(data || []);
                setError(null);
            } catch {
                setError('Cannot connect to Hub (port 65432)');
            } finally {
                setLoading(false);
            }
        };
        fetch_();
        const interval = setInterval(fetch_, 5000);
        return () => clearInterval(interval);
    }, []);

    return { agents, loading, error };
}
