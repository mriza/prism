import { useState, useEffect, useCallback } from 'react';
import type { ServiceAccount } from '../types';
import { useAuth } from '../contexts/AuthContext';


export function useAccounts() {
    const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchAccounts = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${apiBase}/api/accounts`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setAccounts(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch accounts', err);
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

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
            console.error('Failed to create account', err);
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
            console.error('Failed to update account', err);
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
            console.error('Failed to delete account', err);
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
            console.error('Failed to provision account', err);
            return false;
        }
    }, [token, apiBase, accounts]);

    const accountsByProject = useCallback((projectId: string) =>
        accounts.filter(a => a.projectId === projectId), [accounts]);

    const independentAccounts = accounts.filter(a => !a.projectId);

    return { accounts, loading, createAccount, updateAccount, deleteAccount, deleteAccountsByProject, provisionAccount, accountsByProject, independentAccounts };
}
