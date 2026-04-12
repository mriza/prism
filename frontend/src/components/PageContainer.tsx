/**
 * PageContainer - Consistent Page Wrapper
 * 
 * Features:
 * - Consistent padding and spacing
 * - Optional page header with title & description
 * - Optional action buttons in header
 * - Full theme support
 * - Responsive layout
 */

import type { ReactNode } from 'react';
import { Typography, Space, Divider, theme as antdTheme } from 'antd';

const { Title, Text } = Typography;

interface PageContainerProps {
    /** Page title */
    title?: string;
    /** Page description/subtitle */
    description?: string;
    /** Action buttons to display in header */
    extra?: ReactNode;
    /** Page content - usually the page component itself */
    children: ReactNode;
    /** Additional CSS class */
    className?: string;
    /** Show/hide page header */
    showHeader?: boolean;
    /** Full width content */
    fullWidth?: boolean;
}

export function PageContainer({
    title,
    description,
    extra,
    children,
    className = '',
    showHeader = true,
    fullWidth = false
}: PageContainerProps) {
    const { token } = antdTheme.useToken();

    return (
        <div className={className}>
            {/* Page Header */}
            {showHeader && (title || description || extra) && (
                <div
                    style={{
                        marginBottom: token.marginLG,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: token.marginSM
                    }}
                >
                    {/* Title & Description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {title && (
                            <Title
                                level={3}
                                style={{
                                    margin: 0,
                                    fontWeight: token.fontWeightStrong,
                                    color: token.colorText,
                                    lineHeight: '1.3'
                                }}
                            >
                                {title}
                            </Title>
                        )}
                        {description && (
                            <Text
                                type="secondary"
                                style={{
                                    display: 'block',
                                    marginTop: token.marginXS,
                                    fontSize: token.fontSize
                                }}
                            >
                                {description}
                            </Text>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {extra && (
                        <Space
                            size="middle"
                            style={{
                                flexShrink: 0,
                                marginLeft: token.marginSM
                            }}
                        >
                            {extra}
                        </Space>
                    )}
                </div>
            )}

            {showHeader && (title || description) && <Divider style={{ marginTop: 0 }} />}

            {/* Page Content */}
            <div
                style={{
                    maxWidth: fullWidth ? 'none' : 1600,
                    width: '100%'
                }}
            >
                {children}
            </div>
        </div>
    );
}

/**
 * ContentCard - Consistent card wrapper for page sections
 */
export function ContentCard({
    title,
    extra,
    children,
    style = {}
}: {
    title?: string;
    extra?: ReactNode;
    children: ReactNode;
    style?: React.CSSProperties;
}) {
    const { token } = antdTheme.useToken();

    return (
        <div
            style={{
                background: token.colorBgContainer,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
                marginBottom: token.marginLG,
                ...style
            }}
        >
            {title && (
                <div
                    style={{
                        padding: `${token.paddingSM}px ${token.paddingLG}px`,
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <Text strong style={{ fontSize: token.fontSizeLG }}>
                        {title}
                    </Text>
                    {extra && <Space size="small">{extra}</Space>}
                </div>
            )}
            <div style={{ padding: title ? `${token.paddingLG}px` : 0 }}>
                {children}
            </div>
        </div>
    );
}

/**
 * StatCard - Small stat display card
 */
export function StatCard({
    icon,
    title,
    value,
    suffix,
    trend,
    onClick
}: {
    icon: ReactNode;
    title: string;
    value: string | number;
    suffix?: string;
    trend?: 'up' | 'down' | 'stable';
    onClick?: () => void;
}) {
    const { token } = antdTheme.useToken();

    const trendColor = trend === 'up' ? token.colorSuccess : 
                       trend === 'down' ? token.colorError : 
                       token.colorTextSecondary;

    return (
        <div
            onClick={onClick}
            style={{
                background: token.colorBgContainer,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
                padding: token.paddingLG,
                cursor: onClick ? 'pointer' : 'default',
                transition: `all ${token.motionDurationFast} ${token.motionEaseInOut}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: token.marginSM
            }}
        >
            <div
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: token.borderRadiusLG,
                    background: token.colorPrimaryBg,
                    color: token.colorPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: token.fontSizeXL,
                    flexShrink: 0
                }}
            >
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {title}
                </Text>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: token.marginXS,
                        marginTop: token.marginXS
                    }}
                >
                    <Title
                        level={2}
                        style={{ margin: 0, fontWeight: token.fontWeightStrong }}
                    >
                        {value}
                    </Title>
                    {suffix && (
                        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                            {suffix}
                        </Text>
                    )}
                    {trend && (
                        <Text
                            style={{
                                color: trendColor,
                                fontSize: token.fontSizeSM,
                                fontWeight: token.fontWeightStrong
                            }}
                        >
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                        </Text>
                    )}
                </div>
            </div>
        </div>
    );
}
