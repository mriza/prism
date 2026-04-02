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
    theme,
    Alert
} from 'antd';
import {
    SearchOutlined,
    PlusOutlined,
    CheckOutlined,
    SearchOutlined as SearchIcon,
    ReloadOutlined
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
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [registering, setRegistering] = useState<string | null>(null);
    const { token } = theme.useToken();

    // Get currently managed processes for this agent to show "registered" state
    const agent = agents.find(a => a.id === agentId);
    const managedProcesses = useMemo(() => agent?.services.map(s => s.name) || [], [agent]);

    useEffect(() => {
        if (isOpen && agentId) {
            setLoading(true);
            setError(null);
            listSystemdUnits(agentId)
                .then(raw => {
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
                })
                .catch(() => {
                    setError('Failed to discover processes. The agent may be offline or unreachable.');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isOpen, agentId, listSystemdUnits]);

    const handleRetry = () => {
        setLoading(true);
        setError(null);
        listSystemdUnits(agentId)
            .then(raw => {
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
            })
            .catch(() => {
                setError('Failed to discover processes. Please try again.');
            })
            .finally(() => {
                setLoading(false);
            });
    };

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
                            <Text strong style={{ fontSize: token.fontSize }}>{name}</Text>
                            {isManaged && <Tag color="success" style={{ fontSize: token.fontSizeSM, fontWeight: token.fontWeightStrong }}>MANAGED</Tag>}
                        </Space>
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontStyle: 'italic' }}>
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
                    text={<Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', opacity: 0.6 }}>{active}</Text>} 
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
                        <div style={{ color: token.colorSuccess, padding: token.paddingXS }}>
                            <CheckOutlined style={{ fontSize: token.fontSizeHeading5 }} />
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
                        style={{ borderRadius: token.borderRadiusSM, fontSize: token.fontSizeSM }}
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
                        padding: token.paddingXS,
                        borderRadius: '10px',
                        backgroundColor: `${token.colorPrimary}15`,
                        color: token.colorPrimary,
                        display: 'flex'
                    }}>
                        <SearchOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>Discover Processes</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM }}>
                            Scanning systemd units on {agentName}
                        </Text>
                    </div>
                </Space>
            }
            footer={[
                <Button key="done" onClick={onClose} style={{ borderRadius: token.borderRadius }}>Done</Button>
            ]}
            width={800}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <div style={{ marginTop: token.paddingLG }}>
                {error && (
                    <Alert
                        message="Discovery Failed"
                        description={error}
                        type="error"
                        showIcon
                        action={
                            <Button
                                size="small"
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={handleRetry}
                                loading={loading}
                            >
                                Retry
                            </Button>
                        }
                        style={{ marginBottom: token.marginLG }}
                    />
                )}

                <div style={{ marginBottom: token.marginLG }}>
                    <Input 
                        prefix={<SearchIcon style={{ opacity: 0.3 }} />} 
                        placeholder="Filter units (e.g. docker, redis, nginx...)" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ 
                            height: 'auto', 
                            borderRadius: token.borderRadiusLG, 
                            fontSize: token.fontSize,
                            backgroundColor: token.colorFillAlter
                        }}
                    />
                </div>

                <div style={{ 
                    borderRadius: token.borderRadiusLG, 
                    overflow: 'hidden', 
                    border: `1px solid ${token.colorBorderSecondary}`,
                    height: '100%',
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
