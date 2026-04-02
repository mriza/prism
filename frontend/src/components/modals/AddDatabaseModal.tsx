import { useState } from 'react';
import {
    Modal,
    Form,
    Input,
    Select,
    Typography,
    theme,
    Button,
    Row,
    Col,
    Alert,
    Space
} from 'antd';
import type { ServiceAccount } from '../../types';

const { Text } = Typography;

interface Props {
    isOpen: boolean;
    account: ServiceAccount;
    onClose: () => void;
    onSave: (database: string, role: string) => void;
}

export function AddDatabaseModal({ isOpen, account, onClose, onSave }: Props) {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);

    const handleSave = async (values: any) => {
        setLoading(true);
        try {
            onSave(values.database, values.role);
            form.resetFields();
        } finally {
            setLoading(false);
        }
    };

    const isValkeyNoSQL = account.type === 'valkey-nosql';

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            title={
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: token.fontSizeHeading5 }}>
                        Add Database to {account.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 400 }}>
                        Add a new database to this existing account
                    </Text>
                </Space>
            }
            footer={null}
            width={600}
            style={{ borderRadius: token.paddingLG, overflow: 'hidden' }}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                style={{ marginTop: token.marginLG }}
                initialValues={{ role: account.role || 'readwrite' }}
            >
                <Row gutter={24}>
                    <Col span={24}>
                        <Alert
                            message="Account Information"
                            description={
                                <Space direction="vertical" size={0}>
                                    <Text>Account: <strong>{account.name}</strong></Text>
                                    <Text>Type: <strong>{account.type}</strong></Text>
                                    <Text>Username: <strong>{account.username}</strong></Text>
                                    {account.databases && account.databases.length > 0 && (
                                        <Text>Existing databases: <strong>{account.databases.join(', ')}</strong></Text>
                                    )}
                                </Space>
                            }
                            type="info"
                            showIcon
                            style={{ marginBottom: token.marginLG }}
                        />
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={16}>
                        <Form.Item
                            name="database"
                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Database Name</Text>}
                            rules={[{ required: true, message: 'Please enter database name' }]}
                        >
                            <Input 
                                placeholder={isValkeyNoSQL ? "e.g., db5 or 5" : "e.g., mydb"} 
                                style={{ borderRadius: token.borderRadius }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            name="role"
                            label={<Text strong style={{ fontSize: token.fontSizeSM }}>Role</Text>}
                            rules={[{ required: true, message: 'Please select role' }]}
                        >
                            <Select style={{ borderRadius: token.borderRadius }}>
                                <Select.Option value="read">Read Only</Select.Option>
                                <Select.Option value="readwrite">Read & Write</Select.Option>
                                <Select.Option value="admin">Admin</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={24}>
                        <Alert
                            message="What will happen"
                            description={
                                <ul style={{ margin: 0, paddingLeft: token.paddingLG }}>
                                    <li>A new database will be created on the server</li>
                                    <li>The existing user will be granted {isValkeyNoSQL ? 'access' : 'privileges'} to this database</li>
                                    <li>The account record will be updated with the new database</li>
                                </ul>
                            }
                            type="success"
                            showIcon
                            style={{ marginBottom: token.marginLG }}
                        />
                    </Col>
                </Row>

                <div style={{
                    marginTop: token.marginLG,
                    paddingTop: token.padding,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: token.marginSM
                }}>
                    <Button onClick={onClose} style={{ borderRadius: token.borderRadius }}>Cancel</Button>
                    <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: token.borderRadius, fontWeight: token.fontWeightStrong }}>
                        Add Database
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
