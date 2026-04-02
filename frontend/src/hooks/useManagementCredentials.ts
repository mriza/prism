import { useState, useCallback } from 'react';
import { log } from '../utils/log';
import { message } from 'antd';
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
        try {
            const res = await fetch(`${apiBase}/api/management-credentials?serviceId=${serviceId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setCredentials(data || []);
            }
        } catch (err) {
            log.error('Failed to fetch management credentials', err); message.error('Failed to fetch management credentials');
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    const createCredential = useCallback(async (data: Partial<ManagementCredential>) => {
        if (!token) return null;
        try {
            const res = await fetch(`${apiBase}/api/management-credentials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const newCredential = await res.json();
                setCredentials(prev => [...prev, newCredential]);
                return newCredential;
            } else {
                const error = await res.text();
                throw new Error(error);
            }
        } catch (err) {
            log.error('Failed to create management credential', err); message.error('Failed to create management credential');
            throw err;
        }
    }, [token, apiBase]);

    const updateCredential = useCallback(async (id: string, data: Partial<ManagementCredential>) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/management-credentials/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updatedCredential = await res.json();
                setCredentials(prev => prev.map(c => c.id === id ? { ...c, ...updatedCredential } : c));
                return true;
            } else {
                const error = await res.text();
                throw new Error(error);
            }
        } catch (err) {
            log.error('Failed to update management credential', err); message.error('Failed to update management credential');
            throw err;
        }
    }, [token, apiBase]);

    const deleteCredential = useCallback(async (id: string) => {
        if (!token) return false;
        try {
            const res = await fetch(`${apiBase}/api/management-credentials/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setCredentials(prev => prev.filter(c => c.id !== id));
                return true;
            }
        } catch (err) {
            log.error('Failed to delete management credential', err); message.error('Failed to delete management credential');
        }
        return false;
    }, [token, apiBase]);

    const verifyCredential = useCallback(async (id: string, agentId: string, serviceName: string) => {
        if (!token) return false;
        try {
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
            if (res.ok) {
                // Update verified status locally
                await res.json();
                setCredentials(prev => prev.map(c => c.id === id ? { ...c, status: 'active', lastVerifiedAt: new Date().toISOString() } : c));
                return true;
            }
        } catch (err) {
            log.error('Failed to verify management credential', err); message.error('Failed to verify management credential');
        }
        return false;
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
