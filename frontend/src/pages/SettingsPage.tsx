import { useAppConfig } from '../contexts/AppConfigContext';
import { 
    Card, 
    Space, 
    Typography, 
    theme, 
    Row, 
    Col, 
    Input, 
    Slider,
    Tag
} from 'antd';
import {
    SettingOutlined,
    SyncOutlined,
    GlobalOutlined
} from '@ant-design/icons';
import { PageContainer } from '../components/PageContainer';

const { Text, Paragraph } = Typography;

export function SettingsPage() {
    const { config, updateConfig } = useAppConfig();
    const { token } = theme.useToken();

    return (
        <PageContainer
            title="System Settings"
            description="Configure global application logic, infrastructure polling intervals, and service defaults."
        >
            <div style={{ maxWidth: '100%' }}>
                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            {/* Infrastructure Core */}
                            <Card
                                title={<Space><SettingOutlined /> <Text strong style={{ fontSize: token.fontSize, textTransform: 'uppercase', letterSpacing: '1px' }}>Infrastructure Core</Text></Space>}
                                style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                            >
                                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                    <div>
                                        <Text strong style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: token.marginXS }}>Hub Endpoint URL</Text>
                                        <Input
                                            defaultValue="http://localhost:65432"
                                            prefix={<GlobalOutlined style={{ color: token.colorTextDisabled }} />}
                                            placeholder="http://api.prism.internal"
                                            size="large"
                                            style={{ fontFamily: 'monospace', borderRadius: token.borderRadiusLG }}
                                        />
                                        <Text type="secondary" style={{ fontSize: token.fontSizeSM, marginTop: token.marginXXS, display: 'block' }}>
                                            The primary API coordinator for all fleet communications.
                                        </Text>
                                    </div>
                                </Space>
                            </Card>
                        </Space>
                    </Col>

                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            {/* Telemetry & Sync */}
                            <Card
                                title={<Space><SyncOutlined /> <Text strong style={{ fontSize: token.fontSize, textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetry & Sync</Text></Space>}
                                style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
                            >
                                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                    {/* Agent Heartbeat */}
                                    <div style={{ backgroundColor: token.colorFillAlter, padding: token.paddingLG, borderRadius: token.borderRadiusLG }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginSM }}>
                                            <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Infrastructure Heartbeat</Text>
                                            <Tag color="blue" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace', fontWeight: 800 }}>{config.heartbeatInterval / 1000}s</Tag>
                                        </div>
                                        <Slider
                                            min={5}
                                            max={60}
                                            step={5}
                                            value={config.heartbeatInterval / 1000}
                                            onChange={(val) => updateConfig({ heartbeatInterval: val * 1000 })}
                                        />
                                        <Paragraph type="secondary" style={{ fontSize: token.fontSizeSM, marginTop: token.marginXS, marginBottom: 0, fontStyle: 'italic' }}>
                                            Frequency of agent status reporting. Lower values provide fresher data but increase network overhead.
                                        </Paragraph>
                                    </div>

                                    {/* UI Refresh Rate */}
                                    <div style={{ backgroundColor: `${token.colorInfoBg}40`, padding: token.paddingLG, borderRadius: token.borderRadiusLG }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginSM }}>
                                            <Text strong style={{ fontSize: token.fontSizeSM, textTransform: 'uppercase', letterSpacing: '0.05em' }}>UI Refresh Interval</Text>
                                            <Tag color="cyan" style={{ borderRadius: token.borderRadius, fontFamily: 'monospace', fontWeight: 800 }}>{config.uiRefreshRate / 1000}s</Tag>
                                        </div>
                                        <Slider
                                            min={2}
                                            max={30}
                                            step={1}
                                            value={config.uiRefreshRate / 1000}
                                            onChange={(val) => updateConfig({ uiRefreshRate: val * 1000 })}
                                        />
                                        <Paragraph type="secondary" style={{ fontSize: token.fontSizeSM, marginTop: token.marginXS, marginBottom: 0, fontStyle: 'italic' }}>
                                            Frequency of dashboard updates. Controls the visual "freshness" of the current interface.
                                        </Paragraph>
                                    </div>
                                </Space>
                            </Card>

                            
                        </Space>
                    </Col>
                </Row>
            </div>
        </PageContainer>
    );
}

export default SettingsPage;
