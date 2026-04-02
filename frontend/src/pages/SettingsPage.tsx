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
            <div className="prism-full-width">
                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size="large" className="prism-full-width">
                            {/* Infrastructure Core */}
                            <Card
                                title={<Space><SettingOutlined /> <Text strong className="prism-statistic-title">Infrastructure Core</Text></Space>}
                                className="prism-card"
                            >
                                <Space direction="vertical" size="large" className="prism-full-width">
                                    <div>
                                        <Text strong className="prism-label" style={{ display: 'block', marginBottom: token.marginXS }}>Hub Endpoint URL</Text>
                                        <Input
                                            defaultValue="http://localhost:65432"
                                            prefix={<GlobalOutlined style={{ color: token.colorTextDisabled }} />}
                                            placeholder="http://api.prism.internal"
                                            size="large"
                                            className="prism-mono-text prism-card"
                                        />
                                        <Paragraph type="secondary" className="prism-font-size-sm" style={{ marginTop: token.marginXXS }}>
                                            The primary API coordinator for all fleet communications.
                                        </Paragraph>
                                    </div>
                                </Space>
                            </Card>
                        </Space>
                    </Col>

                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size="large" className="prism-full-width">
                            {/* Telemetry & Sync */}
                            <Card
                                title={<Space><SyncOutlined /> <Text strong className="prism-statistic-title">Telemetry & Sync</Text></Space>}
                                className="prism-card"
                            >
                                <Space direction="vertical" size="large" className="prism-full-width">
                                    {/* Agent Heartbeat */}
                                    <div className="prism-settings-group" style={{ backgroundColor: token.colorFillAlter }}>
                                        <div className="prism-flex-between" style={{ marginBottom: token.marginSM }}>
                                            <Text strong className="prism-label">Infrastructure Heartbeat</Text>
                                            <Tag color="blue" className="prism-mono-text prism-rounded" style={{ fontWeight: token.fontWeightStrong }}>{config.heartbeatInterval / 1000}s</Tag>
                                        </div>
                                        <Slider
                                            min={5}
                                            max={60}
                                            step={5}
                                            value={config.heartbeatInterval / 1000}
                                            onChange={(val) => updateConfig({ heartbeatInterval: val * 1000 })}
                                        />
                                        <Paragraph type="secondary" className="prism-font-size-sm" style={{ marginTop: token.marginXS, marginBottom: 0, fontStyle: 'italic' }}>
                                            Frequency of agent status reporting. Lower values provide fresher data but increase network overhead.
                                        </Paragraph>
                                    </div>

                                    {/* UI Refresh Rate */}
                                    <div className="prism-settings-group" style={{ backgroundColor: `${token.colorInfoBg}40` }}>
                                        <div className="prism-flex-between" style={{ marginBottom: token.marginSM }}>
                                            <Text strong className="prism-label">UI Refresh Interval</Text>
                                            <Tag color="cyan" className="prism-mono-text prism-rounded" style={{ fontWeight: token.fontWeightStrong }}>{config.uiRefreshRate / 1000}s</Tag>
                                        </div>
                                        <Slider
                                            min={2}
                                            max={30}
                                            step={1}
                                            value={config.uiRefreshRate / 1000}
                                            onChange={(val) => updateConfig({ uiRefreshRate: val * 1000 })}
                                        />
                                        <Paragraph type="secondary" className="prism-font-size-sm" style={{ marginTop: token.marginXS, marginBottom: 0, fontStyle: 'italic' }}>
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
