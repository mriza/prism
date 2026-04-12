/**
 * BreadcrumbNav - Dynamic Breadcrumb Navigation
 * 
 * Features:
 * - Auto-generated from route
 * - Clickable breadcrumbs
 * - Custom labels for known routes
 * - Fallback for unknown routes
 * - Full theme support
 */

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Breadcrumb, theme as antdTheme } from 'antd';
import {
    HomeOutlined,
    ProjectOutlined,
    AccountBookOutlined,
    AppstoreOutlined,
    CloudServerOutlined,
    SecurityScanOutlined,
    FileTextOutlined,
    TeamOutlined,
    SettingOutlined,
    ThunderboltOutlined,
    SafetyCertificateOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';

interface BreadcrumbItem {
    title: string;
    path?: string;
    icon?: React.ReactNode;
}

// Route to breadcrumb mapping
const routeMap: Record<string, BreadcrumbItem> = {
    '/': { title: 'Dashboard', path: '/', icon: <HomeOutlined /> },
    '/projects': { title: 'Projects', path: '/projects', icon: <ProjectOutlined /> },
    '/accounts': { title: 'Accounts', path: '/accounts', icon: <AccountBookOutlined /> },
    '/applications': { title: 'Applications', path: '/applications', icon: <AppstoreOutlined /> },
    '/servers': { title: 'Servers', path: '/servers', icon: <CloudServerOutlined /> },
    '/security': { title: 'Security', path: '/security', icon: <SecurityScanOutlined /> },
    '/logs': { title: 'Activity Logs', path: '/logs', icon: <FileTextOutlined /> },
    '/users': { title: 'Users', path: '/users', icon: <TeamOutlined /> },
    '/settings': { title: 'Settings', path: '/settings', icon: <SettingOutlined /> },
    '/webhooks': { title: 'Webhooks', path: '/webhooks', icon: <ThunderboltOutlined /> },
    '/roles': { title: 'Roles & Permissions', path: '/roles', icon: <SafetyCertificateOutlined /> },
    '/config-drift': { title: 'Config Drift', path: '/config-drift', icon: <ExclamationCircleOutlined /> }
};

export function BreadcrumbNav() {
    const { token } = antdTheme.useToken();
    const location = useLocation();
    const navigate = useNavigate();

    const breadcrumbItems = useMemo(() => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        
        // Always start with Home
        const items: { key: string; title: React.ReactNode }[] = [
            {
                key: 'home',
                title: (
                    <span
                        onClick={() => navigate('/')}
                        style={{ cursor: 'pointer' }}
                    >
                        <HomeOutlined /> Home
                    </span>
                )
            }
        ];

        // Build breadcrumbs from path segments
        let currentPath = '';
        pathSegments.forEach((segment, index) => {
            currentPath += `/${segment}`;
            
            // Check if we have a known route for this path
            const knownRoute = routeMap[currentPath];
            
            if (knownRoute) {
                const isLast = index === pathSegments.length - 1;
                items.push({
                    key: currentPath,
                    title: (
                        <span
                            onClick={!isLast ? () => navigate(currentPath) : undefined}
                            style={{ cursor: isLast ? 'default' : 'pointer' }}
                        >
                            {knownRoute.icon} {knownRoute.title}
                        </span>
                    )
                });
            } else {
                // Fallback for unknown routes (e.g., /projects/:id)
                const isLast = index === pathSegments.length - 1;
                const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                const parentRoute = routeMap[parentPath];
                
                // Sanitize segment to prevent XSS
                const safeSegment = decodeURIComponent(segment).replace(/[<>]/g, '');
                
                items.push({
                    key: currentPath,
                    title: isLast ? (
                        <span style={{ color: token.colorTextSecondary }}>
                            {safeSegment.charAt(0).toUpperCase() + safeSegment.slice(1)}
                        </span>
                    ) : (
                        <span
                            onClick={() => navigate(parentPath || '/')}
                            style={{ cursor: 'pointer' }}
                        >
                            {parentRoute?.icon} {parentRoute?.title || parentPath}
                        </span>
                    )
                });
            }
        });

        return items;
    }, [location.pathname, navigate, token.colorTextSecondary]);

    return (
        <Breadcrumb
            items={breadcrumbItems}
            separator=">"
            style={{
                fontSize: token.fontSizeSM,
                color: token.colorTextSecondary
            }}
        />
    );
}
