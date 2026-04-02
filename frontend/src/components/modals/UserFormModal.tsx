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
    Divider,
    Alert
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
                        padding: token.paddingSM,
                        borderRadius: token.borderRadius,
                        backgroundColor: `${token.colorPrimary}15`,
                        color: token.colorPrimary,
                        display: 'flex'
                    }}>
                        <UserAddOutlined />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: token.fontSizeHeading5 }}>{initial ? 'Edit User' : 'Create New User'}</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM }}>
                            {initial ? `Updating permissions and profile for ${initial.username}` : "Provision a new account with specific access roles"}
                        </Text>
                    </div>
                </Space>
            }
            footer={null}
            width={700}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={initial ? { ...initial, password: '' } : { role: 'user' }}
                style={{ marginTop: token.marginLG }}
            >
                <Row gutter={24}>
                    <Col span={12}>
                        <Divider titlePlacement="left" style={{ margin: `0 0 ${token.marginLG}px 0` }}>
                            <Space size={4}>
                                <IdcardOutlined style={{ fontSize: token.fontSizeSM, opacity: 0.3 }} />
                                <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Identity & Role</Text>
                            </Space>
                        </Divider>

                        <Form.Item
                            name="username"
                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Username</Text>}
                            rules={[{ required: true }]}
                        >
                            <Input placeholder="johndoe" disabled={!!initial} style={{ borderRadius: token.borderRadius }} />
                        </Form.Item>

                        <Form.Item
                            name="fullName"
                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Full name</Text>}
                        >
                            <Input placeholder="John Doe" style={{ borderRadius: token.borderRadius }} />
                        </Form.Item>

                        <Form.Item
                            name="role"
                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Access Role</Text>}
                            rules={[{ required: true }]}
                        >
                            <Select
                                options={[
                                    { value: 'user', label: 'User (Read Only)' },
                                    { value: 'manager', label: 'Manager (Read & Control)' },
                                    { value: 'admin', label: 'Admin (Full Access)' }
                                ]}
                                style={{ borderRadius: token.paddingXS }}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Divider titlePlacement="left" style={{ margin: '0 0 20px 0' }}>
                            <Space size={4}>
                                <SafetyCertificateOutlined style={{ fontSize: token.paddingSM, opacity: 0.3 }} />
                                <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>Contact Information</Text>
                            </Space>
                        </Divider>

                        <Form.Item
                            name="email"
                            label={<Text strong style={{ fontSize: token.paddingSM }}>Email address</Text>}
                            rules={[{ type: 'email' }]}
                        >
                            <Input placeholder="john@example.com" style={{ borderRadius: token.paddingXS }} />
                        </Form.Item>

                        <Form.Item
                            name="phone"
                            label={<Text strong style={{ fontSize: token.paddingSM }}>Phone number</Text>}
                        >
                            <Input placeholder="+62..." style={{ borderRadius: token.paddingXS }} />
                        </Form.Item>

                        {initial && (
                            <Alert
                                message="To reset user password"
                                description="Go to Users page and click the key icon on user card to reset their password."
                                type="info"
                                showIcon
                                style={{ marginBottom: token.padding }}
                            />
                        )}
                    </Col>
                </Row>

                <div style={{ 
                    marginTop: token.marginLG, 
                    paddingTop: token.padding, 
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: token.paddingSM
                }}>
                    <Button onClick={onClose} style={{ borderRadius: token.paddingXS }} disabled={saving}>Cancel</Button>
                    <Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: token.paddingXS, fontWeight: token.fontWeightStrong }}>
                        {initial ? 'Save Changes' : 'Create User'}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
