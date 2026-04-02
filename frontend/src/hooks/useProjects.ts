import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { message } from 'antd';
import { log } from '../utils/log';


export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    const apiBase = import.meta.env.VITE_API_URL || '';

    const fetchProjects = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${apiBase}/api/projects`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setProjects(data || []);
            }
        } catch (err) {
            log.error('Failed to fetch projects', err);
            message.error('Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    }, [token, apiBase]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const createProject = useCallback(async (data: Omit<Project, 'id' | 'createdAt'>) => {
        if (!token) return null;
        try {
            const res = await fetch(`${apiBase}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const newProject = await res.json();
                setProjects(prev => [newProject, ...prev]);
                return newProject;
            }
        } catch (err) {
            log.error('Failed to create project', err);
            message.error('Failed to create project');
        }
        return null;
    }, [token, apiBase]);

    const updateProject = useCallback(async (id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
        if (!token) return;
        try {
            const res = await fetch(`${apiBase}/api/projects/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updatedProject = await res.json();
                setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updatedProject } : p));
            }
        } catch (err) {
            log.error('Failed to update project', err);
            message.error('Failed to update project');
        }
    }, [token, apiBase]);

    const deleteProject = useCallback(async (id: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${apiBase}/api/projects/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== id));
            }
        } catch (err) {
            log.error('Failed to delete project', err);
            message.error('Failed to delete project');
        }
    }, [token, apiBase]);

    return { projects, loading, createProject, updateProject, deleteProject };
}
