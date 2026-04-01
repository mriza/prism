import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface Deployment {
    id: string;
    projectId: string;
    serverId: string;
    name: string;
    description?: string;
    sourceUrl: string;
    sourceToken?: string;
    runtime: string;
    runtimeVersion?: string;
    processManager: string;
    startCommand: string;
    envVars?: Record<string, string>;
    domainName?: string;
    internalPort?: number;
    proxyType?: string;
    status: string;
    lastDeployedRevision?: string;
    lastDeployedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export function useDeployments() {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();
    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchDeployments = useCallback(async (filters?: {
        projectId?: string;
        serverId?: string;
        status?: string;
        search?: string;
    }) => {
        if (!token) return;
        try {
            const params = new URLSearchParams();
            if (filters?.projectId) params.append('projectId', filters.projectId);
            if (filters?.serverId) params.append('serverId', filters.serverId);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.search) params.append('search', filters.search);

            const url = `${apiBase}/api/deployments${params.toString() ? '?' + params.toString() : ''}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDeployments(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch deployments', err);
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchDeployments();
    }, [fetchDeployments]);

    const createDeployment = useCallback(async (data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!token) return null;
        try {
            const res = await fetch(`${apiBase}/api/deployments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const newDeploy = await res.json();
                setDeployments(prev => [newDeploy, ...prev]);
                return newDeploy;
            }
        } catch (err) {
            console.error('Failed to create deployment', err);
        }
        return null;
    }, [token, apiBase]);

    const updateDeployment = useCallback(async (id: string, data: Partial<Deployment>) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/deployments/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updated = await res.json();
                setDeployments(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
                return true;
            }
        } catch (err) {
            console.error('Failed to update deployment', err);
        }
        return false;
    }, [token, apiBase]);

    const deleteDeployment = useCallback(async (id: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${apiBase}/api/deployments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setDeployments(prev => prev.filter(d => d.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete deployment', err);
        }
    }, [token, apiBase]);

    const deploymentsByProject = useCallback((projectId: string) =>
        deployments.filter(d => d.projectId === projectId), [deployments]);

    const triggerDeploy = useCallback(async (id: string) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/deployments/${id}/deploy`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const updated = await res.json();
                setDeployments(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
                return true;
            }
        } catch (err) {
            console.error('Failed to trigger deployment', err);
        }
        return false;
    }, [token, apiBase]);

    return {
        deployments,
        loading,
        fetchDeployments,
        createDeployment,
        updateDeployment,
        deleteDeployment,
        deploymentsByProject,
        triggerDeploy,
    };
}
