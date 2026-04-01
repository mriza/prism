import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountFormModal } from '../AccountFormModal';
import { ConfigProvider } from 'antd';
import { useAgents } from '../../../hooks/useAgents';

// Mock useAgents hook
vi.mock('../../../hooks/useAgents', () => ({
    useAgents: vi.fn()
}));

// Mock ServiceTypeIcons
vi.mock('../../ServiceTypeIcons', () => ({
    ServiceTypeIcons: () => <span data-testid="service-icon">Icon</span>
}));

const mockAgents = [
    {
        id: 'agent-1',
        name: 'Test Server',
        hostname: 'test-01',
        status: 'online',
        services: [
            { id: 'svc-1', name: 'valkey', status: 'running' },
            { id: 'svc-2', name: 'mysql', status: 'running' },
            { id: 'svc-3', name: 'postgresql', status: 'running' }
        ]
    }
];

const renderModal = (props = {}) => {
    (useAgents as any).mockReturnValue({
        agents: mockAgents
    });

    return render(
        <ConfigProvider>
            <AccountFormModal
                isOpen={true}
                onClose={vi.fn()}
                onSave={vi.fn()}
                {...props}
            />
        </ConfigProvider>
    );
};

describe('AccountFormModal - Valkey Subtypes', () => {
    beforeEach(() => {
        (useAgents as any).mockReturnValue({
            agents: mockAgents
        });
    });

    it('should show databases multi-tag field for mysql', () => {
        renderModal({ initial: { type: 'mysql' } as any });

        // Check for databases multi-tag field
        expect(screen.getByText(/Databases \(Multi-value/i)).toBeInTheDocument();
    });

    it('should show databases multi-tag field for postgresql', () => {
        renderModal({ initial: { type: 'postgresql' } as any });

        expect(screen.getByText(/Databases \(Multi-value/i)).toBeInTheDocument();
    });

    it('should show databases multi-tag field for mongodb', () => {
        renderModal({ initial: { type: 'mongodb' } as any });

        expect(screen.getByText(/Databases \(Multi-value/i)).toBeInTheDocument();
    });
});

describe('AccountFormModal - handleSave Logic', () => {
    it('should auto-set database field from databases array', async () => {
        const onSaveMock = vi.fn();
        const onCloseMock = vi.fn();
        
        (useAgents as any).mockReturnValue({
            agents: mockAgents
        });

        render(
            <ConfigProvider>
                <AccountFormModal
                    isOpen={true}
                    onClose={onCloseMock}
                    onSave={onSaveMock}
                    initial={{ 
                        type: 'mysql',
                        name: 'Test Account',
                        serverId: 'server-1',
                        serviceId: 'service-1',
                        agentId: 'agent-1',
                        databases: ['mydb', 'testdb']
                    } as any}
                />
            </ConfigProvider>
        );

        // Submit the form
        const submitButton = screen.getByRole('button', { name: /Save Changes|Confirm & Create/i });
        fireEvent.click(submitButton);

        // Wait for form submission
        await waitFor(() => {
            expect(onSaveMock).toHaveBeenCalled();
        });
        
        const savedData = onSaveMock.mock.calls[0][0];

        // The first database should be set as primary
        expect(savedData.database).toBe('mydb');
        expect(savedData.databases).toEqual(['mydb', 'testdb']);
    });

    it('should handle empty databases array', async () => {
        const onSaveMock = vi.fn();
        const onCloseMock = vi.fn();

        (useAgents as any).mockReturnValue({
            agents: mockAgents
        });

        render(
            <ConfigProvider>
                <AccountFormModal
                    isOpen={true}
                    onClose={onCloseMock}
                    onSave={onSaveMock}
                    initial={{
                        type: 'mysql',
                        name: 'Test Account',
                        serverId: 'server-1',
                        serviceId: 'service-1',
                        agentId: 'agent-1',
                        databases: []
                    } as any}
                />
            </ConfigProvider>
        );

        const submitButton = screen.getByRole('button', { name: /Save Changes|Confirm & Create/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(onSaveMock).toHaveBeenCalled();
        });
        
        const savedData = onSaveMock.mock.calls[0][0];

        // Empty database field when no databases
        expect(savedData.database).toBe('');
    });

    it('should convert databaseIndex to databases array for valkey-nosql', async () => {
        const onSaveMock = vi.fn();

        (useAgents as any).mockReturnValue({
            agents: mockAgents
        });

        render(
            <ConfigProvider>
                <AccountFormModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={onSaveMock}
                    initial={{
                        type: 'valkey-nosql',
                        name: 'Test Valkey',
                        serverId: 'server-1',
                        serviceId: 'service-1',
                        agentId: 'agent-1',
                        databaseIndex: 5
                    } as any}
                />
            </ConfigProvider>
        );

        const submitButton = screen.getByRole('button', { name: /Save Changes|Confirm & Create/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(onSaveMock).toHaveBeenCalled();
        });
        
        const savedData = onSaveMock.mock.calls[0][0];

        // Should convert databaseIndex to databases array
        expect(savedData.databases).toEqual(['db5']);
        expect(savedData.database).toBe('db5');
    });

    it('should include aclCategory for valkey-cache', async () => {
        const onSaveMock = vi.fn();
        
        (useAgents as any).mockReturnValue({
            agents: mockAgents
        });

        render(
            <ConfigProvider>
                <AccountFormModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={onSaveMock}
                    initial={{ 
                        type: 'valkey-cache',
                        name: 'Test Valkey Cache',
                        serverId: 'server-1',
                        serviceId: 'service-1',
                        agentId: 'agent-1',
                        aclCategory: '@read'
                    } as any}
                />
            </ConfigProvider>
        );

        const submitButton = screen.getByRole('button', { name: /Save Changes|Confirm & Create/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(onSaveMock).toHaveBeenCalled();
        });
        
        const savedData = onSaveMock.mock.calls[0][0];

        expect(savedData.aclCategory).toBe('@read');
    });

    it('should include channelPattern for valkey-broker', async () => {
        const onSaveMock = vi.fn();

        (useAgents as any).mockReturnValue({
            agents: mockAgents
        });

        render(
            <ConfigProvider>
                <AccountFormModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={onSaveMock}
                    initial={{
                        type: 'valkey-broker',
                        name: 'Test Valkey Broker',
                        serverId: 'server-1',
                        serviceId: 'service-1',
                        agentId: 'agent-1',
                        channelPattern: 'events:*'
                    } as any}
                />
            </ConfigProvider>
        );

        const submitButton = screen.getByRole('button', { name: /Save Changes|Confirm & Create/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(onSaveMock).toHaveBeenCalled();
        });
        
        const savedData = onSaveMock.mock.calls[0][0];

        expect(savedData.channelPattern).toBe('events:*');
    });
});
