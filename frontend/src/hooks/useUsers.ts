import { useState, useCallback, useEffect } from 'react';
import { handleError } from '../utils/log';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();

    const fetchUsers = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        const data = await handleError(
            async () => {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch users'
        );
        if (data) {
            setUsers(data);
        }
        setLoading(false);
    }, [token]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const createUser = async (data: Partial<User>) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to create user');
                await fetchUsers();
                return true;
            },
            'Failed to create user',
            { showToast: false }
        );
        return success || false;
    };

    const updateUser = async (id: string, data: Partial<User>) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to update user');
                await fetchUsers();
                return true;
            },
            'Failed to update user',
            { showToast: false }
        );
        return success || false;
    };

    const deleteUser = async (id: string) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to delete user');
                setUsers(prev => prev.filter(u => u.id !== id));
                return true;
            },
            'Failed to delete user',
            { showToast: false }
        );
        return success || false;
    };

    return {
        users,
        loading,
        fetchUsers,
        createUser,
        updateUser,
        deleteUser
    };
}
