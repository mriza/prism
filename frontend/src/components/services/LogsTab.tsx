import { useState, useEffect, useRef } from 'react';
import {
    Input,
    Select,
    Space,
    Typography,
    Card,
    theme,
    Button,
    Switch,
    Badge,
    Alert
} from 'antd';
import {
    SearchOutlined,
    DownloadOutlined,
    ClearOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'debug';
    message: string;
    source?: string;
}

interface LogsTabProps {
    _agentId: string;
    _serviceName: string;
}

export function LogsTab({ _agentId, _serviceName }: LogsTabProps) {
    const { token } = theme.useToken();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warning' | 'error' | 'debug'>('all');
    const [searchText, setSearchText] = useState('');
    const [tailLines, setTailLines] = useState(100);
    const textAreaRef = useRef<any>(null);

    // Mock logs - will be replaced with WebSocket stream
    useEffect(() => {
        const mockLogs: LogEntry[] = [
            { timestamp: new Date().toISOString(), level: 'info', message: `${_serviceName} started successfully` },
            { timestamp: new Date(Date.now() - 1000).toISOString(), level: 'info', message: `Listening on port 3306` },
            { timestamp: new Date(Date.now() - 5000).toISOString(), level: 'warning', message: 'High memory usage detected: 85%' },
            { timestamp: new Date(Date.now() - 10000).toISOString(), level: 'error', message: 'Failed to connect to replica' },
            { timestamp: new Date(Date.now() - 15000).toISOString(), level: 'info', message: 'Connection accepted from 192.168.1.100' },
        ];
        setLogs(mockLogs);
    }, [_agentId, _serviceName]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && !isPaused && textAreaRef.current) {
            textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
        }
    }, [logs, autoScroll, isPaused]);

    const filteredLogs = logs.filter(log => {
        const matchesLevel = logLevel === 'all' || log.level === logLevel;
        const matchesSearch = !searchText || log.message.toLowerCase().includes(searchText.toLowerCase());
        return matchesLevel && matchesSearch;
    });

    const formatLogLine = (log: LogEntry) => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const levelBadge = `[${log.level.toUpperCase()}]`.padEnd(9);
        return `${timestamp} ${levelBadge} ${log.message}`;
    };

    const handleDownload = () => {
        const content = logs.map(formatLogLine).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${_serviceName}-${new Date().toISOString()}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        setLogs([]);
    };

    return (
        <div style={{ padding: '12px 0' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* Controls */}
                <Card style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Space wrap>
                            <Input
                                placeholder="Search logs..."
                                prefix={<SearchOutlined />}
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 250 }}
                                allowClear
                            />
                            <Select
                                value={logLevel}
                                onChange={setLogLevel}
                                style={{ width: 120 }}
                                options={[
                                    { value: 'all', label: 'All Levels' },
                                    { value: 'info', label: 'Info' },
                                    { value: 'warning', label: 'Warning' },
                                    { value: 'error', label: 'Error' },
                                    { value: 'debug', label: 'Debug' }
                                ]}
                            />
                            <Select
                                value={tailLines}
                                onChange={setTailLines}
                                style={{ width: 100 }}
                                options={[
                                    { value: 50, label: '50 lines' },
                                    { value: 100, label: '100 lines' },
                                    { value: 500, label: '500 lines' },
                                    { value: 1000, label: '1000 lines' }
                                ]}
                            />
                        </Space>
                        <Space>
                            <Button
                                type={isPaused ? 'default' : 'primary'}
                                icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                                onClick={() => setIsPaused(!isPaused)}
                            >
                                {isPaused ? 'Resume' : 'Pause'}
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleDownload}
                            >
                                Download
                            </Button>
                            <Button
                                danger
                                icon={<ClearOutlined />}
                                onClick={handleClear}
                            >
                                Clear
                            </Button>
                        </Space>
                    </Space>
                </Card>

                {/* Log viewer */}
                <Card
                    style={{
                        borderRadius: 12,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        backgroundColor: '#1e1e1e'
                    }}
                    bodyStyle={{ padding: 0 }}
                >
                    <TextArea
                        ref={textAreaRef}
                        value={filteredLogs.map(formatLogLine).join('\n')}
                        readOnly
                        style={{
                            height: 500,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            backgroundColor: 'transparent',
                            color: '#d4d4d4',
                            border: 'none',
                            resize: 'none'
                        }}
                    />
                </Card>

                {/* Status bar */}
                <Card style={{ borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Space>
                            <Badge status={isPaused ? 'warning' : 'processing'} text={isPaused ? 'Paused' : 'Live'} />
                            <Text type="secondary">
                                Showing {filteredLogs.length} of {logs.length} logs
                            </Text>
                        </Space>
                        <Space>
                            <Switch
                                size="small"
                                checked={autoScroll}
                                onChange={setAutoScroll}
                                checkedChildren="Auto-scroll"
                                unCheckedChildren="Auto-scroll"
                            />
                        </Space>
                    </Space>
                </Card>

                {/* Info */}
                <Alert
                    message="Live Log Stream"
                    description="Logs are streamed in real-time from the agent. Use filters to find specific entries. Download to save for analysis."
                    type="info"
                    showIcon
                    style={{ borderRadius: 8 }}
                />
            </Space>
        </div>
    );
}
