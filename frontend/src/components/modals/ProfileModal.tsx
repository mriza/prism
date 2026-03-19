import { useState, useEffect } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Space, 
    Typography, 
    theme, 
    Button, 
    Alert, 
    Divider, 
    Row, 
    Col, 
    Spin 
} from 'antd';
import { 
    UserOutlined, 
    SafetyCertificateOutlined, 
    IdcardOutlined, 
    CheckCircleOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { token, user: currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { token: designToken } = theme.useToken();
    const [form] = Form.useForm();

    useEffect(() => {
        if (isOpen) {
            fetchProfile();
        }
    }, [isOpen]);

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch profile');
            const data = await res.json();
            form.setFieldsValue({
                fullName: data.fullName || '',
                email: data.email || '',
                phone: data.phone || '',
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        if (values.password && values.password !== values.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/users/me`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fullName: values.fullName,
                    email: values.email,
                    phone: values.phone,
                    password: values.password || undefined
                })
            });
            if (!res.ok) throw new Error('Failed to update profile');
            
            setSuccess(true);
            form.setFieldsValue({ password: '', confirmPassword: '' });
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
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
                        backgroundColor: `${designToken.colorPrimary}15`, 
                        color: designToken.colorPrimary,
                        display: 'flex'
                    }}>
                        <UserOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>My Profile</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            Manage your personal details and account security settings
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={700}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            {loading ? (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} tip="Loading profile..." />
                </div>
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    style={{ marginTop: '24px' }}
                >
                    {error && (
                        <Alert message={error} type="error" showIcon style={{ marginBottom: '24px', borderRadius: '12px' }} />
                    )}
                    
                    {success && (
                        <Alert 
                            message="Profile updated successfully!" 
                            type="success" 
                            showIcon 
                            icon={<CheckCircleOutlined />}
                            style={{ marginBottom: '24px', borderRadius: '12px' }} 
                        />
                    )}

                    <Row gutter={24}>
                        <Col span={12}>
                            <Divider orientation={'left' as any} style={{ margin: '0 0 20px 0' }}>
                                <Space size={4}>
                                    <IdcardOutlined style={{ fontSize: '12px', opacity: 0.3 }} />
                                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Basic Information</Text>
                                </Space>
                            </Divider>

                            <Form.Item label={<Text strong style={{ fontSize: '12px' }}>Username</Text>}>
                                <Input value={currentUser?.username || ''} disabled style={{ borderRadius: '8px' }} />
                                <Text type="secondary" style={{ fontSize: '11px' }}>Username cannot be changed</Text>
                            </Form.Item>

                            <Form.Item name="fullName" label={<Text strong style={{ fontSize: '12px' }}>Full name</Text>}>
                                <Input placeholder="Your full name" style={{ borderRadius: '8px' }} />
                            </Form.Item>

                            <Form.Item name="email" label={<Text strong style={{ fontSize: '12px' }}>Email address</Text>} rules={[{ type: 'email' }]}>
                                <Input placeholder="email@example.com" style={{ borderRadius: '8px' }} />
                            </Form.Item>

                            <Form.Item name="phone" label={<Text strong style={{ fontSize: '12px' }}>Phone number</Text>}>
                                <Input placeholder="+62..." style={{ borderRadius: '8px' }} />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Divider orientation={'left' as any} style={{ margin: '0 0 20px 0' }}>
                                <Space size={4}>
                                    <SafetyCertificateOutlined style={{ fontSize: '12px', opacity: 0.3 }} />
                                    <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Account Security</Text>
                                </Space>
                            </Divider>

                            <Form.Item 
                                name="password" 
                                label={<Text strong style={{ fontSize: '12px' }}>New password</Text>}
                            >
                                <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
                                <Text type="secondary" style={{ fontSize: '11px' }}>Leave blank to keep current password</Text>
                            </Form.Item>

                            <Form.Item 
                                name="confirmPassword" 
                                label={<Text strong style={{ fontSize: '12px' }}>Confirm password</Text>}
                                dependencies={['password']}
                                rules={[
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('password') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('Passwords do not match'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div style={{ 
                        marginTop: '32px', 
                        paddingTop: '16px', 
                        borderTop: `1px solid ${designToken.colorBorderSecondary}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <Button onClick={onClose} disabled={saving} style={{ borderRadius: '8px' }}>Cancel</Button>
                        <Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: '8px', fontWeight: 600 }}>
                            Save Changes
                        </Button>
                    </div>
                </Form>
            )}
        </Modal>
    );
}
