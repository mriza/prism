import { useState, useCallback, useEffect } from 'react';
import { handleError } from '../utils/log';
import { useAuth } from '../contexts/AuthContext';

export interface Permission {
    id: string;
    name: string;
    description: string;
    resourceType: string;
    action: string;
    createdAt: string;
}

export function usePermissions() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchPermissions = useCallback(async (resourceType?: string) => {
        if (!token) return;
        setLoading(true);
        const data = await handleError(
            async () => {
                const params = new URLSearchParams();
                if (resourceType) {
                    params.append('resourceType', resourceType);
                }
                const res = await fetch(`${apiBase}/api/permissions?${params.toString()}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch permissions'
        );
        if (data) {
            setPermissions(data);
        }
        setLoading(false);
    }, [token, apiBase]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const createPermission = useCallback(async (data: Omit<Permission, 'id' | 'createdAt'>) => {
        if (!token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/permissions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) {
                    const error = await res.text();
                    throw new Error(error);
                }
                const newPermission = await res.json();
                setPermissions(prev => [...prev, newPermission]);
                return newPermission;
            },
            'Failed to create permission'
        );
    }, [token, apiBase]);

    const updatePermission = useCallback(async (id: string, data: Partial<Permission>) => {
        if (!token) return false;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/permissions/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) {
                    const error = await res.text();
                    throw new Error(error);
                }
                const updatedPermission = await res.json();
                setPermissions(prev => prev.map(p => p.id === id ? { ...p, ...updatedPermission } : p));
                return true;
            },
            'Failed to update permission'
        );
    }, [token, apiBase]);

    const deletePermission = useCallback(async (id: string) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/permissions/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to delete');
                setPermissions(prev => prev.filter(p => p.id !== id));
                return true;
            },
            'Failed to delete permission'
        );
        return success || false;
    }, [token, apiBase]);

    return {
        permissions,
        loading,
        fetchPermissions,
        createPermission,
        updatePermission,
        deletePermission
    };
}
