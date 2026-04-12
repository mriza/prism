import { useState, useEffect } from 'react';
import {
    Modal,
    Steps,
    Button,
    Typography,
    Space,
    Card,
    Alert,
    Tag,
    theme,
    Spin,
    message,
    Descriptions
} from 'antd';
import {
    DownloadOutlined,
    CloudServerOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    ReloadOutlined,
    KeyOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;

interface AddServerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface EnrollmentKey {
    id: string;
    key: string; // Plain text PSK (only shown once)
    status: string;
    createdAt: string;
    expiresAt: string;
}

interface GitHubRelease {
    tag_name: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
    published_at: string;
}

const REPO_OWNER = 'prism';
const REPO_NAME = 'prism';
const INSTALL_SCRIPT_NAME = 'prism_install_agent.sh';

export function AddServerModal({ isOpen, onClose }: AddServerModalProps) {
    const { token: authToken } = useAuth();
    const { token: themeToken } = theme.useToken();
    const [currentStep, setCurrentStep] = useState(0);
    const [enrollmentKey, setEnrollmentKey] = useState<EnrollmentKey | null>(null);
    const [loading, setLoading] = useState(false);
    const [releaseInfo, setReleaseInfo] = useState<GitHubRelease | null>(null);
    const [fetchingRelease, setFetchingRelease] = useState(false);
    const [hubUrl, setHubUrl] = useState('');

    const apiBase = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
            setEnrollmentKey(null);
            fetchLatestRelease();
            createEnrollmentKey();
            setHubUrl(`${window.location.protocol}//${window.location.host}`);
        }
    }, [isOpen]);

    const fetchLatestRelease = async () => {
        setFetchingRelease(true);
        try {
            // Try to fetch from GitHub public API
            const response = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
            );
            if (response.ok) {
                const data = await response.json();
                setReleaseInfo(data);
            }
        } catch {
            // Silent fail - we'll show fallback instructions
        } finally {
            setFetchingRelease(false);
        }
    };

    const createEnrollmentKey = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${apiBase}/api/enrollment-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    validity_hours: 24 // Key valid for 24 hours
                })
            });

            if (response.ok) {
                const data = await response.json();
                setEnrollmentKey(data);
                message.success('Enrollment key created successfully');
            } else {
                message.error('Failed to create enrollment key');
            }
        } catch {
            message.error('Network error while creating enrollment key');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('Copied to clipboard');
    };

    const getDownloadUrl = () => {
        if (releaseInfo) {
            const asset = releaseInfo.assets.find(a => a.name === INSTALL_SCRIPT_NAME);
            if (asset) return asset.browser_download_url;
        }
        // Fallback to raw GitHub URL
        return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/scripts/${INSTALL_SCRIPT_NAME}`;
    };

    const installCommand = `curl -fsSL ${getDownloadUrl()} -o ${INSTALL_SCRIPT_NAME} && chmod +x ${INSTALL_SCRIPT_NAME} && sudo ./${INSTALL_SCRIPT_NAME}`;

    const registerCommand = `prism-agent register --hub ${hubUrl} --key ${enrollmentKey?.key || '<enrollment-key>'}`;

    const steps = [
        {
            title: 'Download',
            description: 'Download the installer script',
            icon: <DownloadOutlined />
        },
        {
            title: 'Install',
            description: 'Run installer on target server',
            icon: <CloudServerOutlined />
        },
        {
            title: 'Register',
            description: 'Run registration command',
            icon: <KeyOutlined />
        },
        {
            title: 'Complete',
            description: 'Wait for agent to connect',
            icon: <CheckCircleOutlined />
        }
    ];

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <Card
                        title={
                            <Space>
                                <DownloadOutlined />
                                <Text strong>Step 1: Download Installer Script</Text>
                            </Space>
                        }
                        size="small"
                    >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Text>
                                Download the <Text code>{INSTALL_SCRIPT_NAME}</Text> script from the GitHub repository.
                                This script will automatically download the latest agent binary and install it as a systemd service.
                            </Text>

                            {fetchingRelease ? (
                                <Spin tip="Fetching latest release info..." />
                            ) : releaseInfo ? (
                                <Alert
                                    message={`Latest Release: ${releaseInfo.tag_name}`}
                                    description={`Published: ${new Date(releaseInfo.published_at).toLocaleDateString()}`}
                                    type="info"
                                    showIcon
                                />
                            ) : (
                                <Alert
                                    message="Using default branch"
                                    description="Could not fetch latest release info. Using main branch for download link."
                                    type="warning"
                                    showIcon
                                />
                            )}

                            <div style={{
                                backgroundColor: themeToken.colorFillAlter,
                                padding: themeToken.padding,
                                borderRadius: themeToken.borderRadius,
                                fontFamily: 'monospace',
                                fontSize: themeToken.fontSizeSM,
                                position: 'relative'
                            }}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => copyToClipboard(installCommand)}
                                    style={{ position: 'absolute', top: 8, right: 8 }}
                                />
                                <Text code style={{ fontSize: themeToken.fontSizeSM }}>{installCommand}</Text>
                            </div>

                            <Button
                                type="link"
                                href={getDownloadUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                icon={<DownloadOutlined />}
                                block
                            >
                                Download {INSTALL_SCRIPT_NAME} directly
                            </Button>
                        </Space>
                    </Card>
                );

            case 1:
                return (
                    <Card
                        title={
                            <Space>
                                <CloudServerOutlined />
                                <Text strong>Step 2: Install Agent on Target Server</Text>
                            </Space>
                        }
                        size="small"
                    >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Text>
                                SSH into your target server and run the installer script with sudo privileges.
                                The script will:
                            </Text>

                            <ul style={{ paddingLeft: themeToken.paddingLG }}>
                                <li>Download the latest agent binary from GitHub Releases</li>
                                <li>Create a <Text code>prism</Text> system user (if not exists)</li>
                                <li>Install the agent as a systemd service</li>
                                <li>Enable and start the service automatically</li>
                            </ul>

                            <Alert
                                message="Requirements"
                                description={
                                    <ul style={{ margin: 0, paddingLeft: themeToken.paddingLG }}>
                                        <li>Linux-based OS (systemd required)</li>
                                        <li>Internet access to download binary</li>
                                        <li>Sudo privileges to install service</li>
                                    </ul>
                                }
                                type="info"
                                showIcon
                            />

                            <Text type="secondary">
                                After installation, the agent service will start automatically.
                                Click "Next" to proceed with registration.
                            </Text>
                        </Space>
                    </Card>
                );

            case 2:
                return (
                    <Card
                        title={
                            <Space>
                                <KeyOutlined />
                                <Text strong>Step 3: Register Agent with Hub</Text>
                            </Space>
                        }
                        size="small"
                    >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Text>
                                Run the following command on the target server to register the agent with the Hub.
                                This command uses the enrollment key that was created specifically for this registration.
                            </Text>

                            {enrollmentKey ? (
                                <Descriptions size="small" column={1} bordered>
                                    <Descriptions.Item label="Enrollment Key ID">
                                        <Text code>{enrollmentKey.id}</Text>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Status">
                                        <Tag color="green">Active</Tag>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Expires">
                                        {new Date(enrollmentKey.expiresAt).toLocaleString()}
                                    </Descriptions.Item>
                                </Descriptions>
                            ) : (
                                <Spin />
                            )}

                            <div style={{
                                backgroundColor: themeToken.colorFillAlter,
                                padding: themeToken.padding,
                                borderRadius: themeToken.borderRadius,
                                fontFamily: 'monospace',
                                fontSize: themeToken.fontSizeSM,
                                position: 'relative'
                            }}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => copyToClipboard(registerCommand)}
                                    style={{ position: 'absolute', top: 8, right: 8 }}
                                />
                                <Text code style={{ fontSize: themeToken.fontSizeSM }}>{registerCommand}</Text>
                            </div>

                            <Alert
                                message="One-Time Use"
                                description="This enrollment key can only be used once. After registration, it will be marked as used and cannot be reused."
                                type="warning"
                                showIcon
                            />
                        </Space>
                    </Card>
                );

            case 3:
                return (
                    <Card
                        title={
                            <Space>
                                <CheckCircleOutlined />
                                <Text strong>Step 4: Wait for Connection</Text>
                            </Space>
                        }
                        size="small"
                    >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Text>
                                The agent will automatically connect to the Hub after registration.
                                You should see the new server appear in the Servers list within a few seconds.
                            </Text>

                            <Alert
                                message="What happens next?"
                                description={
                                    <ol style={{ margin: 0, paddingLeft: themeToken.paddingLG }}>
                                        <li>Agent establishes WebSocket connection to Hub</li>
                                        <li>Hub validates the enrollment key</li>
                                        <li>Agent sends system information and service list</li>
                                        <li>Server appears in the Active Fleet list</li>
                                        <li>You can now manage services on this server</li>
                                    </ol>
                                }
                                type="success"
                                showIcon
                            />

                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => {
                                    message.info('Refresh the page to see the new server');
                                    onClose();
                                }}
                                block
                            >
                                Close & Refresh Server List
                            </Button>
                        </Space>
                    </Card>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <CloudServerOutlined />
                    <Text strong>Add New Server to Fleet</Text>
                </Space>
            }
            open={isOpen}
            onCancel={onClose}
            width={700}
            footer={
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Button
                        disabled={currentStep === 0}
                        onClick={() => setCurrentStep(currentStep - 1)}
                    >
                        Previous
                    </Button>
                    <Space>
                        {currentStep === 2 && (
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={createEnrollmentKey}
                                loading={loading}
                            >
                                Regenerate Key
                            </Button>
                        )}
                        {currentStep < 3 && (
                            <Button
                                type="primary"
                                onClick={() => setCurrentStep(currentStep + 1)}
                            >
                                Next
                            </Button>
                        )}
                    </Space>
                </Space>
            }
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Steps
                    current={currentStep}
                    items={steps.map(s => ({
                        title: s.title,
                        description: s.description,
                        icon: s.icon
                    }))}
                    size="small"
                />

                {loading ? (
                    <div style={{ textAlign: 'center', padding: themeToken.paddingXL * 2 }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    renderStepContent()
                )}
            </Space>
        </Modal>
    );
}
