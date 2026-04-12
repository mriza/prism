import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { handleError } from '../utils/log';
import { useAuth } from './AuthContext';

interface AppConfig {
    heartbeatInterval: number; // in milliseconds
    uiRefreshRate: number;      // in milliseconds
}

interface AppConfigContextType {
    config: AppConfig;
    updateConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
    refreshConfig: () => Promise<void>;
}

const DEFAULT_CONFIG: AppConfig = {
    heartbeatInterval: 15000, // 15 seconds
    uiRefreshRate: 10000,     // 10 seconds
};

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
    const { token, isAuthenticated } = useAuth();
    const [config, setConfig] = useState<AppConfig>(() => {
        const saved = localStorage.getItem('prism_app_config');
        if (saved) {
            try {
                return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            } catch {
                return DEFAULT_CONFIG;
            }
        }
        return DEFAULT_CONFIG;
    });

    const apiBase = import.meta.env.VITE_API_URL || '';

    const refreshConfig = useCallback(async () => {
        if (!isAuthenticated || !token) return;

        await handleError(
            async () => {
                const res = await fetch(`${apiBase}/api/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const newConfig: Partial<AppConfig> = {};
                    if (Array.isArray(data)) {
                        data.forEach((item: { key: string, value: string }) => {
                            if (item.key === 'heartbeatInterval' || item.key === 'pollingInterval') {
                                newConfig.heartbeatInterval = parseInt(item.value);
                            }
                            if (item.key === 'uiRefreshRate') {
                                newConfig.uiRefreshRate = parseInt(item.value);
                            }
                        });
                    }

                    if (Object.keys(newConfig).length > 0) {
                        const finalConfig = { ...config, ...newConfig };
                        setConfig(finalConfig);
                        localStorage.setItem('prism_app_config', JSON.stringify(finalConfig));
                    }
                }
            },
            'Failed to fetch settings from Hub',
            { showToast: false }
        );
    }, [apiBase, token, isAuthenticated, config]);

    useEffect(() => {
        if (isAuthenticated) {
            refreshConfig();
        }
    }, [isAuthenticated, refreshConfig]);

    const updateConfig = async (newConfig: Partial<AppConfig>) => {
        const updated = { ...config, ...newConfig };
        setConfig(updated);
        localStorage.setItem('prism_app_config', JSON.stringify(updated));

        if (isAuthenticated && token) {
            const payload: Record<string, string> = {};
            if (newConfig.heartbeatInterval) {
                payload.heartbeatInterval = newConfig.heartbeatInterval.toString();
            }
            if (newConfig.uiRefreshRate) {
                payload.uiRefreshRate = newConfig.uiRefreshRate.toString();
            }

            await handleError(
                async () => {
                    await fetch(`${apiBase}/api/settings`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });
                },
                'Failed to sync settings to Hub',
                { showToast: false }
            );
        }
    };

    return (
        <AppConfigContext.Provider value={{ config, updateConfig, refreshConfig }}>
            {children}
        </AppConfigContext.Provider>
    );
}

export function useAppConfig() {
    const context = useContext(AppConfigContext);
    if (context === undefined) {
        throw new Error('useAppConfig must be used within an AppConfigProvider');
    }
    return context;
}
