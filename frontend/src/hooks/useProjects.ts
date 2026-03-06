import { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';

const STORAGE_KEY = 'fitz:projects';

function load(): Project[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}
function save(data: Project[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>(load);

    useEffect(() => { save(projects); }, [projects]);

    const createProject = useCallback((data: Omit<Project, 'id' | 'createdAt'>) => {
        const p: Project = {
            ...data,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        setProjects(prev => [p, ...prev]);
        return p;
    }, []);

    const updateProject = useCallback((id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    }, []);

    const deleteProject = useCallback((id: string) => {
        setProjects(prev => prev.filter(p => p.id !== id));
    }, []);

    return { projects, createProject, updateProject, deleteProject };
}
