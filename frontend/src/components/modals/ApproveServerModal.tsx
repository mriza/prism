import { useState } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Space, 
    Typography, 
    theme, 
    Button, 
    Alert 
} from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useAgents } from '../../hooks/useAgents';

const { Text } = Typography;
const { TextArea } = Input;

interface ApproveServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    hostname: string;
}

export function ApproveServerModal({ isOpen, onClose, agentId, hostname }: ApproveServerModalProps) {
    const { approveAgent } = useAgents();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { token } = theme.useToken();
    const [form] = Form.useForm();

    const handleSubmit = async (values: any) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const success = await approveAgent(agentId, values.name.trim(), values.description?.trim());
            if (success) {
                onClose();
            } else {
                setError('Failed to approve server. Please try again.');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during approval');
        } finally {
            setIsSubmitting(false);
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
                        backgroundColor: `${token.colorSuccess}15`, 
                        color: token.colorSuccess,
                        display: 'flex'
                    }}>
                        <RocketOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>Approve Server</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            Register this new PRISM agent as a managed resource
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={500}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            <div style={{ marginTop: '24px' }}>
                <Alert
                    message={
                        <Text style={{ fontSize: '13px' }}>
                            A new agent was detected on <Text code>{hostname}</Text>. 
                            Provide a display name to register it.
                        </Text>
                    }
                    type="info"
                    style={{ marginBottom: '24px', borderRadius: '12px' }}
                />

                {error && (
                    <Alert
                        message="Approval Failed"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: '24px', borderRadius: '12px' }}
                    />
                )}

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ name: hostname }}
                >
                    <Form.Item
                        name="name"
                        label={<Text strong style={{ fontSize: '12px' }}>Server name</Text>}
                        rules={[{ required: true, message: 'Server name is required' }]}
                    >
                        <Input placeholder="e.g. Production Database" style={{ borderRadius: '8px' }} autoFocus />
                    </Form.Item>
                    
                    <Form.Item
                        name="description"
                        label={<Text strong style={{ fontSize: '12px' }}>Description</Text>}
                    >
                        <TextArea
                            placeholder="Optional details about this server's purpose..."
                            rows={3}
                            style={{ borderRadius: '8px' }}
                        />
                    </Form.Item>
                    
                    <div style={{ 
                        marginTop: '32px', 
                        paddingTop: '16px', 
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <Button onClick={onClose} disabled={isSubmitting} style={{ borderRadius: '8px' }}>Cancel</Button>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={isSubmitting} 
                            style={{ borderRadius: '8px', fontWeight: 600, backgroundColor: token.colorSuccess, borderColor: 'transparent' }}
                        >
                            Approve Server
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
