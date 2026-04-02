import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from '../useProjects';
import { AuthProvider } from '../../contexts/AuthContext';
import { message } from 'antd';

// Mock valid JWT token
const mockValidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test';

// Mock fetch
vi.stubGlobal('fetch', vi.fn());

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
};

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (message.error as any).mockClear();
  });

  describe('fetchProjects', () => {
    it('should fetch projects successfully', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', description: 'Test', color: 'blue', createdAt: '2024-01-01' },
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe('Project 1');
      expect(fetch).toHaveBeenCalled();
    });

    it('should handle fetch error gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      expect(result.current.projects).toHaveLength(0);
      expect(message.error).toHaveBeenCalled();
    });

    it('should not fetch without token', async () => {
      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      // Should not hang - should complete quickly without token
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.projects).toHaveLength(0);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('createProject', () => {
    it('should create project and update list', async () => {
      const mockProject = {
        id: '1',
        name: 'New Project',
        description: 'Test',
        color: 'red',
        createdAt: '2024-01-01',
      };

      // First fetch returns empty, then create returns new project
      (fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockProject });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const created = await result.current.createProject({
        name: 'New Project',
        description: 'Test',
        color: 'red',
      });

      expect(created).toEqual(mockProject);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return null on create error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Create failed'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const created = await result.current.createProject({
        name: 'New Project',
        description: 'Test',
        color: 'red',
      });

      expect(created).toBeNull();
      expect(message.error).toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('should update project', async () => {
      (fetch as any).mockResolvedValueOnce({ ok: true });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      await result.current.updateProject('1', { name: 'Updated' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        })
      );
    });

    it('should handle update error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Update failed'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      await expect(result.current.updateProject('1', { name: 'Updated' })).resolves.toBeUndefined();
      expect(message.error).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('should delete project', async () => {
      (fetch as any).mockResolvedValueOnce({ ok: true });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      await result.current.deleteProject('1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle delete error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Delete failed'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      await expect(result.current.deleteProject('1')).resolves.toBeUndefined();
      expect(message.error).toHaveBeenCalled();
    });
  });
});
