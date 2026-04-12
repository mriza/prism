import { useState, useEffect, useCallback } from 'react';
import { handleError } from '../utils/log';
import type { ServiceAccount } from '../types';
import { useAuth } from '../contexts/AuthContext';

export interface AccountCrossReference {
    id: string;
    username: string;
    name: string;
    type: string;
    category: string;
    status: string;
    createdAt: string;
    projectName?: string;
    serverName?: string;
    hostname?: string;
    ipAddress?: string;
    serviceName?: string;
    serviceType?: string;
}

export function useAccounts() {
    const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
    const [crossReference, setCrossReference] = useState<AccountCrossReference[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchAccounts = useCallback(async (filters?: {
        projectId?: string;
        serverId?: string;
        serviceId?: string;
        category?: string;
        type?: string;
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
                if (filters?.serviceId) params.append('serviceId', filters.serviceId);
                if (filters?.category) params.append('category', filters.category);
                if (filters?.type) params.append('type', filters.type);
                if (filters?.status) params.append('status', filters.status);
                if (filters?.search) params.append('search', filters.search);

                const url = `${apiBase}/api/accounts${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch accounts'
        );
        if (data) {
            setAccounts(data);
        }
        setLoading(false);
    }, [token, apiBase]);

    const fetchCrossReference = useCallback(async (filters?: {
        projectId?: string;
        serverId?: string;
        category?: string;
        search?: string;
    }) => {
        if (!token) return;
        const data = await handleError(
            async () => {
                const params = new URLSearchParams();
                if (filters?.projectId) params.append('projectId', filters.projectId);
                if (filters?.serverId) params.append('serverId', filters.serverId);
                if (filters?.category) params.append('category', filters.category);
                if (filters?.search) params.append('search', filters.search);

                const url = `${apiBase}/api/accounts/cross-reference${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch cross-reference'
        );
        if (data) {
            setCrossReference(data);
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchAccounts();
        fetchCrossReference();
    }, [fetchAccounts, fetchCrossReference]);

    const createAccount = useCallback(async (data: Omit<ServiceAccount, 'id' | 'createdAt'>) => {
        if (!token) return null;
        const result = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/accounts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to create');
                const newAccount = await res.json();
                setAccounts(prev => [newAccount, ...prev]);
                return newAccount;
            },
            'Failed to create account'
        );
        return result || null;
    }, [token, apiBase]);

    const updateAccount = useCallback(async (id: string, data: Partial<Omit<ServiceAccount, 'id' | 'createdAt'>>) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/accounts/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to update');
                const updatedAccount = await res.json();
                setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updatedAccount } : a));
                return true;
            },
            'Failed to update account'
        );
        return success || false;
    }, [token, apiBase]);

    const deleteAccount = useCallback(async (id: string) => {
        if (!token) return;
        await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/accounts/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to delete');
                setAccounts(prev => prev.filter(a => a.id !== id));
            },
            'Failed to delete account'
        );
    }, [token, apiBase]);

    const deleteAccountsByProject = useCallback(async (projectId: string) => {
        // Find them and delete individually since the API doesn't have a bulk delete right now
        // It relies on DB cascade delete for projects, but if called manually:
        const toDelete = accounts.filter(a => a.projectId === projectId);
        for (const account of toDelete) {
            await deleteAccount(account.id);
        }
    }, [accounts, deleteAccount, token, apiBase]);

    const provisionAccount = useCallback(async (agentId: string, action: string, options: Record<string, unknown>) => {
        if (!token) return false;
        const service = action.startsWith('db_') ? (accounts.find(a => a.agentId === agentId)?.type || 'mongodb') : 'unknown';

        const res = await fetch(`${apiBase}/api/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                agent_id: agentId,
                service: service,
                action,
                options
            })
        });
        const success = await handleError(
            async () => res.ok,
            'Failed to provision account'
        );
        return success || false;
    }, [token, apiBase, accounts]);

    const bulkUpdateProject = useCallback(async (accountIds: string[], projectId: string | null) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/accounts/bulk-project`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ accountIds, projectId })
                });
                if (!res.ok) throw new Error('Failed to update');
                fetchAccounts();
                fetchCrossReference();
                return true;
            },
            'Failed to bulk update project',
            { showToast: false }
        );
        return success || false;
    }, [token, apiBase, fetchAccounts, fetchCrossReference]);

    const bulkDisable = useCallback(async (accountIds: string[]) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/accounts/bulk-disable`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ accountIds })
                });
                if (!res.ok) throw new Error('Failed to disable');
                fetchAccounts();
                fetchCrossReference();
                return true;
            },
            'Failed to bulk disable accounts',
            { showToast: false }
        );
        return success || false;
    }, [token, apiBase, fetchAccounts, fetchCrossReference]);

    const accountsByProject = useCallback((projectId: string) =>
        accounts.filter(a => a.category === 'project' && a.projectId === projectId), [accounts]);

    // Project accounts not yet assigned to any project
    const independentAccounts = accounts.filter(a => a.category === 'independent' || (a.category === 'project' && !a.projectId));

    // Management/root accounts used by PRISM to connect to and operate a service
    const managementAccounts = accounts.filter(a => a.category === 'management');

    const managementAccountsByService = useCallback((serverId: string, type: import('../types').ServiceType) =>
        accounts.filter(a => a.category === 'management' && a.serverId === serverId && a.type === type),
    [accounts]);

    return { 
        accounts, 
        crossReference,
        loading, 
        createAccount, 
        updateAccount, 
        deleteAccount, 
        deleteAccountsByProject, 
        provisionAccount, 
        accountsByProject, 
        independentAccounts, 
        managementAccounts, 
        managementAccountsByService,
        fetchAccounts,
        fetchCrossReference,
        bulkUpdateProject,
        bulkDisable
    };
}
