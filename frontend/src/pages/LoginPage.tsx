import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Layout,
    Card,
    Form,
    Input,
    Button,
    Typography,
    theme,
    Alert,
    Space,
    Badge
} from 'antd';
import {
    UserOutlined,
    LockOutlined,
    SafetyOutlined,
    RocketOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';

const { Content } = Layout;
const { Title, Text } = Typography;

export function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = theme.useToken();

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            const state = location.state as { from?: { pathname: string } } | null;
            const from = state?.from?.pathname || "/";
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, location]);

    const onFinish = async (values: any) => {
        setError('');
        setLoading(true);

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg || 'Invalid credentials');
            }

            const data = await res.json();
            if (data.token) {
                login(data.token);
            } else {
                throw new Error('No token received');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: token.colorBgLayout }}>
            <Content style={{ width: '100%', maxWidth: '420px', padding: '16px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: `${token.colorPrimary}10`,
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px auto',
                        border: `1px solid ${token.colorPrimary}30`,
                        transform: 'rotate(5deg)',
                        boxShadow: `0 8px 16px ${token.colorPrimary}15`
                    }}>
                        <SafetyOutlined style={{ fontSize: '40px', color: token.colorPrimary }} />
                    </div>
                    <Title level={1} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.05em' }}>PRISM</Title>
                    <Text type="secondary" style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Universal Fleet Control</Text>
                </div>

                <Card
                    style={{
                        borderRadius: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
                        border: `1px solid ${token.colorBorderSecondary}`
                    }}
                    bodyStyle={{ padding: '40px' }}
                >
                    {error && (
                        <Alert
                            message={error}
                            type="error"
                            showIcon
                            style={{ marginBottom: '24px', borderRadius: '12px' }}
                        />
                    )}

                    {isAuthenticated ? (
                        <Space direction="vertical" align="center" style={{ width: '100%' }} size="large">
                            <Badge status="success">
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    backgroundColor: token.colorSuccessBg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <SafetyCertificateOutlined style={{ fontSize: '32px', color: token.colorSuccess }} />
                                </div>
                            </Badge>
                            <div style={{ textAlign: 'center' }}>
                                <Title level={4} style={{ margin: 0 }}>Verified Access</Title>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Session Active</Text>
                            </div>
                            <Button
                                type="primary"
                                block
                                size="large"
                                onClick={() => navigate('/')}
                                style={{ borderRadius: '12px', height: '48px' }}
                            >
                                Enter Dashboard
                            </Button>
                        </Space>
                    ) : (
                        <Form
                            name="login"
                            layout="vertical"
                            onFinish={onFinish}
                            size="large"
                            requiredMark={false}
                        >
                            <Form.Item
                                name="username"
                                rules={[{ required: true, message: 'Identity missing' }]}
                            >
                                <Input
                                    prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />}
                                    placeholder="Username"
                                    style={{ borderRadius: '12px', height: '54px' }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="password"
                                rules={[{ required: true, message: 'Key absent' }]}
                            >
                                <Input.Password
                                    prefix={<LockOutlined style={{ color: token.colorTextDisabled }} />}
                                    placeholder="Password"
                                    style={{ borderRadius: '12px', height: '54px' }}
                                />
                            </Form.Item>

                            <Form.Item style={{ marginBottom: '16px', marginTop: '32px' }}>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    loading={loading}
                                    style={{
                                        borderRadius: '14px',
                                        height: '56px',
                                        fontWeight: 800,
                                        fontSize: '16px',
                                        boxShadow: `0 8px 20px ${token.colorPrimary}30`
                                    }}
                                >
                                    Sign In
                                </Button>
                            </Form.Item>

                            <div style={{ textAlign: 'center' }}>
                                <Text style={{ fontSize: '10px', fontWeight: 800, color: token.colorTextDisabled, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                    Authorized Personnel Only
                                </Text>
                            </div>
                        </Form>
                    )}
                </Card>

                <div style={{ textAlign: 'center', marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', opacity: 0.4 }}>
                    <RocketOutlined />
                    <Text style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secured by PRISM Core AI</Text>
                </div>
            </Content>
        </Layout>
    );
}

export default LoginPage;
