import { useState } from 'react';
import {
    Space,
    Typography,
    Card,
    theme,
    Descriptions,
    Switch,
    Input,
    Button,
    Alert,
    Divider,
    Tag
} from 'antd';
import {
    SettingOutlined,
    EditOutlined,
    SaveOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface ConfigurationField {
    key: string;
    label: string;
    value: string | number | boolean;
    type: 'string' | 'number' | 'boolean' | 'path' | 'port';
    description: string;
    editable: boolean;
}

interface ConfigurationTabProps {
    _agentId: string;
    _serviceName: string;
    _serviceType: string;
    configFields?: ConfigurationField[];
}

export function ConfigurationTab({ configFields }: ConfigurationTabProps) {
    const { token } = theme.useToken();
    const [editing, setEditing] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, any>>({});

    // Default configuration fields based on service type
    const defaultFields: ConfigurationField[] = configFields || [
        {
            key: 'port',
            label: 'Port',
            value: 3306,
            type: 'port',
            description: 'Port number the service listens on',
            editable: true
        },
        {
            key: 'config_path',
            label: 'Configuration Path',
            value: '/etc/mysql/my.cnf',
            type: 'path',
            description: 'Path to the main configuration file',
            editable: false
        },
        {
            key: 'data_dir',
            label: 'Data Directory',
            value: '/var/lib/mysql',
            type: 'path',
            description: 'Directory where data files are stored',
            editable: false
        },
        {
            key: 'socket',
            label: 'Socket',
            value: '/var/run/mysqld/mysqld.sock',
            type: 'path',
            description: 'Unix socket file path',
            editable: false
        },
        {
            key: 'bind_address',
            label: 'Bind Address',
            value: '0.0.0.0',
            type: 'string',
            description: 'Network address to bind to',
            editable: true
        },
        {
            key: 'max_connections',
            label: 'Max Connections',
            value: 151,
            type: 'number',
            description: 'Maximum number of client connections',
            editable: true
        }
    ];

    const handleEdit = (key: string, currentValue: any) => {
        setEditing(key);
        setValues(prev => ({ ...prev, [key]: currentValue }));
    };

    const handleSave = (key: string) => {
        // TODO: API call to update configuration
        console.log(`Saving ${key} = ${values[key]}`);
        setEditing(null);
    };

    const handleCancel = () => {
        setEditing(null);
    };

    const renderValue = (field: ConfigurationField) => {
        if (editing === field.key) {
            switch (field.type) {
                case 'boolean':
                    return (
                        <Switch
                            checked={values[field.key]}
                            onChange={checked => setValues(prev => ({ ...prev, [field.key]: checked }))}
                        />
                    );
                case 'number':
                    return (
                        <Input
                            type="number"
                            value={values[field.key]}
                            onChange={(e: any) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            style={{ width: 150 }}
                        />
                    );
                default:
                    return (
                        <Input
                            value={values[field.key]}
                            onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            style={{ width: 250 }}
                        />
                    );
            }
        }

        switch (field.type) {
            case 'boolean':
                return <Tag color={field.value ? 'green' : 'default'}>{field.value ? 'Enabled' : 'Disabled'}</Tag>;
            case 'path':
                return <Text code style={{ fontSize: 12 }}>{field.value}</Text>;
            default:
                return <Text strong>{String(field.value)}</Text>;
        }
    };

    return (
        <div style={{ padding: '12px 0' }}>
            <Alert
                message={
                    <Space>
                        <SettingOutlined />
                        <Text strong>Service Configuration</Text>
                    </Space>
                }
                description="View and modify service configuration. Some changes may require service restart."
                type="info"
                showIcon
                style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <Card style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}>
                <Descriptions
                    column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
                    bordered
                    size="middle"
                >
                    {defaultFields.map(field => (
                        <Descriptions.Item
                            key={field.key}
                            label={
                                <Space>
                                    <Text strong style={{ fontSize: 12, textTransform: 'uppercase' }}>
                                        {field.label}
                                    </Text>
                                    {!field.editable && (
                                        <Tag color="default" style={{ fontSize: 10 }}>Read-only</Tag>
                                    )}
                                </Space>
                            }
                        >
                            <Space>
                                {renderValue(field)}
                                {field.editable && editing !== field.key && (
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => handleEdit(field.key, field.value)}
                                    />
                                )}
                                {editing === field.key && (
                                    <Space size="small">
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<SaveOutlined />}
                                            onClick={() => handleSave(field.key)}
                                        />
                                        <Button
                                            size="small"
                                            onClick={handleCancel}
                                        >
                                            Cancel
                                        </Button>
                                    </Space>
                                )}
                            </Space>
                            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                                {field.description}
                            </Paragraph>
                        </Descriptions.Item>
                    ))}
                </Descriptions>
            </Card>

            <Divider />

            <Alert
                message="Configuration Files"
                description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text>Direct configuration file editing is available via API.</Text>
                        <Button icon={<EditOutlined />}>
                            Edit Configuration File
                        </Button>
                    </Space>
                }
                type="warning"
                showIcon
                style={{ borderRadius: 8 }}
            />
        </div>
    );
}
