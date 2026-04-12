import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePermissions } from '../usePermissions';
import { AuthProvider } from '../../contexts/AuthContext';
import { message } from 'antd';
import { mockValidToken, createMockFetchResponse, clearAllMocks, setupAuthStorage } from '../../test/setup';

const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
    );
};

describe('usePermissions', () => {
    beforeEach(() => {
        clearAllMocks();
        setupAuthStorage(mockValidToken);
    });

    describe('fetchPermissions', () => {
        it('should fetch permissions successfully', async () => {
            const mockPermissions = [{ id: 'p1', name: 'Perm 1', resourceType: 'project', action: 'read' }];
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(mockPermissions)));

            const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.permissions).toEqual(mockPermissions);
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/permissions'), expect.any(Object));
        });

        it('should handle resourceType filter', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse([])));

            const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));
            vi.clearAllMocks();

            await act(async () => {
                await result.current.fetchPermissions('agent');
            });

            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('resourceType=agent'), expect.any(Object));
        });

        it('should handle fetch errors', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch failed')));

            const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

            await waitFor(() => expect(result.current.loading).toBe(false));
            expect(message.error).toHaveBeenCalledWith('Failed to fetch permissions');
        });
    });

    describe('createPermission', () => {
        it('should create permission and update state', async () => {
            const newPerm = { id: 'p2', name: 'New Perm' };
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial
                .mockResolvedValueOnce(createMockFetchResponse(newPerm))); // create

            const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));

            let created: any;
            await act(async () => {
                created = await result.current.createPermission({ name: 'New Perm' } as any);
            });

            expect(created).toEqual(newPerm);
            expect(result.current.permissions).toContainEqual(newPerm);
        });
    });

    describe('updatePermission', () => {
        it('should update permission and update state', async () => {
            const initial = [{ id: 'p1', name: 'Old' }];
            const updated = { id: 'p1', name: 'New' };

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial))
                .mockResolvedValueOnce(createMockFetchResponse(updated)));

            const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.permissions.length).toBe(1));

            let success: boolean | undefined = false;
            await act(async () => {
                success = await result.current.updatePermission('p1', { name: 'New' });
            });

            expect(success).toBe(true);
            expect(result.current.permissions[0].name).toBe('New');
        });
    });

    describe('deletePermission', () => {
        it('should delete and update state', async () => {
            const initial = [{ id: 'p1', name: 'Del' }];
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial))
                .mockResolvedValueOnce(createMockFetchResponse({}, { ok: true })));

            const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.permissions.length).toBe(1));

            let success: boolean | undefined = false;
            await act(async () => {
                success = await result.current.deletePermission('p1');
            });

            expect(success).toBe(true);
            expect(result.current.permissions).toHaveLength(0);
        });
    });
});
