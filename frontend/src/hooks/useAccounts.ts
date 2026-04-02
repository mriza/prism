import { useState, useEffect, useCallback } from 'react';
import { log } from '../utils/log';
import { message } from 'antd';
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
        try {
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
            if (res.ok) {
                const data = await res.json();
                setAccounts(data || []);
            }
        } catch (err) {
            log.error('Failed to fetch accounts', err); message.error('Failed to fetch accounts');
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    const fetchCrossReference = useCallback(async (filters?: {
        projectId?: string;
        serverId?: string;
        category?: string;
        search?: string;
    }) => {
        if (!token) return;
        try {
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
            if (res.ok) {
                const data = await res.json();
                setCrossReference(data || []);
            }
        } catch (err) {
            log.error('Failed to fetch cross-reference', err); message.error('Failed to fetch cross-reference');
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchAccounts();
        fetchCrossReference();
    }, [fetchAccounts, fetchCrossReference]);

    const createAccount = useCallback(async (data: Omit<ServiceAccount, 'id' | 'createdAt'>) => {
        if (!token) return null;
        try {
            const res = await fetch(`${apiBase}/api/accounts`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const newAccount = await res.json();
                setAccounts(prev => [newAccount, ...prev]);
                return newAccount;
            }
        } catch (err) {
            log.error('Failed to create account', err); message.error('Failed to create account');
        }
        return null; // or throw
    }, [token, apiBase]);

    const updateAccount = useCallback(async (id: string, data: Partial<Omit<ServiceAccount, 'id' | 'createdAt'>>) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/accounts/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updatedAccount = await res.json();
                setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updatedAccount } : a));
                return true;
            }
        } catch (err) {
            log.error('Failed to update account', err); message.error('Failed to update account');
        }
        return false;
    }, [token, apiBase]);

    const deleteAccount = useCallback(async (id: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${apiBase}/api/accounts/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setAccounts(prev => prev.filter(a => a.id !== id));
            }
        } catch (err) {
            log.error('Failed to delete account', err); message.error('Failed to delete account');
        }
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
        try {
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
            return res.ok;
        } catch (err) {
            log.error('Failed to provision account', err); message.error('Failed to provision account');
            return false;
        }
    }, [token, apiBase, accounts]);

    const bulkUpdateProject = useCallback(async (accountIds: string[], projectId: string | null) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/accounts/bulk-project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ accountIds, projectId })
            });
            if (res.ok) {
                fetchAccounts();
                fetchCrossReference();
                return true;
            }
        } catch (err) {
            log.error('Failed to bulk update project', err); message.error('Failed to bulk update project');
        }
        return false;
    }, [token, apiBase, fetchAccounts, fetchCrossReference]);

    const bulkDisable = useCallback(async (accountIds: string[]) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/accounts/bulk-disable`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ accountIds })
            });
            if (res.ok) {
                fetchAccounts();
                fetchCrossReference();
                return true;
            }
        } catch (err) {
            log.error('Failed to bulk disable accounts', err); message.error('Failed to bulk disable accounts');
        }
        return false;
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
