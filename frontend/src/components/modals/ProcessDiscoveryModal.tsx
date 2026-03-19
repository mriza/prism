import { useState, useEffect, useMemo } from 'react';
import { 
    Modal,
    Badge, 
    Tag,
    Table,
    Input,
    Button,
    Space,
    Typography,
    theme
} from 'antd';
import { 
    SearchOutlined, 
    PlusOutlined, 
    CheckOutlined,
    SearchOutlined as SearchIcon
} from '@ant-design/icons';
import { useAgents } from '../../hooks/useAgents';

const { Text } = Typography;

interface ProcessDiscoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
}

interface SystemdUnit {
    name: string;
    load: string;
    active: string;
    sub: string;
    description: string;
}

export function ProcessDiscoveryModal({ isOpen, onClose, agentId, agentName }: ProcessDiscoveryModalProps) {
    const { listSystemdUnits, registerService, agents } = useAgents();
    const [units, setUnits] = useState<SystemdUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [registering, setRegistering] = useState<string | null>(null);
    const { token } = theme.useToken();

    // Get currently managed processes for this agent to show "registered" state
    const agent = agents.find(a => a.id === agentId);
    const managedProcesses = useMemo(() => agent?.services.map(s => s.name) || [], [agent]);

    useEffect(() => {
        if (isOpen && agentId) {
            setLoading(true);
            listSystemdUnits(agentId).then(raw => {
                if (raw) {
                    const lines = raw.split('\n').filter(Boolean);
                    const parsed = lines.map((line: string) => {
                        const parts = line.split(/\s+/);
                        return {
                            name: parts[0],
                            load: parts[1],
                            active: parts[2],
                            sub: parts[3],
                            description: parts.slice(4).join(' ')
                        };
                    });
                    setUnits(parsed);
                }
                setLoading(false);
            });
        }
    }, [isOpen, agentId, listSystemdUnits]);

    const filteredUnits = useMemo(() => {
        return units.filter(u => 
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            u.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [units, searchTerm]);

    const handleRegister = async (unit: SystemdUnit) => {
        const displayName = unit.name.replace(/\.service$/, '');
        setRegistering(unit.name);
        const ok = await registerService(agentId, displayName, 'systemd', displayName);
        if (ok) {
            // Success!
        }
        setRegistering(null);
    };

    const columns = [
        {
            title: 'Unit Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => {
                const isManaged = managedProcesses.includes(name.replace(/\.service$/, ''));
                return (
                    <Space direction="vertical" size={0}>
                        <Space>
                            <Text strong style={{ fontSize: '13px' }}>{name}</Text>
                            {isManaged && <Tag color="success" style={{ fontSize: '9px', fontWeight: 800 }}>MANAGED</Tag>}
                        </Space>
                        <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                            {units.find(u => u.name === name)?.description || 'No description'}
                        </Text>
                    </Space>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'active',
            key: 'active',
            width: 120,
            render: (active: string) => (
                <Badge 
                    status={active === 'active' ? 'success' : 'default'} 
                    text={<Text strong style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>{active}</Text>} 
                />
            )
        },
        {
            title: 'Action',
            key: 'action',
            align: 'right' as const,
            width: 100,
            render: (_: any, unit: SystemdUnit) => {
                const isManaged = managedProcesses.includes(unit.name.replace(/\.service$/, ''));
                if (isManaged) {
                    return (
                        <div style={{ color: token.colorSuccess, padding: '8px' }}>
                            <CheckOutlined style={{ fontSize: '16px' }} />
                        </div>
                    );
                }
                return (
                    <Button 
                        type="primary" 
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleRegister(unit)}
                        loading={registering === unit.name}
                        style={{ borderRadius: '6px', fontSize: '12px' }}
                    >
                        Add
                    </Button>
                );
            }
        }
    ];

    return (
        <Modal 
            open={isOpen} 
            onCancel={onClose} 
            title={
                <Space size="middle">
                    <div style={{ 
                        padding: '8px', 
                        borderRadius: '10px', 
                        backgroundColor: `${token.colorPrimary}15`, 
                        color: token.colorPrimary,
                        display: 'flex'
                    }}>
                        <SearchOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>Discover Processes</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            Scanning systemd units on {agentName}
                        </Text>
                    </div>
                </Space>
            }
            footer={[
                <Button key="done" onClick={onClose} style={{ borderRadius: '8px' }}>Done</Button>
            ]}
            width={800}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            <div style={{ marginTop: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <Input 
                        prefix={<SearchIcon style={{ opacity: 0.3 }} />} 
                        placeholder="Filter units (e.g. docker, redis, nginx...)" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ 
                            height: '48px', 
                            borderRadius: '12px', 
                            fontSize: '14px',
                            backgroundColor: token.colorFillAlter
                        }}
                    />
                </div>

                <div style={{ 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: `1px solid ${token.colorBorderSecondary}`,
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Table 
                        dataSource={filteredUnits}
                        columns={columns}
                        rowKey="name"
                        pagination={false}
                        loading={loading}
                        scroll={{ y: 350 }}
                        size="small"
                        locale={{ emptyText: 'No processes match your search.' }}
                    />
                </div>
            </div>
        </Modal>
    );
}
