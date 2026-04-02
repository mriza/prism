import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgents } from '../useAgents';
import { AuthProvider } from '../../contexts/AuthContext';
import { useAgentsContext } from '../../contexts/AgentsContext';
import { mockValidToken, createMockFetchResponse, clearAllMocks, setupAuthStorage } from '../../test/setup';

// Mock AgentsContext
vi.mock('../../contexts/AgentsContext', () => ({
    useAgentsContext: vi.fn(),
}));

const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
    );
};

describe('useAgents', () => {
    const mockRefreshAgents = vi.fn().mockResolvedValue(undefined);
    const mockAgents = [{ id: 'a1', name: 'Agent 1', status: 'online' }];

    beforeEach(() => {
        clearAllMocks();
        setupAuthStorage(mockValidToken);
        mockRefreshAgents.mockClear();
        (useAgentsContext as any).mockReturnValue({
            agents: mockAgents,
            loading: false,
            error: null,
            refreshAgents: mockRefreshAgents,
        });
    });

    describe('approveAgent', () => {
        it('should approve agent and refresh', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ ok: true })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            let success = false;
            await act(async () => {
                success = await result.current.approveAgent('a1', 'New Name', 'Desc');
            });

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/agents/a1/approve'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(mockRefreshAgents).toHaveBeenCalled();
        });
    });

    describe('controlService', () => {
        it('should send control command and refresh', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ ok: true })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            let success = false;
            await act(async () => {
                success = await result.current.controlService('a1', 'mysql', 'start');
            });

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/control'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ agent_id: 'a1', service: 'mysql', action: 'start' })
                })
            );
            expect(mockRefreshAgents).toHaveBeenCalled();
        });
    });

    describe('getServiceConfig', () => {
        it('should return service config content', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ output: 'config-content' })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const config = await result.current.getServiceConfig('a1', 'mysql');

            expect(config).toBe('config-content');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/control'),
                expect.objectContaining({
                    body: expect.stringContaining('"action":"service_get_config"')
                })
            );
        });
    });

    describe('listSystemdUnits', () => {
        it('should return systemd units list', async () => {
            const mockUnits = [{ name: 'u1', status: 'active' }];
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ output: mockUnits })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const units = await result.current.listSystemdUnits('a1');

            expect(units).toEqual(mockUnits);
        });
    });

    describe('storage actions', () => {
        it('should list storage buckets', async () => {
            const mockBuckets = ['b1', 'b2'];
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ output: JSON.stringify(mockBuckets) })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const buckets = await result.current.listStorageBuckets('a1', 'minio');

            expect(buckets).toEqual(mockBuckets);
        });

        it('should create storage bucket', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ ok: true })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const success = await result.current.createStorageBucket('a1', 'minio', 'new-bucket');

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/control'),
                expect.objectContaining({
                    body: expect.stringContaining('"action":"storage_create_bucket"')
                })
            );
        });
    });

    describe('settings actions', () => {
        it('should get service settings', async () => {
            const mockSettings = { port: 3306 };
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ output: JSON.stringify(mockSettings) })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const settings = await result.current.getServiceSettings('a1', 'mysql');

            expect(settings).toEqual(mockSettings);
        });

        it('should update service settings', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse({ ok: true })));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const success = await result.current.updateServiceSettings('a1', 'mysql', { port: 3307 });

            expect(success).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/control'),
                expect.objectContaining({
                    body: expect.stringContaining('"action":"service_update_settings"')
                })
            );
        });
    });

    describe('importServiceResources', () => {
        it('should call import endpoint', async () => {
            const mockImportResult = { imported: 5 };
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockFetchResponse(mockImportResult)));

            const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

            const res = await result.current.importServiceResources('a1', 'mysql');

            expect(res).toEqual(mockImportResult);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/control/import'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });
});
