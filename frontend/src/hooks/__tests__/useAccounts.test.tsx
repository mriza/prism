import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAccounts } from '../useAccounts';
import { AuthProvider } from '../../contexts/AuthContext';
import { message } from 'antd';
import { mockValidToken, createMockFetchResponse, clearAllMocks, setupAuthStorage } from '../../test/setup';

const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
    );
};

describe('useAccounts', () => {
    beforeEach(() => {
        clearAllMocks();
        setupAuthStorage(mockValidToken);
    });

    describe('fetchAccounts', () => {
        it('should fetch accounts successfully', async () => {
            const mockAccounts = [
                { id: '1', name: 'Account 1', type: 'user', category: 'project', projectId: 'p1' },
            ];

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(mockAccounts)));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });

            // Initial fetch happens in useEffect
            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.accounts).toHaveLength(1);
            expect(result.current.accounts[0].name).toBe('Account 1');
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/accounts'), expect.any(Object));
        });

        it('should handle filters correctly', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse([])));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            
            await waitFor(() => expect(result.current.loading).toBe(false));
            vi.clearAllMocks();

            await result.current.fetchAccounts({ projectId: 'p1', type: 'service_account' });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('projectId=p1'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('type=service_account'),
                expect.any(Object)
            );
        });

        it('should handle fetch errors', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch failed')));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(message.error).toHaveBeenCalledWith('Failed to fetch accounts');
        });
    });

    describe('fetchCrossReference', () => {
        it('should fetch cross-reference data', async () => {
            const mockXR = [{ id: '1', name: 'XR 1', projectName: 'P1' }];
            
            // Multiple fetches in useAccounts logic: one for accounts, one for XR
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial fetchAccounts
                .mockResolvedValueOnce(createMockFetchResponse(mockXR)); // initial fetchCrossReference

            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });

            await waitFor(() => expect(result.current.crossReference.length).toBeGreaterThan(0));
            
            expect(result.current.crossReference[0].name).toBe('XR 1');
        });
    });

    describe('createAccount', () => {
        it('should create an account and update local state', async () => {
            const newAccount = { id: '2', name: 'New Account', type: 'user' };
            
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial fetchAccounts
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial fetchCrossReference
                .mockResolvedValueOnce(createMockFetchResponse(newAccount))); // createAccount

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));

            let created: any;
            await act(async () => {
                created = await result.current.createAccount({ name: 'New Account', type: 'user' } as any);
            });

            expect(created).toEqual(newAccount);
            await waitFor(() => expect(result.current.accounts).toContainEqual(newAccount));
        });
    });

    describe('updateAccount', () => {
        it('should update an account and update local state', async () => {
            const initialAccounts = [{ id: '1', name: 'Old Name' }];
            const updatedAccount = { id: '1', name: 'New Name' };

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initialAccounts)) // initial fetchAccounts
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial fetchCrossReference
                .mockResolvedValueOnce(createMockFetchResponse(updatedAccount))); // updateAccount

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.accounts.length).toBe(1));

            let success = false;
            await act(async () => {
                success = await result.current.updateAccount('1', { name: 'New Name' });
            });

            expect(success).toBe(true);
            await waitFor(() => expect(result.current.accounts[0].name).toBe('New Name'));
        });
    });

    describe('deleteAccount', () => {
        it('should delete an account and remove from local state', async () => {
            const initialAccounts = [{ id: '1', name: 'To Delete' }];

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initialAccounts))
                .mockResolvedValueOnce(createMockFetchResponse([]))
                .mockResolvedValueOnce(createMockFetchResponse({}, { ok: true })));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.accounts.length).toBe(1));

            await act(async () => {
                await result.current.deleteAccount('1');
            });

            await waitFor(() => expect(result.current.accounts).toHaveLength(0));
        });
    });

    describe('provisionAccount', () => {
        it('should call control API with correct data', async () => {
            const accounts = [{ id: '1', agentId: 'a1', type: 'mysql' }];
            
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(accounts)) // initial
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial XR
                .mockResolvedValueOnce(createMockFetchResponse({ ok: true }))); // provision

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.accounts.length).toBe(1));

            let success = false;
            await act(async () => {
                success = await result.current.provisionAccount('a1', 'db_create_user', { username: 'test' });
            });

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/control'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"service":"mysql"')
                })
            );
        });
    });

    describe('bulk actions', () => {
        it('should perform bulkUpdateProject and refresh', async () => {
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValue(createMockFetchResponse([])));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));
            
            vi.clearAllMocks();
            let success = false;
            await act(async () => {
                success = await result.current.bulkUpdateProject(['1', '2'], 'p1');
            });

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/accounts/bulk-project'), expect.any(Object));
        });

        it('should perform bulkDisable and refresh', async () => {
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValue(createMockFetchResponse([])));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));
            
            vi.clearAllMocks();
            let success = false;
            await act(async () => {
                success = await result.current.bulkDisable(['1', '2']);
            });

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/accounts/bulk-disable'), expect.any(Object));
        });
    });

    describe('helper selectors', () => {
        it('should filter accounts by project correctly', async () => {
            const mockAccounts = [
                { id: '1', category: 'project', projectId: 'p1' },
                { id: '2', category: 'project', projectId: 'p2' },
                { id: '3', category: 'independent' },
            ];

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(mockAccounts))
                .mockResolvedValueOnce(createMockFetchResponse([])));

            const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.accounts.length).toBe(3));

            const p1Accounts = result.current.accountsByProject('p1');
            expect(p1Accounts).toHaveLength(1);
            expect(p1Accounts[0].id).toBe('1');

            expect(result.current.independentAccounts).toHaveLength(1);
            expect(result.current.independentAccounts[0].id).toBe('3');
        });
    });
});
