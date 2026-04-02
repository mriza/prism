import { useState, useCallback, useEffect } from 'react';
import { log } from '../utils/log';
import { message } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

export function useUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();

    const fetchUsers = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data || []);
            }
        } catch (err) {
            log.error('Failed to fetch users', err);
            message.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const createUser = async (data: Partial<User>) => {
        if (!token) return false;
        try {
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
        } catch (err) {
            log.error('Failed to create user', err);
            message.error('Failed to create user');
            return false;
        }
    };

    const updateUser = async (id: string, data: Partial<User>) => {
        if (!token) return false;
        try {
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
        } catch (err) {
            log.error('Failed to update user', err);
            message.error('Failed to update user');
            return false;
        }
    };

    const deleteUser = async (id: string) => {
        if (!token) return false;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error('Failed to delete user');
            setUsers(prev => prev.filter(u => u.id !== id));
            return true;
        } catch (err) {
            log.error('Failed to delete user', err);
            message.error('Failed to delete user');
            return false;
        }
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
