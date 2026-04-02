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
    LoadingOutlined,
    LockOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';

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
    const { token: themeToken } = theme.useToken();
    const [form] = Form.useForm();
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);

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
                        padding: themeToken.paddingXS, 
                        borderRadius: '10px', 
                        backgroundColor: `${themeToken.colorPrimary}15`, 
                        color: themeToken.colorPrimary,
                        display: 'flex'
                    }}>
                        <UserOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: themeToken.fontSizeHeading5 }}>My Profile</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: themeToken.fontSizeSM }}>
                            Manage your personal details and account security settings
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={700}
            style={{ borderRadius: themeToken.paddingLG, overflow: 'hidden' }}
        >
            {loading ? (
                <div style={{ padding: `${themeToken.paddingXL}px 0`, textAlign: 'center' }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: themeToken.fontSizeHeading3 }} spin />} tip="Loading profile..." />
                </div>
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    style={{ marginTop: themeToken.marginLG }}
                >
                    {error && (
                        <Alert message={error} type="error" showIcon style={{ marginBottom: themeToken.marginLG, borderRadius: themeToken.borderRadiusLG }} />
                    )}
                    
                    {success && (
                        <Alert 
                            message="Profile updated successfully!" 
                            type="success" 
                            showIcon 
                            icon={<CheckCircleOutlined />}
                            style={{ marginBottom: themeToken.marginLG, borderRadius: themeToken.borderRadiusLG }} 
                        />
                    )}

                    <Row gutter={24}>
                        <Col span={12}>
                            <Divider titlePlacement="left" style={{ margin: '0 0 20px 0' }}>
                                <Space size={4}>
                                    <IdcardOutlined style={{ fontSize: themeToken.fontSizeSM, opacity: 0.3 }} />
                                    <Text strong style={{ fontSize: themeToken.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Basic Information</Text>
                                </Space>
                            </Divider>

                            <Form.Item label={<Text strong style={{ fontSize: themeToken.fontSizeSM }}>Username</Text>}>
                                <Input value={currentUser?.username || ''} disabled style={{ borderRadius: themeToken.borderRadius }} />
                                <Text type="secondary" style={{ fontSize: themeToken.fontSizeSM }}>Username cannot be changed</Text>
                            </Form.Item>

                            <Form.Item name="fullName" label={<Text strong style={{ fontSize: themeToken.fontSizeSM }}>Full name</Text>}>
                                <Input placeholder="Your full name" style={{ borderRadius: themeToken.borderRadius }} />
                            </Form.Item>

                            <Form.Item name="email" label={<Text strong style={{ fontSize: themeToken.fontSizeSM }}>Email address</Text>} rules={[{ type: 'email' }]}>
                                <Input placeholder="email@example.com" style={{ borderRadius: themeToken.borderRadius }} />
                            </Form.Item>

                            <Form.Item name="phone" label={<Text strong style={{ fontSize: themeToken.fontSizeSM }}>Phone number</Text>}>
                                <Input placeholder="+62..." style={{ borderRadius: themeToken.borderRadius }} />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Divider titlePlacement="left" style={{ margin: '0 0 20px 0' }}>
                                <Space size={4}>
                                    <SafetyCertificateOutlined style={{ fontSize: themeToken.fontSizeSM, opacity: 0.3 }} />
                                    <Text strong style={{ fontSize: themeToken.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Account Security</Text>
                                </Space>
                            </Divider>

                            <Alert
                                message="To change your password"
                                description="Click the 'Change Password' button below to securely update your password."
                                type="info"
                                showIcon
                                style={{ marginBottom: themeToken.marginSM }}
                            />

                            <Form.Item label={<Text strong style={{ fontSize: themeToken.fontSizeSM }}>Role</Text>}>
                                <Input value={currentUser?.role || ''} disabled style={{ borderRadius: themeToken.borderRadius }} />
                                <Text type="secondary" style={{ fontSize: themeToken.fontSizeSM }}>Contact admin to change role</Text>
                            </Form.Item>
                        </Col>
                    </Row>

                    <div style={{
                        marginTop: themeToken.marginLG,
                        paddingTop: themeToken.padding,
                        borderTop: `1px solid ${themeToken.colorBorderSecondary}`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: themeToken.marginSM
                    }}>
                        <Button onClick={onClose} disabled={saving} style={{ borderRadius: themeToken.borderRadius }}>Cancel</Button>
                        <Button 
                            icon={<LockOutlined />}
                            onClick={() => setChangePasswordOpen(true)}
                            style={{ borderRadius: themeToken.borderRadius }}
                        >
                            Change Password
                        </Button>
                        <Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: themeToken.borderRadius, fontWeight: themeToken.fontWeightStrong }}>
                            Save Changes
                        </Button>
                    </div>
                </Form>
            )}

            <ChangePasswordModal 
                isOpen={changePasswordOpen} 
                onClose={() => setChangePasswordOpen(false)} 
            />
        </Modal>
    );
}
