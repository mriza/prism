import { useState, useCallback, useEffect } from 'react';
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
        try {
            const params = new URLSearchParams();
            if (resourceType) {
                params.append('resourceType', resourceType);
            }
            const res = await fetch(`${apiBase}/api/permissions?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setPermissions(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const createPermission = useCallback(async (data: Omit<Permission, 'id' | 'createdAt'>) => {
        if (!token) return null;
        try {
            const res = await fetch(`${apiBase}/api/permissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const newPermission = await res.json();
                setPermissions(prev => [...prev, newPermission]);
                return newPermission;
            } else {
                const error = await res.text();
                throw new Error(error);
            }
        } catch (err) {
            console.error('Failed to create permission:', err);
            throw err;
        }
    }, [token, apiBase]);

    const updatePermission = useCallback(async (id: string, data: Partial<Permission>) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/permissions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updatedPermission = await res.json();
                setPermissions(prev => prev.map(p => p.id === id ? { ...p, ...updatedPermission } : p));
                return true;
            } else {
                const error = await res.text();
                throw new Error(error);
            }
        } catch (err) {
            console.error('Failed to update permission:', err);
            throw err;
        }
    }, [token, apiBase]);

    const deletePermission = useCallback(async (id: string) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/permissions/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setPermissions(prev => prev.filter(p => p.id !== id));
                return true;
            }
        } catch (err) {
            console.error('Failed to delete permission:', err);
        }
        return false;
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
