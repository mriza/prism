import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDeployments } from '../useDeployments';
import { AuthProvider } from '../../contexts/AuthContext';
import { message } from 'antd';
import { mockValidToken, createMockFetchResponse, clearAllMocks, setupAuthStorage } from '../../test/setup';

const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
    );
};

describe('useDeployments', () => {
    beforeEach(() => {
        clearAllMocks();
        setupAuthStorage(mockValidToken);
    });

    describe('fetchDeployments', () => {
        it('should fetch deployments successfully', async () => {
            const mockDeploys = [
                { id: '1', name: 'Deploy 1', status: 'running', projectId: 'p1' },
            ];

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(mockDeploys)));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });

            await waitFor(() => expect(result.current.loading).toBe(false));

            expect(result.current.deployments).toHaveLength(1);
            expect(result.current.deployments[0].name).toBe('Deploy 1');
        });

        it('should handle filters', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse([])));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));
            vi.clearAllMocks();

            await result.current.fetchDeployments({ projectId: 'p1', status: 'failed' });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('projectId=p1'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('status=failed'),
                expect.any(Object)
            );
        });

        it('should handle errors', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fetch failed')));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });

            await waitFor(() => expect(result.current.loading).toBe(false));
            expect(message.error).toHaveBeenCalledWith('Failed to fetch deployments');
        });
    });

    describe('createDeployment', () => {
        it('should create deployment and update state', async () => {
            const newDeploy = { id: '2', name: 'New Deploy' };
            
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse([])) // initial
                .mockResolvedValueOnce(createMockFetchResponse(newDeploy))); // create

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.loading).toBe(false));

            let created: any;
            await act(async () => {
                created = await result.current.createDeployment({ name: 'New Deploy' } as any);
            });

            expect(created).toEqual(newDeploy);
            await waitFor(() => expect(result.current.deployments).toContainEqual(newDeploy));
        });
    });

    describe('updateDeployment', () => {
        it('should update deployment and update local state', async () => {
            const initial = [{ id: '1', name: 'Old' }];
            const updated = { id: '1', name: 'New' };

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial))
                .mockResolvedValueOnce(createMockFetchResponse(updated)));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.deployments.length).toBe(1));

            let success = false;
            await act(async () => {
                success = await result.current.updateDeployment('1', { name: 'New' });
            });

            expect(success).toBe(true);
            await waitFor(() => expect(result.current.deployments[0].name).toBe('New'));
        });
    });

    describe('deleteDeployment', () => {
        it('should delete and update state', async () => {
            const initial = [{ id: '1', name: 'Delete Me' }];

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial))
                .mockResolvedValueOnce(createMockFetchResponse({}, { ok: true })));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.deployments.length).toBe(1));

            await act(async () => {
                await result.current.deleteDeployment('1');
            });

            await waitFor(() => expect(result.current.deployments).toHaveLength(0));
        });
    });

    describe('triggerDeploy', () => {
        it('should trigger deploy and update status', async () => {
            const initial = [{ id: '1', status: 'idle' }];
            const updated = { id: '1', status: 'deploying' };

            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(createMockFetchResponse(initial))
                .mockResolvedValueOnce(createMockFetchResponse(updated)));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.deployments.length).toBe(1));

            let success = false;
            await act(async () => {
                success = await result.current.triggerDeploy('1');
            });

            expect(success).toBe(true);
            await waitFor(() => expect(result.current.deployments[0].status).toBe('deploying'));
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/deployments/1/deploy'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('helpers', () => {
        it('should deploymentsByProject correctly', async () => {
            const mock = [
                { id: '1', projectId: 'p1' },
                { id: '2', projectId: 'p2' },
            ];

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(mock)));

            const { result } = renderHook(() => useDeployments(), { wrapper: createWrapper() });
            await waitFor(() => expect(result.current.deployments.length).toBe(2));

            const p1 = result.current.deploymentsByProject('p1');
            expect(p1).toHaveLength(1);
            expect(p1[0].id).toBe('1');
        });
    });
});
