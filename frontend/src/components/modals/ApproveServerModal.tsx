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
import { handleError } from '../../utils/log';

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

        const success = await handleError(
            async () => {
                const result = await approveAgent(agentId, values.name.trim(), values.description?.trim());
                if (!result) throw new Error('Approval failed');
                return result;
            },
            'Failed to approve server',
            { showToast: false }
        );
        
        if (success) {
            onClose();
        } else {
            setError('Failed to approve server. Please try again.');
        }
        setIsSubmitting(false);
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
                        backgroundColor: `${token.colorSuccess}15`, 
                        color: token.colorSuccess,
                        display: 'flex'
                    }}>
                        <RocketOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>Approve Server</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM }}>
                            Register this new PRISM agent as a managed resource
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={500}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <div style={{ marginTop: token.paddingLG }}>
                <Alert
                    message={
                        <Text style={{ fontSize: token.fontSize }}>
                            A new agent was detected on <Text code>{hostname}</Text>. 
                            Provide a display name to register it.
                        </Text>
                    }
                    type="info"
                    style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
                />

                {error && (
                    <Alert
                        message="Approval Failed"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
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
                        label={<Text strong style={{ fontSize: token.fontSizeSM }}>Server name</Text>}
                        rules={[{ required: true, message: 'Server name is required' }]}
                    >
                        <Input placeholder="e.g. Production Database" style={{ borderRadius: token.borderRadius }} autoFocus />
                    </Form.Item>
                    
                    <Form.Item
                        name="description"
                        label={<Text strong style={{ fontSize: token.fontSizeSM }}>Description</Text>}
                    >
                        <TextArea
                            placeholder="Optional details about this server's purpose..."
                            rows={3}
                            style={{ borderRadius: token.borderRadius }}
                        />
                    </Form.Item>
                    
                    <div style={{ 
                        marginTop: token.marginLG, 
                        paddingTop: token.padding, 
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: token.paddingSM
                    }}>
                        <Button onClick={onClose} disabled={isSubmitting} style={{ borderRadius: token.borderRadius }}>Cancel</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isSubmitting}
                            style={{ borderRadius: token.borderRadius, fontWeight: token.fontWeightStrong, backgroundColor: token.colorSuccess, borderColor: 'transparent' }}
                        >
                            Approve Server
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}
