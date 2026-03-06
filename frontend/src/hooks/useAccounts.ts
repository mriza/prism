import { useState, useEffect, useCallback } from 'react';
import type { ServiceAccount } from '../types';

const getHubUrl = () => import.meta.env.VITE_HUB_URL || 'http://localhost:65432';

export function useAccounts() {
    const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAccounts = useCallback(async () => {
        try {
            const res = await fetch(`${getHubUrl()}/api/accounts`);
            if (res.ok) {
                const data = await res.json();
                setAccounts(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch accounts', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const createAccount = useCallback(async (data: Omit<ServiceAccount, 'id' | 'createdAt'>) => {
        try {
            const res = await fetch(`${getHubUrl()}/api/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
    }, []);

    const updateAccount = useCallback(async (id: string, data: Partial<Omit<ServiceAccount, 'id' | 'createdAt'>>) => {
        try {
            const res = await fetch(`${getHubUrl()}/api/accounts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updatedAccount = await res.json();
                setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updatedAccount } : a));
            }
        } catch (err) {
            console.error('Failed to update account', err);
        }
    }, []);

    const deleteAccount = useCallback(async (id: string) => {
        try {
            const res = await fetch(`${getHubUrl()}/api/accounts/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setAccounts(prev => prev.filter(a => a.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete account', err);
        }
    }, []);

    const deleteAccountsByProject = useCallback(async (projectId: string) => {
        // Find them and delete individually since the API doesn't have a bulk delete right now
        // It relies on DB cascade delete for projects, but if called manually:
        const toDelete = accounts.filter(a => a.projectId === projectId);
        for (const account of toDelete) {
            await deleteAccount(account.id);
        }
    }, [accounts, deleteAccount]);

    const accountsByProject = useCallback((projectId: string) =>
        accounts.filter(a => a.projectId === projectId), [accounts]);

    const independentAccounts = accounts.filter(a => !a.projectId);

    return { accounts, loading, createAccount, updateAccount, deleteAccount, deleteAccountsByProject, accountsByProject, independentAccounts };
}
