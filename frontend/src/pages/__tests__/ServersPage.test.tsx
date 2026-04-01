import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ServersPage } from '../ServersPage';
import { useAgents } from '../../hooks/useAgents';
import { useAuth } from '../../contexts/AuthContext';
import { ConfigProvider } from 'antd';

// Mock the hooks
vi.mock('../../hooks/useAgents');
vi.mock('../../contexts/AuthContext');

// Mock child components to simplify
vi.mock('../../components/modals/FirewallModal', () => ({ FirewallModal: () => null }));
vi.mock('../../components/modals/CrowdSecModal', () => ({ CrowdSecModal: () => null }));
vi.mock('../../components/modals/ApproveServerModal', () => ({ ApproveServerModal: () => null }));
vi.mock('../../components/modals/ServiceDetailModal', () => ({ ServiceDetailModal: () => null }));
vi.mock('../../components/modals/ServerSettingsModal', () => ({ ServerSettingsModal: () => null }));
vi.mock('../../components/PageContainer', () => ({ 
    PageContainer: ({ children, title }: any) => <div><h1>{title}</h1>{children}</div> 
}));

describe('ServersPage', () => {
    it('renders server with detected runtimes', () => {
        // Setup mock data
        const mockAgents = [
            {
                id: 'server-1',
                name: 'Production Server',
                hostname: 'prod-01',
                status: 'online',
                osInfo: 'Ubuntu 22.04',
                services: [],
                runtimes: [
                    { name: 'Node.js', version: '20.5.0', path: '/usr/bin/node' },
                    { name: 'Python', version: '3.11.2', path: '/usr/bin/python3' }
                ]
            }
        ];

        (useAgents as any).mockReturnValue({
            agents: mockAgents,
            loading: false,
            error: null,
            deleteAgent: vi.fn()
        });

        (useAuth as any).mockReturnValue({
            user: { role: 'admin' }
        });

        render(
            <ConfigProvider>
                <ServersPage />
            </ConfigProvider>
        );

        // Check if server name is rendered
        expect(screen.getByText('Production Server')).toBeInTheDocument();
        
        // Check if "Runtime Environments" section header is present
        expect(screen.getByText('Runtime Environments')).toBeInTheDocument();
        
        // Check if runtimes are rendered
        expect(screen.getByText('Node.js')).toBeInTheDocument();
        expect(screen.getByText('20.5.0')).toBeInTheDocument();
        expect(screen.getByText('Python')).toBeInTheDocument();
        expect(screen.getByText('3.11.2')).toBeInTheDocument();
    });

    it('renders empty state when no servers', () => {
        (useAgents as any).mockReturnValue({
            agents: [],
            loading: false,
            error: null,
            deleteAgent: vi.fn()
        });

        (useAuth as any).mockReturnValue({
            user: { role: 'admin' }
        });

        render(
            <ConfigProvider>
                <ServersPage />
            </ConfigProvider>
        );

        expect(screen.getByText('No Registered Servers')).toBeInTheDocument();
    });
});
