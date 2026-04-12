import { useState, useEffect } from 'react';
import {
    Space,
    Typography,
    Card,
    theme,
    Button,
    Alert,
    Spin,
    Input
} from 'antd';
import {
    ReloadOutlined,
    SaveOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { handleError } from '../../utils/log';

const { Text } = Typography;
const { TextArea } = Input;

interface ConfigurationTabProps {
    agentId: string;
    serviceName: string;
    serviceType: string;
}

export function ConfigurationTab({ agentId, serviceName }: ConfigurationTabProps) {
    const { token } = theme.useToken();
    const { token: authToken } = useAuth();
    const apiBase = import.meta.env.VITE_API_URL || '';

    const [configContent, setConfigContent] = useState('');
    const [editedContent, setEditedContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [unsupported, setUnsupported] = useState(false);

    const sendConfigCommand = async (action: string, options: Record<string, unknown> = {}) => {
        const res = await fetch(`${apiBase}/api/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ agent_id: agentId, service: serviceName, action, options })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || 'Command failed');
        }
        return res.json();
    };

    const fetchConfig = async () => {
        setLoading(true);
        setError(null);
        setUnsupported(false);
        try {
            const data = await sendConfigCommand('service_get_config');
            const content = data?.message ?? '';
            setConfigContent(content);
            setEditedContent(content);
        } catch (err: any) {
            const msg = String(err.message || err);
            if (msg.includes('does not support configuration')) {
                setUnsupported(true);
            } else {
                handleError(() => { throw err; }, msg, { showToast: false });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [agentId, serviceName]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await sendConfigCommand('service_update_config', { content: editedContent });
            setConfigContent(editedContent);
            setSuccessMsg('Configuration saved. Restart the service to apply changes.');
        } catch (err: any) {
            handleError(() => { throw err; }, String(err.message || err), { 
                showToast: false,
                onError: () => setError(String(err.message || err))
            });
        } finally {
            setSaving(false);
        }
    };

    const isDirty = editedContent !== configContent;

    if (unsupported) {
        return (
            <Alert
                message="Configuration not available"
                description={`The ${serviceName} service does not expose its configuration file through the agent.`}
                type="warning"
                showIcon
                style={{ margin: `${token.marginMD}px 0`, borderRadius: token.borderRadius }}
            />
        );
    }

    return (
        <div style={{ padding: `${token.paddingSM}px 0` }}>
            <Alert
                message={<Space><SettingOutlined /><Text strong>Configuration File</Text></Space>}
                description="Edit the service configuration file directly. Restart the service after saving to apply changes."
                type="info"
                showIcon
                style={{ marginBottom: token.marginMD, borderRadius: token.borderRadius }}
            />

            {error && (
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    closable
                    onClose={() => setError(null)}
                    style={{ marginBottom: token.marginMD, borderRadius: token.borderRadius }}
                />
            )}
            {successMsg && (
                <Alert
                    message={successMsg}
                    type="success"
                    showIcon
                    closable
                    onClose={() => setSuccessMsg(null)}
                    style={{ marginBottom: token.marginMD, borderRadius: token.borderRadius }}
                />
            )}

            <Card
                title={
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontFamily: 'monospace' }}>
                        {serviceName} — config file
                    </Text>
                }
                extra={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={fetchConfig}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            size="small"
                            onClick={handleSave}
                            loading={saving}
                            disabled={!isDirty || loading}
                        >
                            Save
                        </Button>
                    </Space>
                }
                style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                styles={{ body: { padding: 0 } }}
            >
                {loading ? (
                    <div style={{ padding: token.paddingXL, textAlign: 'center' }}>
                        <Spin tip="Loading configuration..." />
                    </div>
                ) : (
                    <TextArea
                        value={editedContent}
                        onChange={e => setEditedContent(e.target.value)}
                        autoSize={{ minRows: 15, maxRows: 40 }}
                        style={{
                            fontFamily: 'monospace',
                            fontSize: token.fontSizeSM,
                            borderRadius: 0,
                            border: 'none',
                            resize: 'vertical',
                            backgroundColor: token.colorFillAlter,
                        }}
                    />
                )}
            </Card>
        </div>
    );
}
