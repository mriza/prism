import { useState } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Select, 
    Space, 
    Typography, 
    theme, 
    Button, 
    Row, 
    Col, 
    Divider 
} from 'antd';
import { UserAddOutlined, IdcardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { User as UserType } from '../../types';

const { Text } = Typography;

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<UserType>) => Promise<boolean>;
    initial?: UserType;
}

export function UserFormModal({ isOpen, onClose, onSave, initial }: UserFormModalProps) {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const { token } = theme.useToken();

    const handleSubmit = async (values: any) => {
        setSaving(true);
        const success = await onSave(values);
        setSaving(false);
        if (success) onClose();
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
                        <UserAddOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '16px' }}>{initial ? 'Edit User' : 'Create New User'}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                            {initial ? `Updating permissions and profile for ${initial.username}` : "Provision a new account with specific access roles"}
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={700}
            style={{ borderRadius: '20px', overflow: 'hidden' }}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={initial ? { ...initial, password: '' } : { role: 'user' }}
                style={{ marginTop: '24px' }}
            >
                <Row gutter={24}>
                    <Col span={12}>
                        <Divider orientation={'left' as any} style={{ margin: '0 0 20px 0' }}>
                            <Space size={4}>
                                <IdcardOutlined style={{ fontSize: '12px', opacity: 0.3 }} />
                                <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Identity & Role</Text>
                            </Space>
                        </Divider>
                        
                        <Form.Item 
                            name="username" 
                            label={<Text strong style={{ fontSize: '12px' }}>Username</Text>} 
                            rules={[{ required: true }]}
                        >
                            <Input placeholder="johndoe" disabled={!!initial} style={{ borderRadius: '8px' }} />
                        </Form.Item>

                        <Form.Item 
                            name="fullName" 
                            label={<Text strong style={{ fontSize: '12px' }}>Full name</Text>}
                        >
                            <Input placeholder="John Doe" style={{ borderRadius: '8px' }} />
                        </Form.Item>

                        <Form.Item 
                            name="role" 
                            label={<Text strong style={{ fontSize: '12px' }}>Access Role</Text>} 
                            rules={[{ required: true }]}
                        >
                            <Select
                                options={[
                                    { value: 'user', label: 'User (Read Only)' },
                                    { value: 'manager', label: 'Manager (Read & Control)' },
                                    { value: 'admin', label: 'Admin (Full Access)' }
                                ]}
                                style={{ borderRadius: '8px' }}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Divider orientation={'left' as any} style={{ margin: '0 0 20px 0' }}>
                            <Space size={4}>
                                <SafetyCertificateOutlined style={{ fontSize: '12px', opacity: 0.3 }} />
                                <Text strong style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Contact & Security</Text>
                            </Space>
                        </Divider>

                        <Form.Item 
                            name="email" 
                            label={<Text strong style={{ fontSize: '12px' }}>Email address</Text>}
                            rules={[{ type: 'email' }]}
                        >
                            <Input placeholder="john@example.com" style={{ borderRadius: '8px' }} />
                        </Form.Item>

                        <Form.Item 
                            name="phone" 
                            label={<Text strong style={{ fontSize: '12px' }}>Phone number</Text>}
                        >
                            <Input placeholder="+62..." style={{ borderRadius: '8px' }} />
                        </Form.Item>

                        <Form.Item 
                            name="password" 
                            label={<Text strong style={{ fontSize: '12px' }}>{initial ? "New password" : "Account password"}</Text>}
                            rules={[{ required: !initial }]}
                            extra={<Text type="secondary" style={{ fontSize: '11px' }}>{initial ? "Leave blank to keep current" : "Required for first-time login"}</Text>}
                        >
                            <Input.Password placeholder="••••••••" style={{ borderRadius: '8px' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <div style={{ 
                    marginTop: '32px', 
                    paddingTop: '16px', 
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <Button onClick={onClose} style={{ borderRadius: '8px' }} disabled={saving}>Cancel</Button>
                    <Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: '8px', fontWeight: 600 }}>
                        {initial ? 'Save Changes' : 'Create User'}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
