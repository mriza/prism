import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsPage } from '../AccountsPage';
import { BrowserRouter } from 'react-router-dom';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../contexts/AuthContext';

// Mock the hooks
vi.mock('../../hooks/useAccounts', () => ({
    useAccounts: vi.fn()
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: vi.fn()
}));

// Mock AccountFormModal to avoid deep rendering issues
vi.mock('../../components/modals/AccountFormModal', () => ({
    AccountFormModal: () => <div data-testid="account-form-modal" />
}));

const renderAccounts = () => {
    return render(
        <BrowserRouter>
            <AccountsPage />
        </BrowserRouter>
    );
};

describe('AccountsPage', () => {
    it('should render empty state when no accounts exist', () => {
        (useAccounts as any).mockReturnValue({
            independentAccounts: [],
            createAccount: vi.fn(),
            updateAccount: vi.fn(),
            deleteAccount: vi.fn()
        });
        (useAuth as any).mockReturnValue({ user: { role: 'admin' } });

        renderAccounts();

        expect(screen.getByText('No independent accounts found')).toBeDefined();
    });

    it('should render account cards when they exist', () => {
        const mockAccounts = [
            {
                id: '1',
                name: 'Test DB',
                type: 'mongodb',
                username: 'admin',
                password: 'password123',
                host: 'localhost',
                port: 27017,
                database: 'test'
            }
        ];

        (useAccounts as any).mockReturnValue({
            independentAccounts: mockAccounts,
            createAccount: vi.fn(),
            updateAccount: vi.fn(),
            deleteAccount: vi.fn()
        });

        renderAccounts();

        expect(screen.getByText('Test DB')).toBeDefined();
        expect(screen.getAllByText(/MongoDB/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/mongodb:\/\/admin:••••••••@localhost:27017\/test/)).toBeDefined();
    });

    it('should toggle password visibility', () => {
        const mockAccounts = [
            {
                id: '1',
                name: 'Test DB',
                type: 'mongodb',
                username: 'admin',
                password: 'password123',
                host: 'localhost',
                port: 27017,
                database: 'test'
            }
        ];

        (useAccounts as any).mockReturnValue({
            independentAccounts: mockAccounts,
            createAccount: vi.fn(),
            updateAccount: vi.fn(),
            deleteAccount: vi.fn()
        });

        renderAccounts();

        const toggleBtn = screen.getByRole('button', { name: /eye/i });
        fireEvent.click(toggleBtn);

        expect(screen.getByText(/mongodb:\/\/admin:password123@localhost:27017\/test/)).toBeDefined();
    });

    it('should filter accounts by type', () => {
        const mockAccounts = [
            { id: '1', name: 'DB 1', type: 'mongodb' },
            { id: '2', name: 'S3 1', type: 's3-compatible' }
        ];

        (useAccounts as any).mockReturnValue({
            independentAccounts: mockAccounts,
            createAccount: vi.fn(),
            updateAccount: vi.fn(),
            deleteAccount: vi.fn()
        });

        renderAccounts();

        expect(screen.getByText('DB 1')).toBeDefined();
        expect(screen.getByText('S3 1')).toBeDefined();

        const mongoFilter = screen.getByRole('button', { name: /MongoDB/i });
        fireEvent.click(mongoFilter);

        expect(screen.getByText('DB 1')).toBeDefined();
        expect(screen.queryByText('S3 1')).toBeNull();
    });

    it('should show "Add Account" button for admins', () => {
        (useAccounts as any).mockReturnValue({ independentAccounts: [] });
        (useAuth as any).mockReturnValue({ user: { role: 'admin' } });

        renderAccounts();

        expect(screen.getByText('Add Account')).toBeDefined();
    });

    it('should NOT show "Add Account" button for regular users', () => {
        (useAccounts as any).mockReturnValue({ independentAccounts: [] });
        (useAuth as any).mockReturnValue({ user: { role: 'user' } });

        renderAccounts();

        expect(screen.queryByText('Add Account')).toBeNull();
    });
});
