import { useState } from 'react';
import { 
    Modal, 
    Button, 
    Space, 
    Typography, 
    theme, 
    Alert, 
    Divider, 
    Card, 
    Badge 
} from 'antd';
import { 
    SettingOutlined, 
    SafetyOutlined, 
    CheckOutlined, 
    LoadingOutlined 
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAgents } from '../../hooks/useAgents';

const { Text } = Typography;

interface ServerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
}

export function ServerSettingsModal({ isOpen, onClose, agentId, agentName }: ServerSettingsModalProps) {
    const { token: authToken } = useAuth();
    const { agents } = useAgents();
    const [switchingFw, setSwitchingFw] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { token } = theme.useToken();

    const agent = agents.find(a => a.id === agentId);
    if (!agent) return null;

    const firewalls = agent.services?.filter((s: any) => 
        ['ufw', 'firewalld', 'iptables', 'nftables'].includes(s.name)
    ) || [];

    const activeFw = firewalls.find((s: any) => 
        (s as { metrics?: { is_active: number } }).metrics?.is_active === 1
    ) || firewalls[0];

    const handleSwitchFirewall = async (engineName: string) => {
        if (engineName === activeFw?.name) return;
        
        setSwitchingFw(true);
        setError(null);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/control`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ 
                    agent_id: agentId, 
                    service: engineName,
                    action: 'firewall_set_active'
                })
            });
            if (!res.ok) throw new Error('Failed to switch firewall engine');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to set active firewall.');
        } finally {
            setSwitchingFw(false);
        }
    };

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
                        <SettingOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>Server Settings</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            Configuring infrastructure policies for {agentName}
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={500}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            <div style={{ marginTop: '24px' }}>
                {error && (
                    <Alert
                        message="Configuration Error"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: '24px', borderRadius: '12px' }}
                    />
                )}

                <Divider orientation={"left" as any} style={{ margin: '0 0 20px 0' }}>
                    <Space>
                        <SafetyOutlined style={{ fontSize: '12px', opacity: 0.3 }} />
                        <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Firewall Engine</Text>
                    </Space>
                </Divider>

                <div style={{ marginBottom: '24px' }}>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '16px' }}>
                        Select which firewall engine should be active. Only one can be primary at a time.
                    </Text>

                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {firewalls.length === 0 ? (
                            <Card 
                                style={{ textAlign: 'center', borderRadius: '16px', borderStyle: 'dashed' }}
                                bodyStyle={{ padding: '32px' }}
                            >
                                <Text type="secondary" italic>No firewall engines detected on this server.</Text>
                            </Card>
                        ) : (
                            firewalls.map((fw: any) => {
                                const isActive = fw.name === activeFw?.name;
                                return (
                                    <Card 
                                        key={fw.name}
                                        hoverable={!isActive && !switchingFw}
                                        onClick={() => handleSwitchFirewall(fw.name)}
                                        style={{ 
                                            borderRadius: '16px', 
                                            border: isActive ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                                            backgroundColor: isActive ? `${token.colorPrimary}05` : token.colorFillAlter,
                                            cursor: isActive || switchingFw ? 'default' : 'pointer'
                                        }}
                                        bodyStyle={{ padding: '16px 20px' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Space size="middle">
                                                <Badge status={fw.status === 'running' ? 'success' : 'default'} />
                                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '13px' }}>{fw.name}</Text>
                                            </Space>
                                            
                                            <div>
                                                {isActive && <CheckOutlined style={{ color: token.colorPrimary, fontSize: '16px' }} />}
                                                {switchingFw && !isActive && <LoadingOutlined style={{ opacity: 0.4 }} />}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </Space>
                </div>

                <div style={{ 
                    marginTop: '32px', 
                    paddingTop: '16px', 
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <Button onClick={onClose} style={{ borderRadius: '8px', padding: '0 24px' }}>Close</Button>
                </div>
            </div>
        </Modal>
    );
}
