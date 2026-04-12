import { useState, useCallback } from 'react';
import { handleError } from '../utils/log';
import { useAuth } from '../contexts/AuthContext';

export interface ManagementCredential {
    id: string;
    serviceId: string;
    credentialType: 'root' | 'admin' | 'default';
    usernameEncrypted?: string;
    passwordEncrypted?: string;
    connectionParamsEncrypted?: string;
    usernameMasked: string;
    status: 'active' | 'inactive' | 'error';
    lastVerifiedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export function useManagementCredentials() {
    const [credentials, setCredentials] = useState<ManagementCredential[]>([]);
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchCredentials = useCallback(async (serviceId: string) => {
        if (!token) return;
        setLoading(true);
        const data = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/management-credentials?serviceId=${serviceId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch management credentials'
        );
        if (data) {
            setCredentials(data);
        }
        setLoading(false);
    }, [token, apiBase]);

    const createCredential = useCallback(async (data: Partial<ManagementCredential>) => {
        if (!token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/management-credentials`, {
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
                const newCredential = await res.json();
                setCredentials(prev => [...prev, newCredential]);
                return newCredential;
            },
            'Failed to create management credential'
        );
    }, [token, apiBase]);

    const updateCredential = useCallback(async (id: string, data: Partial<ManagementCredential>) => {
        if (!token) return false;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/management-credentials/${id}`, {
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
                const updatedCredential = await res.json();
                setCredentials(prev => prev.map(c => c.id === id ? { ...c, ...updatedCredential } : c));
                return true;
            },
            'Failed to update management credential'
        );
    }, [token, apiBase]);

    const deleteCredential = useCallback(async (id: string) => {
        if (!token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/management-credentials/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to delete');
                setCredentials(prev => prev.filter(c => c.id !== id));
                return true;
            },
            'Failed to delete management credential'
        );
        return success || false;
    }, [token, apiBase]);

    const verifyCredential = useCallback(async (id: string, agentId: string, serviceName: string) => {
        if (!token) return false;
        return await handleError(
            async () => {
                // First run verify command via agent to actually test connection
                const controlRes = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        agent_id: agentId,
                        service: serviceName,
                        action: 'verify_credential',
                        options: {
                            credential_id: id
                        }
                    })
                });

                if (!controlRes.ok) {
                    const error = await controlRes.text();
                    throw new Error(`Agent verification failed: ${error}`);
                }

                const res = await fetch(`${apiBase}/api/management-credentials/${id}/verify`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to verify');
                // Update verified status locally
                await res.json();
                setCredentials(prev => prev.map(c => c.id === id ? { ...c, status: 'active', lastVerifiedAt: new Date().toISOString() } : c));
                return true;
            },
            'Failed to verify management credential'
        );
    }, [token, apiBase]);

    return {
        credentials,
        loading,
        fetchCredentials,
        createCredential,
        updateCredential,
        deleteCredential,
        verifyCredential
    };
}
