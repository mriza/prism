import React from 'react';
import { Typography, Breadcrumb, Space, theme } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;

interface PageContainerProps {
    title: string;
    description?: string;
    extra?: React.ReactNode;
    children: React.ReactNode;
    breadcrumb?: { title: React.ReactNode; href?: string; onClick?: () => void }[];
}

export function PageContainer({ title, description, extra, children, breadcrumb }: PageContainerProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { token } = theme.useToken();

    // Default breadcrumb logic if not provided
    const pathSnippets = location.pathname.split('/').filter((i) => i);
    const defaultBreadcrumb = [
        { title: 'Home', onClick: () => navigate('/') },
        ...pathSnippets.map((_, index) => {
            const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
            const name = pathSnippets[index].charAt(0).toUpperCase() + pathSnippets[index].slice(1);
            return { title: name, onClick: () => navigate(url) };
        }),
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginLG }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: token.marginXS,
                padding: `0 ${token.paddingXXS}px`
            }}>
                <Breadcrumb items={breadcrumb || defaultBreadcrumb} style={{ marginBottom: token.marginXXS }} />
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: token.marginSM
                }}>
                    <div style={{ flex: 1, minWidth: '100%' }}>
                        <Title level={2} style={{ margin: 0, fontWeight: token.fontWeightStrong, letterSpacing: '-0.02em' }}>
                            {title}
                        </Title>
                        {description && (
                            <Text type="secondary" style={{ fontSize: token.fontSize, maxWidth: '100%', display: 'block', marginTop: token.marginXXS }}>
                                {description}
                            </Text>
                        )}
                    </div>
                    {extra && <Space size="middle">{extra}</Space>}
                </div>
            </div>

            <div>
                {children}
            </div>
        </div>
    );
}
