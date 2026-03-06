import { useState, useEffect, useCallback } from 'react';
import type { ServiceAccount } from '../types';

const STORAGE_KEY = 'fitz:accounts';

function load(): ServiceAccount[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}
function save(data: ServiceAccount[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAccounts() {
    const [accounts, setAccounts] = useState<ServiceAccount[]>(load);

    useEffect(() => { save(accounts); }, [accounts]);

    const createAccount = useCallback((data: Omit<ServiceAccount, 'id' | 'createdAt'>) => {
        const a: ServiceAccount = {
            ...data,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        setAccounts(prev => [a, ...prev]);
        return a;
    }, []);

    const updateAccount = useCallback((id: string, data: Partial<Omit<ServiceAccount, 'id' | 'createdAt'>>) => {
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    }, []);

    const deleteAccount = useCallback((id: string) => {
        setAccounts(prev => prev.filter(a => a.id !== id));
    }, []);

    const deleteAccountsByProject = useCallback((projectId: string) => {
        setAccounts(prev => prev.filter(a => a.projectId !== projectId));
    }, []);

    const accountsByProject = useCallback((projectId: string) =>
        accounts.filter(a => a.projectId === projectId), [accounts]);

    const independentAccounts = accounts.filter(a => !a.projectId);

    return { accounts, createAccount, updateAccount, deleteAccount, deleteAccountsByProject, accountsByProject, independentAccounts };
}
