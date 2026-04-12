/**
 * Dynamic configuration utility for PRISM Frontend
 *
 * This utility provides configuration for different deployment scenarios:
 * - Scenario 1: Localhost development (same origin)
 * - Scenario 2: Different server (IP:port)
 * - Scenario 3: VM deployment
 * - Scenario 4: Production with separate domains for FE and BE
 *
 * Usage:
 *   import { config } from './utils/config';
 *   const apiUrl = config.apiBase;
 *   const wsUrl = config.wsBase;
 */

interface AppConfig {
  apiBase: string;
  wsBase: string;
  appTitle: string;
  appVersion: string;
  debugLogging: boolean;
}

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;

  // If explicitly set, use it
  if (envUrl) {
    return envUrl;
  }

  // Otherwise, use relative path (same origin)
  // This works when frontend is served by the same server
  return '';
}

function getWsBaseUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL;

  // If explicitly set, use it
  if (envUrl) {
    return envUrl;
  }

  // Derive from API URL
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');
  }

  // Same origin (relative paths)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export const config: AppConfig = {
  apiBase: getApiBaseUrl(),
  wsBase: getWsBaseUrl(),
  appTitle: import.meta.env.VITE_APP_TITLE || 'PRISM Dashboard',
  appVersion: import.meta.env.VITE_APP_VERSION || '0.5.1',
  debugLogging: import.meta.env.VITE_DEBUG_LOGGING === 'true',
};

// Helper to get full API URL for a path
export function getApiUrl(path: string): string {
  if (config.apiBase) {
    return `${config.apiBase}${path}`;
  }
  return path;
}

// Helper to get full WebSocket URL for a path
export function getWsUrl(path: string): string {
  return `${config.wsBase}${path}`;
}

// Log configuration on startup (only in development)
if (config.debugLogging || import.meta.env.DEV) {
  console.log('[PRISM Config]', {
    apiBase: config.apiBase || '(same origin)',
    wsBase: config.wsBase || '(same origin)',
    appTitle: config.appTitle,
    appVersion: config.appVersion,
  });
}
