import { useCallback } from 'react';
import { useAgentsContext } from '../contexts/AgentsContext';
import { useAuth } from '../contexts/AuthContext';
import { message } from 'antd';
import { log } from '../utils/log';

export function useAgents() {
    const { agents, loading, error, refreshAgents } = useAgentsContext();
    const { token, isAuthenticated } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const approveAgent = async (id: string, name: string, description: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/agents/${id}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description })
            });
            if (res.ok) {
                await refreshAgents();
                return true;
            }
        } catch (e) {
            log.error('Failed to approve agent', e);
            message.error('Failed to approve agent');
        }
        return false;
    };

    const deleteAgent = async (id: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/agents/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                await refreshAgents();
                return true;
            }
        } catch (e) {
            log.error('Failed to delete agent', e);
            message.error('Failed to delete agent');
        }
        return false;
    };

    const controlService = async (agentId: string, service: string, action: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action
                })
            });
            if (res.ok) {
                await refreshAgents();
                return true;
            }
        } catch (e) {
            log.error('Failed to control service', e);
            message.error('Failed to control service');
        }
        return false;
    };

    const getServiceConfig = async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service, action: 'service_get_config' })
            });
            if (res.ok) {
                const data = await res.json();
                return data.output;
            }
        } catch (e) {
            log.error('Failed to get service config', e);
        }
        return null;
    };

    const updateServiceConfig = async (agentId: string, service: string, content: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action: 'service_update_config',
                    options: { content }
                })
            });
            return res.ok;
        } catch (e) {
            log.error('Failed to update service config', e);
            message.error('Failed to update service config');
        }
        return false;
    };

    const listSystemdUnits = async (agentId: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service: 'systemd', action: 'systemd_list_all' })
            });
            if (res.ok) {
                const data = await res.json();
                return data.output;
            }
        } catch (e) {
            log.error('Failed to list systemd units', e);
        }
        return null;
    };

    const registerService = async (agentId: string, name: string, type: string, serviceName: string, userScope: boolean = false) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: 'systemd',
                    action: 'service_register',
                    options: { name, type, service_name: serviceName, user_scope: userScope }
                })
            });
            if (res.ok) {
                await refreshAgents();
                return true;
            }
        } catch (e) {
            log.error('Failed to register service', e);
            message.error('Failed to register service');
        }
        return false;
    };

    const unregisterService = async (agentId: string, name: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service: 'systemd',
                    action: 'service_unregister',
                    options: { name }
                })
            });
            if (res.ok) {
                await refreshAgents();
                return true;
            }
        } catch (e) {
            log.error('Failed to unregister service', e);
            message.error('Failed to unregister service');
        }
        return false;
    };

    const listSubProcesses = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service, action: 'service_list_processes' })
            });
            if (res.ok) {
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            }
        } catch (e) {
            log.error('Failed to list sub-processes', e);
        }
        return null;
    }, [apiBase]);

    const controlSubProcess = async (agentId: string, service: string, processId: string, processAction: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action: 'service_control_process',
                    options: { process_id: processId, process_action: processAction }
                })
            });
            return res.ok;
        } catch (e) {
            log.error('Failed to control sub-process', e);
            message.error('Failed to control sub-process');
        }
        return false;
    };

    const listStorageBuckets = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service, action: 'storage_list_buckets' })
            });
            if (res.ok) {
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            }
        } catch (e) {
            log.error('Failed to list storage buckets', e);
        }
        return null;
    }, [apiBase, isAuthenticated, token]);

    const createStorageBucket = async (agentId: string, service: string, name: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action: 'storage_create_bucket',
                    options: { name }
                })
            });
            return res.ok;
        } catch (e) {
            log.error('Failed to create storage bucket', e);
            message.error('Failed to create storage bucket');
        }
        return false;
    };

    const deleteStorageBucket = async (agentId: string, service: string, name: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action: 'storage_delete_bucket',
                    options: { name }
                })
            });
            return res.ok;
        } catch (e) {
            log.error('Failed to delete storage bucket', e);
            message.error('Failed to delete storage bucket');
        }
        return false;
    };

    const listStorageUsers = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service, action: 'storage_list_users' })
            });
            if (res.ok) {
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            }
        } catch (e) {
            log.error('Failed to list storage users', e);
        }
        return null;
    }, [apiBase, isAuthenticated, token]);

    const createStorageUser = async (agentId: string, service: string, accessKey: string, secretKey: string) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action: 'storage_create_user',
                    options: { access_key: accessKey, secret_key: secretKey }
                })
            });
            if (res.ok) {
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return true;
                }
            }
        } catch (e) {
            log.error('Failed to create storage user', e);
            message.error('Failed to create storage user');
        }
        return false;
    };

    const getServiceSettings = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service, action: 'service_get_settings' })
            });
            if (res.ok) {
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            }
        } catch (e) {
            log.error('Failed to get service settings', e);
        }
        return null;
    }, [apiBase, isAuthenticated, token]);

    const updateServiceSettings = async (agentId: string, service: string, settings: Record<string, any>) => {
        if (!isAuthenticated || !token) return false;
        try {
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    service,
                    action: 'service_update_settings',
                    options: settings
                })
            });
            return res.ok;
        } catch (e) {
            log.error('Failed to update service settings', e);
            message.error('Failed to update service settings');
        }
        return false;
    };

    const importServiceResources = async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        try {
            const res = await fetch(`${apiBase}/api/control/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ agent_id: agentId, service })
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            log.error('Failed to import service resources', e);
            message.error('Failed to import service resources');
        }
        return null;
    };

    return { 
        agents, 
        loading, 
        error, 
        approveAgent, 
        deleteAgent, 
        controlService,
        getServiceConfig,
        updateServiceConfig,
        listSystemdUnits,
        registerService,
        unregisterService,
        listSubProcesses,
        controlSubProcess,
        listStorageBuckets,
        createStorageBucket,
        deleteStorageBucket,
        listStorageUsers,
        createStorageUser,
        getServiceSettings,
        updateServiceSettings,
        importServiceResources,
        refreshAgents
    };
}
