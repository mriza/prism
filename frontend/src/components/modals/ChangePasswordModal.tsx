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
import { LockOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: Props) {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const authToken = localStorage.getItem('token');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (values: any) => {
        setLoading(true);
        setError('');
        
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/users/me/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword
                })
            });

            if (!res.ok) {
                const errorData = await res.text();
                throw new Error(errorData || 'Failed to change password');
            }

            form.resetFields();
            onClose();
            
            // Force re-login after password change
            setTimeout(() => {
                alert('Password changed successfully! Please login again with your new password.');
                window.location.href = '/login';
            }, 500);
            
        } catch (err: any) {
            setError(err.message || 'Failed to change password');
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
                        backgroundColor: `${token.colorPrimary}15`,
                        color: token.colorPrimary
                    }}>
                        <LockOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>Change Password</Text>
                        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                            Update your password securely
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

                <Form.Item
                    name="currentPassword"
                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Current Password</Text>}
                    rules={[
                        { required: true, message: 'Please enter your current password' }
                    ]}
                >
                    <Input.Password 
                        placeholder="Enter current password" 
                        style={{ borderRadius: token.borderRadius }}
                        size="large"
                    />
                </Form.Item>

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
                        htmlType="submit" 
                        loading={loading}
                        style={{ borderRadius: token.borderRadius, fontWeight: 600 }}
                    >
                        Change Password
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
