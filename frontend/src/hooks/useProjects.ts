import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../utils/log';


export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchProjects = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        const data = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/projects`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch');
                return await res.json();
            },
            'Failed to fetch projects'
        );
        if (data) {
            setProjects(data);
        }
        setLoading(false);
    }, [token, apiBase]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const createProject = useCallback(async (data: Omit<Project, 'id' | 'createdAt'>) => {
        if (!token) return null;
        const result = await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/projects`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to create');
                return await res.json();
            },
            'Failed to create project'
        );
        if (result) {
            setProjects(prev => [result, ...prev]);
            return result;
        }
        return null;
    }, [token, apiBase]);

    const updateProject = useCallback(async (id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
        if (!token) return;
        await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/projects/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to update');
                const updatedProject = await res.json();
                setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updatedProject } : p));
            },
            'Failed to update project'
        );
    }, [token, apiBase]);

    const deleteProject = useCallback(async (id: string) => {
        if (!token) return;
        await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/projects/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to delete');
                setProjects(prev => prev.filter(p => p.id !== id));
            },
            'Failed to delete project'
        );
    }, [token, apiBase]);

    return { projects, loading, createProject, updateProject, deleteProject };
}
