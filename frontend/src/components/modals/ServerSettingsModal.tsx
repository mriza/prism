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
import { log } from '../../utils/log';

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
        // Guard: ensure activeFw exists before attempting comparison
        if (!activeFw || engineName === activeFw.name) return;

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
            log.error('Failed to switch firewall engine', err);
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
                        padding: token.paddingXS, 
                        borderRadius: '10px', 
                        backgroundColor: `${token.colorPrimary}15`, 
                        color: token.colorPrimary,
                        display: 'flex'
                    }}>
                        <SettingOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>Server Settings</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM }}>
                            Configuring infrastructure policies for {agentName}
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={500}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <div style={{ marginTop: token.paddingLG }}>
                {error && (
                    <Alert
                        message="Configuration Error"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
                    />
                )}

                <Divider titlePlacement="left" style={{ margin: '0 0 20px 0' }}>
                    <Space>
                        <SafetyOutlined style={{ fontSize: token.fontSizeSM, opacity: 0.3 }} />
                        <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Firewall Engine</Text>
                    </Space>
                </Divider>

                <div style={{ marginBottom: token.marginLG }}>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: token.marginSM }}>
                        Select which firewall engine should be active. Only one can be primary at a time.
                    </Text>

                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {firewalls.length === 0 ? (
                            <Card 
                                style={{ textAlign: 'center', borderRadius: token.borderRadiusLG, borderStyle: 'dashed' }}
                                styles={{ body: { padding: token.marginLG } }}
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
                                            borderRadius: token.borderRadiusLG, 
                                            border: isActive ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                                            backgroundColor: isActive ? `${token.colorPrimary}05` : token.colorFillAlter,
                                            cursor: isActive || switchingFw ? 'default' : 'pointer'
                                        }}
                                        styles={{ body: { padding: '16px 20px' } }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Space size="middle">
                                                <Badge status={fw.status === 'running' ? 'success' : 'default'} />
                                                <Text strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: token.fontSize }}>{fw.name}</Text>
                                            </Space>
                                            
                                            <div>
                                                {isActive && <CheckOutlined style={{ color: token.colorPrimary, fontSize: token.fontSizeHeading5 }} />}
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
                    marginTop: token.marginLG, 
                    paddingTop: token.padding, 
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <Button onClick={onClose} style={{ borderRadius: token.borderRadius, padding: '0 24px' }}>Close</Button>
                </div>
            </div>
        </Modal>
    );
}
