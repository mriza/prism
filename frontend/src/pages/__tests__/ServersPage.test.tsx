import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServersPage } from '../ServersPage';
import { BrowserRouter } from 'react-router-dom';
import { useAgents } from '../../hooks/useAgents';
import { useAgentsContext } from '../../contexts/AgentsContext';
import { useAuth } from '../../contexts/AuthContext';

// Mock the hooks
vi.mock('../../hooks/useAgents', () => ({
    useAgents: vi.fn()
}));

vi.mock('../../contexts/AgentsContext', () => ({
    useAgentsContext: vi.fn()
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: vi.fn()
}));

// Mock modals to avoid deep rendering issues
vi.mock('../../components/modals/FirewallModal', () => ({ FirewallModal: () => <div /> }));
vi.mock('../../components/modals/CrowdSecModal', () => ({ CrowdSecModal: () => <div /> }));
vi.mock('../../components/modals/ApproveServerModal', () => ({ ApproveServerModal: () => <div /> }));
vi.mock('../../components/modals/ServiceDetailModal', () => ({ ServiceDetailModal: () => <div /> }));
vi.mock('../../components/modals/ServerSettingsModal', () => ({ ServerSettingsModal: () => <div /> }));

const renderServers = () => {
    return render(
        <BrowserRouter>
            <ServersPage />
        </BrowserRouter>
    );
};

describe('ServersPage', () => {
    it('should render empty state when no servers exist', () => {
        (useAgents as any).mockReturnValue({
            agents: [],
            loading: false,
            error: null,
            deleteAgent: vi.fn()
        });
        (useAgentsContext as any).mockReturnValue({ usingPollingFallback: false });
        (useAuth as any).mockReturnValue({ user: { role: 'admin' } });

        renderServers();

        expect(screen.getByText('No Registered Servers')).toBeDefined();
    });

    it('should show pending approvals for admin', () => {
        const mockAgents = [
            { id: '1', hostname: 'pending-host', status: 'pending', osInfo: 'Ubuntu 22.04' }
        ];

        (useAgents as any).mockReturnValue({
            agents: mockAgents,
            loading: false,
            error: null,
            deleteAgent: vi.fn()
        });
        (useAgentsContext as any).mockReturnValue({ usingPollingFallback: false });
        (useAuth as any).mockReturnValue({ user: { role: 'admin' } });

        renderServers();

        expect(screen.getByText('Security Check Required')).toBeDefined();
        expect(screen.getByText('pending-host')).toBeDefined();
        expect(screen.getByText('Authorize')).toBeDefined();
    });

    it('should render active fleet servers', () => {
        const mockAgents = [
            { 
                id: '1', 
                name: 'Prod Server', 
                hostname: 'prod-host', 
                status: 'online', 
                services: [
                    { id: 's1', name: 'mongodb', status: 'running' }
                ],
                runtimes: [
                    { name: 'Node.js', version: '18.16.0', path: '/usr/bin/node' }
                ]
            }
        ];

        (useAgents as any).mockReturnValue({
            agents: mockAgents,
            loading: false,
            error: null,
            deleteAgent: vi.fn()
        });
        (useAgentsContext as any).mockReturnValue({ usingPollingFallback: false });
        (useAuth as any).mockReturnValue({ user: { role: 'admin' } });

        renderServers();

        expect(screen.getByText('Prod Server')).toBeDefined();
        expect(screen.getByText('ONLINE')).toBeDefined();
        expect(screen.getByText('MongoDB')).toBeDefined();
        expect(screen.getByText('Node.js')).toBeDefined();
    });

    it('should show warning when using polling fallback', () => {
        (useAgents as any).mockReturnValue({ agents: [], loading: false, error: null });
        (useAgentsContext as any).mockReturnValue({ usingPollingFallback: true });
        (useAuth as any).mockReturnValue({ user: { role: 'admin' } });

        renderServers();

        expect(screen.getByText('Real-time Updates Unavailable')).toBeDefined();
    });
});
