import React from 'react';
import { Typography, Breadcrumb, Space } from 'antd';
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                padding: '0 4px'
            }}>
                <Breadcrumb items={breadcrumb || defaultBreadcrumb} style={{ marginBottom: '8px' }} />
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                            {title}
                        </Title>
                        {description && (
                            <Text type="secondary" style={{ fontSize: '14px', maxWidth: '600px', display: 'block', marginTop: '4px' }}>
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
