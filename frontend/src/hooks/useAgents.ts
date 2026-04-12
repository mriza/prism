import { useCallback } from 'react';
import { useAgentsContext } from '../contexts/AgentsContext';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../utils/log';

export function useAgents() {
    const { agents, loading, error, refreshAgents } = useAgentsContext();
    const { token, isAuthenticated } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const approveAgent = async (id: string, name: string, description: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/agents/${id}/approve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, description })
                });
                if (!res.ok) throw new Error('Failed to approve');
                await refreshAgents();
                return true;
            },
            'Failed to approve agent'
        );
        return success || false;
    };

    const deleteAgent = async (id: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/agents/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to delete');
                await refreshAgents();
                return true;
            },
            'Failed to delete agent'
        );
        return success || false;
    };

    const controlService = async (agentId: string, service: string, action: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to control');
                await refreshAgents();
                return true;
            },
            'Failed to control service'
        );
        return success || false;
    };

    const getServiceConfig = async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service, action: 'service_get_config' })
                });
                if (!res.ok) throw new Error('Failed to get config');
                const data = await res.json();
                return data.output;
            },
            'Failed to get service config',
            { showToast: false }
        );
    };

    const updateServiceConfig = async (agentId: string, service: string, content: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to update');
                return true;
            },
            'Failed to update service config'
        );
        return success || false;
    };

    const listSystemdUnits = async (agentId: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service: 'systemd', action: 'systemd_list_all' })
                });
                if (!res.ok) throw new Error('Failed to list');
                const data = await res.json();
                return data.output;
            },
            'Failed to list systemd units',
            { showToast: false }
        );
    };

    const registerService = async (agentId: string, name: string, type: string, serviceName: string, userScope: boolean = false) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to register');
                await refreshAgents();
                return true;
            },
            'Failed to register service'
        );
        return success || false;
    };

    const unregisterService = async (agentId: string, name: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to unregister');
                await refreshAgents();
                return true;
            },
            'Failed to unregister service'
        );
        return success || false;
    };

    const listSubProcesses = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service, action: 'service_list_processes' })
                });
                if (!res.ok) throw new Error('Failed to list');
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            },
            'Failed to list sub-processes',
            { showToast: false }
        );
    }, [apiBase]);

    const controlSubProcess = async (agentId: string, service: string, processId: string, processAction: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to control');
                return true;
            },
            'Failed to control sub-process'
        );
        return success || false;
    };

    const listStorageBuckets = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service, action: 'storage_list_buckets' })
                });
                if (!res.ok) throw new Error('Failed to list');
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            },
            'Failed to list storage buckets',
            { showToast: false }
        );
    }, [apiBase, isAuthenticated, token]);

    const createStorageBucket = async (agentId: string, service: string, name: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to create');
                return true;
            },
            'Failed to create storage bucket'
        );
        return success || false;
    };

    const deleteStorageBucket = async (agentId: string, service: string, name: string) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to delete');
                return true;
            },
            'Failed to delete storage bucket'
        );
        return success || false;
    };

    const listStorageUsers = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service, action: 'storage_list_users' })
                });
                if (!res.ok) throw new Error('Failed to list');
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            },
            'Failed to list storage users',
            { showToast: false }
        );
    }, [apiBase, isAuthenticated, token]);

    const createStorageUser = async (agentId: string, service: string, accessKey: string, secretKey: string) => {
        if (!isAuthenticated || !token) return false;
        return await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to create');
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return true;
                }
            },
            'Failed to create storage user'
        );
    };

    const getServiceSettings = useCallback(async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service, action: 'service_get_settings' })
                });
                if (!res.ok) throw new Error('Failed to get');
                const data = await res.json();
                try {
                    return JSON.parse(data.output);
                } catch {
                    return null;
                }
            },
            'Failed to get service settings',
            { showToast: false }
        );
    }, [apiBase, isAuthenticated, token]);

    const updateServiceSettings = async (agentId: string, service: string, settings: Record<string, any>) => {
        if (!isAuthenticated || !token) return false;
        const success = await handleError(
            async () => {
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
                if (!res.ok) throw new Error('Failed to update');
                return true;
            },
            'Failed to update service settings'
        );
        return success || false;
    };

    const importServiceResources = async (agentId: string, service: string) => {
        if (!isAuthenticated || !token) return null;
        return await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/control/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ agent_id: agentId, service })
                });
                if (!res.ok) throw new Error('Failed to import');
                return await res.json();
            },
            'Failed to import service resources',
            { showToast: false }
        );
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
