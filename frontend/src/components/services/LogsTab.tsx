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
import { useWebSocketLogs } from '../../hooks/useWebSocketLogs';

const { Text } = Typography;
const { TextArea } = Input;

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'debug';
    message: string;
    source?: string;
}

interface LogsTabProps {
    agentId: string;
    serviceName: string;
}

export function LogsTab({ agentId, serviceName }: LogsTabProps) {
    const { token } = theme.useToken();
    const [autoScroll, setAutoScroll] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warning' | 'error' | 'debug'>('all');
    const [searchText, setSearchText] = useState('');
    const [tailLines, setTailLines] = useState(100);
    const [displayLogs, setDisplayLogs] = useState<LogEntry[]>([]);
    const textAreaRef = useRef<any>(null);

    // Use real WebSocket for log streaming
    const { logs: apiLogs, connected, error, clearLogs } = useWebSocketLogs(agentId, serviceName, tailLines);

    // Convert API logs to display format
    useEffect(() => {
        const converted = apiLogs.map(log => ({
            timestamp: log.createdAt,
            level: (log.status === 'error' ? 'error' : log.status === 'warning' ? 'warning' : 'info') as 'info' | 'warning' | 'error' | 'debug',
            message: log.message,
            source: log.service
        }));
        setDisplayLogs(converted);
    }, [apiLogs]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && !isPaused && textAreaRef.current) {
            textAreaRef.current.scrollTop = textAreaRef.current.scrollHeight;
        }
    }, [displayLogs, autoScroll, isPaused]);

    const filteredLogs = displayLogs.filter(log => {
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
        const content = displayLogs.map(formatLogLine).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${serviceName}-${new Date().toISOString()}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        clearLogs();
        setDisplayLogs([]);
    };

    return (
        <div style={{ padding: `${token.paddingSM}px 0` }}>
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
                    styles={{ body: { padding: 0 } }}
                >
                    <TextArea
                        ref={textAreaRef}
                        value={filteredLogs.map(formatLogLine).join('\n')}
                        readOnly
                        style={{
                            height: 500,
                            fontFamily: 'monospace',
                            fontSize: token.fontSizeSM,
                            backgroundColor: 'transparent',
                            color: token.colorTextQuaternary,
                            border: 'none',
                            resize: 'none'
                        }}
                    />
                </Card>

                {/* Status bar */}
                <Card style={{ borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Space>
                            <Badge status={isPaused ? 'warning' : connected ? 'processing' : 'error'} text={isPaused ? 'Paused' : connected ? 'Live' : 'Disconnected'} />
                            <Text type="secondary">
                                Showing {filteredLogs.length} of {displayLogs.length} logs
                            </Text>
                            {error && <Text type="danger">{error}</Text>}
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
                    description={connected ? "Logs are streamed in real-time from the agent. Use filters to find specific entries. Download to save for analysis." : "Connecting to log stream..."}
                    type={connected ? "info" : "warning"}
                    showIcon
                    style={{ borderRadius: 8 }}
                />
            </Space>
        </div>
    );
}
