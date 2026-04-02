import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUsers } from '../useUsers';
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

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (message.error as any).mockClear();
  });

  describe('fetchUsers', () => {
    it('should fetch users successfully', async () => {
      const mockUsers = [
        { id: '1', username: 'admin', fullName: 'Admin User', email: 'admin@test.com', role: 'admin', mfaEnabled: false, createdAt: '2024-01-01' },
        { id: '2', username: 'user1', fullName: 'Test User', email: 'user@test.com', role: 'user', mfaEnabled: false, createdAt: '2024-01-02' },
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      expect(result.current.users).toHaveLength(2);
      expect(result.current.users[0].username).toBe('admin');
      expect(fetch).toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      expect(result.current.users).toHaveLength(0);
      expect(message.error).toHaveBeenCalled();
    });

    it('should not fetch without token', async () => {
      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.users).toHaveLength(0);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockUser = {
        id: '1',
        username: 'newuser',
        fullName: 'New User',
        email: 'new@test.com',
        role: 'user',
        status: 'active',
        mfaEnabled: false,
        createdAt: '2024-01-01',
      };

      (fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockUser });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const created = await result.current.createUser({
        username: 'newuser',
        fullName: 'New User',
        email: 'new@test.com',
        role: 'user',
      });

      expect(created).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'newuser',
            fullName: 'New User',
            email: 'new@test.com',
            role: 'user',
          }),
        })
      );
    });

    it('should return false on create error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Create failed'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const created = await result.current.createUser({
        username: 'newuser',
        fullName: 'New User',
        email: 'new@test.com',
        role: 'user',
      });

      expect(created).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      (fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const updated = await result.current.updateUser('1', { fullName: 'Updated Name' });

      expect(updated).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ fullName: 'Updated Name' }),
        })
      );
    });

    it('should return false on update error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Update failed'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const updated = await result.current.updateUser('1', { fullName: 'Updated' });

      expect(updated).toBe(false);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      (fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true });

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const deleted = await result.current.deleteUser('1');

      expect(deleted).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should return false on delete error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Delete failed'));

      localStorage.setItem('prism_token', mockValidToken);

      const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

      const deleted = await result.current.deleteUser('1');

      expect(deleted).toBe(false);
    });
  });
});
