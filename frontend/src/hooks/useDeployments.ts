import { useState, useEffect, useCallback } from 'react';
import { handleError } from '../utils/log';
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
        setLoading(true);
        const data = await handleError(
            async () => {
                const params = new URLSearchParams();
                if (filters?.projectId) params.append('projectId', filters.projectId);
                if (filters?.serverId) params.append('serverId', filters.serverId);
                if (filters?.status) params.append('status', filters.status);
                if (filters?.search) params.append('search', filters.search);

                const url = `${apiBase}/api/deployments${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch deployments'
        );
        if (data) {
            setDeployments(data);
        }
        setLoading(false);
    }, [token, apiBase]);

    useEffect(() => {
        fetchDeployments();
    }, [fetchDeployments]);

    const createDeployment = useCallback(async (data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!token) return null;
        const result = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/deployments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to create');
                const newDeploy = await res.json();
                setDeployments(prev => [newDeploy, ...prev]);
                return newDeploy;
            },
            'Failed to create deployment'
        );
        return result || null;
    }, [token, apiBase]);

    const updateDeployment = useCallback(async (id: string, data: Partial<Deployment>) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/deployments/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to update');
                const updated = await res.json();
                setDeployments(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
                return true;
            },
            'Failed to update deployment'
        );
        return success || false;
    }, [token, apiBase]);

    const deleteDeployment = useCallback(async (id: string) => {
        if (!token) return;
        await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/deployments/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to delete');
                setDeployments(prev => prev.filter(d => d.id !== id));
            },
            'Failed to delete deployment'
        );
    }, [token, apiBase]);

    const deploymentsByProject = useCallback((projectId: string) =>
        deployments.filter(d => d.projectId === projectId), [deployments]);

    const triggerDeploy = useCallback(async (id: string) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/deployments/${id}/deploy`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to deploy');
                const updated = await res.json();
                setDeployments(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
                return true;
            },
            'Failed to trigger deployment',
            { showToast: false }
        );
        return success || false;
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
