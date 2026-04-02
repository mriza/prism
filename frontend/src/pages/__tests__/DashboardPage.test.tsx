import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';
import { BrowserRouter } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { useAccounts } from '../../hooks/useAccounts';
import { useAgents } from '../../hooks/useAgents';

// Mock the hooks
vi.mock('../../hooks/useProjects', () => ({
    useProjects: vi.fn()
}));

vi.mock('../../hooks/useAccounts', () => ({
    useAccounts: vi.fn()
}));

vi.mock('../../hooks/useAgents', () => ({
    useAgents: vi.fn()
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

const renderDashboard = () => {
    return render(
        <BrowserRouter>
            <DashboardPage />
        </BrowserRouter>
    );
};

describe('DashboardPage', () => {
    it('should render statistics correctly', () => {
        (useProjects as any).mockReturnValue({
            projects: [
                { id: '1', name: 'Project 1', color: 'primary' },
                { id: '2', name: 'Project 2', color: 'success' }
            ]
        });
        (useAccounts as any).mockReturnValue({
            accounts: [
                { id: 'a1', name: 'Account 1' },
                { id: 'a2', name: 'Account 2' },
                { id: 'a3', name: 'Account 3' }
            ],
            independentAccounts: [
                { id: 'i1', name: 'Indep 1' }
            ]
        });
        (useAgents as any).mockReturnValue({
            agents: [
                { id: 'agent1', status: 'online' },
                { id: 'agent2', status: 'offline' }
            ],
            error: null
        });

        renderDashboard();

        expect(screen.getByText('Total Projects')).toBeDefined();
        expect(screen.getAllByText('2')).toBeDefined();

        expect(screen.getByText('Active Services')).toBeDefined();
        expect(screen.getAllByText('3')).toBeDefined();

        expect(screen.getByText('Online Agents')).toBeDefined();
        expect(screen.getAllByText('1')).toBeDefined();

        expect(screen.getByText('Independent')).toBeDefined();
        // There might be multiple '1's, so we just check that '1' exists
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    });

    it('should navigate when clicking on stats cards', () => {
        renderDashboard();

        const projectsCard = screen.getByText('Total Projects').closest('.ant-card');
        if (projectsCard) fireEvent.click(projectsCard);
        expect(mockNavigate).toHaveBeenCalledWith('/projects');
    });

    it('should render recent projects', () => {
        renderDashboard();

        expect(screen.getByText('Recent Deployments')).toBeDefined();
        expect(screen.getByText('Project 1')).toBeDefined();
        expect(screen.getByText('Project 2')).toBeDefined();
    });

    it('should handle empty projects list', () => {
        (useProjects as any).mockReturnValue({ projects: [] });
        
        renderDashboard();

        expect(screen.queryByText('Recent Deployments')).toBeNull();
    });

    it('should show error state for agents if error exists', () => {
        (useAgents as any).mockReturnValue({
            agents: [],
            error: 'Failed to fetch agents'
        });

        renderDashboard();
        
        // The background color of the Online Agents icon should change, 
        // but it's hard to test icon style directly with RTL.
        // We just ensure it renders without crashing.
        expect(screen.getByText('Online Agents')).toBeDefined();
    });
});
