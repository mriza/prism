import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProjectsPage } from '../ProjectsPage';
import { BrowserRouter } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../contexts/AuthContext';

// Mock the hooks
vi.mock('../../hooks/useProjects', () => ({
    useProjects: vi.fn()
}));

vi.mock('../../hooks/useAccounts', () => ({
    useAccounts: vi.fn()
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: vi.fn()
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

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn());

const renderProjects = () => {
    return render(
        <BrowserRouter>
            <ProjectsPage />
        </BrowserRouter>
    );
};

describe('ProjectsPage', () => {
    const mockProjects = [
        { id: '1', name: 'Alpha Project', description: 'Alpha description', color: 'primary' },
        { id: '2', name: 'Beta Project', description: 'Beta description', color: 'success' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (useProjects as any).mockReturnValue({
            projects: mockProjects,
            createProject: vi.fn(),
            updateProject: vi.fn(),
            deleteProject: vi.fn()
        });
        (useAccounts as any).mockReturnValue({
            accountsByProject: vi.fn().mockReturnValue([]),
            deleteAccountsByProject: vi.fn()
        });
        (useAuth as any).mockReturnValue({
            user: { role: 'admin' }
        });
    });

    it('should render project list correctly', () => {
        renderProjects();

        expect(screen.getByText('Alpha Project')).toBeDefined();
        expect(screen.getByText('Beta Project')).toBeDefined();
        expect(screen.getByText('Alpha description')).toBeDefined();
    });

    it('should show empty state when no projects exist', () => {
        (useProjects as any).mockReturnValue({
            projects: [],
            createProject: vi.fn()
        });

        renderProjects();

        expect(screen.getByText('Portfolio Empty')).toBeDefined();
    });

    it('should filter projects by search input', () => {
        renderProjects();

        const searchInput = screen.getByPlaceholderText('Filter projects...');
        fireEvent.change(searchInput, { target: { value: 'Alpha' } });

        expect(screen.getByText('Alpha Project')).toBeDefined();
        expect(screen.queryByText('Beta Project')).toBeNull();
    });

    it('should show "New Project" button for admin but not for user', () => {
        const { unmount } = renderProjects();
        expect(screen.getByText('New Project')).toBeDefined();

        unmount();
        (useAuth as any).mockReturnValue({ user: { role: 'user' } });
        renderProjects();
        expect(screen.queryByText('New Project')).toBeNull();
    });

    it('should open create modal when clicking "New Project"', () => {
        renderProjects();

        const newProjectBtn = screen.getByText('New Project');
        fireEvent.click(newProjectBtn);

        // Check if modal is present by looking for the submit button text or dialog
        expect(screen.getByText('Create Project')).toBeDefined();
    });

    it('should call deleteProject after confirmation', () => {
        const deleteProject = vi.fn();
        (useProjects as any).mockReturnValue({
            projects: mockProjects,
            deleteProject
        });
        (confirm as any).mockReturnValue(true);

        renderProjects();

        const alphaCard = screen.getByText('Alpha Project').closest('.ant-card');
        if (alphaCard) {
            const deleteBtn = within(alphaCard as HTMLElement).getByRole('img', { name: 'delete' }).parentElement;
            if (deleteBtn) fireEvent.click(deleteBtn);
        }

        expect(confirm).toHaveBeenCalled();
        expect(deleteProject).toHaveBeenCalledWith('1');
    });

    it('should navigate to project details when clicking title or "Orchestrate"', () => {
        renderProjects();

        const title = screen.getByText('Alpha Project');
        fireEvent.click(title);
        expect(mockNavigate).toHaveBeenCalledWith('/projects/1');

        const orchestrateBtn = screen.getAllByText('Orchestrate')[0];
        fireEvent.click(orchestrateBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
    });
});
