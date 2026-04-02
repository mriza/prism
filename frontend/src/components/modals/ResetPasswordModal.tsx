import { useState } from 'react';
import {
    Modal,
    Form,
    Input,
    Typography,
    theme,
    Button,
    Alert
} from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import type { User } from '../../types';

const { Text } = Typography;

interface Props {
    isOpen: boolean;
    user: User | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function ResetPasswordModal({ isOpen, user, onClose, onSuccess }: Props) {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (values: any) => {
        setLoading(true);
        setError('');
        
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/users/${user?.id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    newPassword: values.newPassword
                })
            });

            if (!res.ok) {
                const errorData = await res.text();
                throw new Error(errorData || 'Failed to reset password');
            }

            form.resetFields();
            onSuccess();
            onClose();
            
        } catch (err: any) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onCancel={() => {
                form.resetFields();
                setError('');
                onClose();
            }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                    <div style={{
                        padding: token.paddingXS,
                        borderRadius: token.borderRadius,
                        backgroundColor: `${token.colorWarning}15`,
                        color: token.colorWarning
                    }}>
                        <KeyOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>Reset Password</Text>
                        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                            Reset password for: <strong>{user?.username}</strong>
                        </div>
                    </div>
                </div>
            }
            footer={null}
            width={500}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                style={{ marginTop: token.marginLG }}
                autoComplete="off"
            >
                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: token.marginSM }}
                    />
                )}

                <Alert
                    message="Admin Action"
                    description="This will reset the user's password. The user will need to use the new password on their next login."
                    type="warning"
                    showIcon
                    style={{ marginBottom: token.marginSM }}
                />

                <Form.Item
                    name="newPassword"
                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>New Password</Text>}
                    rules={[
                        { required: true, message: 'Please enter a new password' },
                        { min: 8, message: 'Password must be at least 8 characters' }
                    ]}
                    extra="Password must be at least 8 characters long"
                >
                    <Input.Password 
                        placeholder="Enter new password" 
                        style={{ borderRadius: token.borderRadius }}
                        size="large"
                    />
                </Form.Item>

                <Form.Item
                    name="confirmPassword"
                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Confirm New Password</Text>}
                    dependencies={['newPassword']}
                    rules={[
                        { required: true, message: 'Please confirm your new password' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('newPassword') === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error('The two passwords do not match'));
                            },
                        }),
                    ]}
                >
                    <Input.Password 
                        placeholder="Confirm new password" 
                        style={{ borderRadius: token.borderRadius }}
                        size="large"
                    />
                </Form.Item>

                <div style={{
                    marginTop: `${token.marginLG}px`,
                    paddingTop: '16px',
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: token.marginSM
                }}>
                    <Button 
                        onClick={() => {
                            form.resetFields();
                            setError('');
                            onClose();
                        }} 
                        style={{ borderRadius: token.borderRadius }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        danger
                        htmlType="submit"
                        loading={loading}
                        style={{ borderRadius: token.borderRadius, fontWeight: token.fontWeightStrong }}
                    >
                        Reset Password
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
