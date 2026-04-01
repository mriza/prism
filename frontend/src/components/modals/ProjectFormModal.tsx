import { useState } from 'react';
import { 
    Modal, 
    Form, 
    Input, 
    Space, 
    Typography,
    theme,
    Button
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { Project } from '../../types';
import { PROJECT_COLORS } from '../../types';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Project, 'id' | 'createdAt'>) => void;
    initial?: Project;
}

export function ProjectFormModal({ isOpen, onClose, onSave, initial }: Props) {
    const [form] = Form.useForm();
    const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0]);
    const { token } = theme.useToken();

    const handleSave = (values: any) => {
        onSave({ 
            name: values.name.trim(), 
            description: values.description?.trim() || undefined, 
            color 
        });
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            title={
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: token.fontSizeHeading5 }}>{initial ? 'Edit Project' : 'New Project'}</Text>
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM, fontWeight: 400 }}>
                        {initial ? "Update project details and appearance" : "Create a new container to organize your service accounts and infrastructure"}
                    </Text>
                </Space>
            }
            footer={null}
            width={500}
            style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden' }}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={{
                    name: initial?.name ?? '',
                    description: initial?.description ?? ''
                }}
                style={{ marginTop: token.marginLG }}
            >
                <Form.Item
                    name="name"
                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Project name</Text>}
                    rules={[{ required: true, message: 'Please input project name!' }]}
                >
                    <Input placeholder="e.g. E-Commerce Platform" style={{ borderRadius: token.borderRadius }} autoFocus />
                </Form.Item>

                <Form.Item
                    name="description"
                    label={<Text strong style={{ fontSize: token.fontSizeSM }}>Description</Text>}
                >
                    <TextArea placeholder="What is this project about?" rows={3} style={{ borderRadius: token.borderRadius }} />
                </Form.Item>

                <Form.Item label={<Text strong style={{ fontSize: token.fontSizeSM }}>Project color</Text>}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginSM, paddingTop: token.paddingXS }}>
                        {PROJECT_COLORS.map(c => {
                            const isSelected = color === c;
                            // Map color names to actual Ant Design token values
                            const colorValue = c === 'primary' ? token.colorPrimary :
                                             c === 'secondary' ? token.colorLink :
                                             c === 'accent' ? token.colorWarning :
                                             c === 'info' ? token.colorInfo :
                                             c === 'success' ? token.colorSuccess :
                                             c === 'warning' ? token.colorWarning :
                                             c === 'error' ? token.colorError :
                                             token.colorTextSecondary;
                            
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        backgroundColor: colorValue,
                                        border: isSelected ? `2px solid ${token.colorPrimary}` : '2px solid transparent',
                                        outline: isSelected ? `2px solid ${token.colorPrimary}40` : 'none',
                                        outlineOffset: '2px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        padding: 0,
                                        boxShadow: token.boxShadowTertiary
                                    }}
                                >
                                    {isSelected && <CheckOutlined style={{ color: '#fff', fontSize: token.fontSizeSM }} />}
                                </button>
                            );
                        })}
                    </div>
                </Form.Item>

                <div style={{
                    marginTop: token.marginLG,
                    paddingTop: token.padding,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: token.marginSM
                }}>
                    <Button onClick={onClose} style={{ borderRadius: token.borderRadius }}>Cancel</Button>
                    <Button type="primary" htmlType="submit" style={{ borderRadius: token.borderRadius, fontWeight: 600 }}>
                        {initial ? 'Save Changes' : 'Create Project'}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
