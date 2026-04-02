import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useManagementCredentials } from '../useManagementCredentials';
import { AuthProvider } from '../../contexts/AuthContext';
import { message } from 'antd';
import { mockValidToken, createMockFetchResponse, clearAllMocks, setupAuthStorage } from '../../test/setup';

const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
    );
};

describe('useManagementCredentials', () => {
    beforeEach(() => {
        clearAllMocks();
        setupAuthStorage(mockValidToken);
    });

    describe('fetchCredentials', () => {
        it('should fetch credentials successfully', async () => {
            const mockCreds = [{ id: 'c1', usernameMasked: 'admin' }];
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(mockCreds)));

            const { result } = renderHook(() => useManagementCredentials(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.fetchCredentials('s1');
            });

            expect(result.current.credentials).toEqual(mockCreds);
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('serviceId=s1'), expect.any(Object));
        });

        it('should handle fetch errors', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch failed')));

            const { result } = renderHook(() => useManagementCredentials(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.fetchCredentials('s1');
            });

            expect(message.error).toHaveBeenCalledWith('Failed to fetch management credentials');
        });
    });

    describe('createCredential', () => {
        it('should create credential and update state', async () => {
            const newCred = { id: 'c2', usernameMasked: 'new' };
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(newCred)));

            const { result } = renderHook(() => useManagementCredentials(), { wrapper: createWrapper() });

            let created: any;
            await act(async () => {
                created = await result.current.createCredential({ serviceId: 's1' });
            });

            expect(created).toEqual(newCred);
            expect(result.current.credentials).toContainEqual(newCred);
        });
    });

    describe('updateCredential', () => {
        it('should update credential and update local state', async () => {
            const initial = [{ id: 'c1', usernameMasked: 'old' }];
            const updated = { id: 'c1', usernameMasked: 'new' };

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial)) // fetch (optional, but let's assume we have it)
                .mockResolvedValueOnce(createMockFetchResponse(updated))); // update

            const { result } = renderHook(() => useManagementCredentials(), { wrapper: createWrapper() });
            
            // Set initial state via fetch
            await act(async () => { await result.current.fetchCredentials('s1'); });

            let success = false;
            await act(async () => {
                success = await result.current.updateCredential('c1', { usernameMasked: 'new' } as any);
            });

            expect(success).toBe(true);
            expect(result.current.credentials[0].usernameMasked).toBe('new');
        });
    });

    describe('deleteCredential', () => {
        it('should delete and update state', async () => {
            const initial = [{ id: 'c1', usernameMasked: 'del' }];
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial))
                .mockResolvedValueOnce(createMockFetchResponse({}, { ok: true })));

            const { result } = renderHook(() => useManagementCredentials(), { wrapper: createWrapper() });
            await act(async () => { await result.current.fetchCredentials('s1'); });

            let success = false;
            await act(async () => {
                success = await result.current.deleteCredential('c1');
            });

            expect(success).toBe(true);
            expect(result.current.credentials).toHaveLength(0);
        });
    });

    describe('verifyCredential', () => {
        it('should call control and verify endpoints', async () => {
            const initial = [{ id: 'c1', status: 'inactive' }];
            
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial)) // fetch
                .mockResolvedValueOnce(createMockFetchResponse({ ok: true })) // control/verify
                .mockResolvedValueOnce(createMockFetchResponse({}))); // credential/verify

            const { result } = renderHook(() => useManagementCredentials(), { wrapper: createWrapper() });
            await act(async () => { await result.current.fetchCredentials('s1'); });

            let success = false;
            await act(async () => {
                success = await result.current.verifyCredential('c1', 'a1', 'mysql');
            });

            expect(success).toBe(true);
            expect(result.current.credentials[0].status).toBe('active');
            expect(fetch).toHaveBeenCalledTimes(3);
        });
    });
});
