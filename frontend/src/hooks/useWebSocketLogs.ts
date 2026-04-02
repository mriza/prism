import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { log } from '../utils/log';

export interface LogEntry {
    id: string;
    agentId: string;
    agentName: string;
    type: string;
    service: string;
    status: string;
    message: string;
    createdAt: string;
}

interface UseWebSocketLogsReturn {
    logs: LogEntry[];
    connected: boolean;
    error: string | null;
    clearLogs: () => void;
}

export function useWebSocketLogs(
    agentId: string,
    service: string,
    limit: number = 100
): UseWebSocketLogsReturn {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuth();
    const connectRef = useRef<() => void>(null!);

    const connect = useCallback(() => {
        if (!token) {
            setError('No authentication token');
            return;
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/logs?agentId=${encodeURIComponent(agentId)}&service=${encodeURIComponent(service)}&token=${token}`;

            log.debug('Connecting to logs WebSocket:', wsUrl);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                log.debug('Logs WebSocket connected');
                setConnected(true);
                setError(null);

                // Subscribe to logs channel
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    channel: 'logs',
                    agentId,
                    service,
                    limit
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    log.debug('Logs WebSocket message received:', message);

                    if (message.type === 'subscribed') {
                        log.debug('Subscribed to logs channel');
                        return;
                    }

                    if (message.type === 'pong') {
                        return;
                    }

                    // Handle initial batch of logs
                    if (message.type === 'logs_batch') {
                        setLogs(message.payload || []);
                        return;
                    }

                    // Handle new log entry
                    if (message.type === 'log_entry') {
                        setLogs(prev => [...prev, message.payload].slice(-limit));
                        return;
                    }
                } catch (err) {
                    log.error('Failed to parse WebSocket log message:', err);
                }
            };

            ws.onclose = () => {
                log.info('Logs WebSocket disconnected');
                setConnected(false);

                // Attempt to reconnect after 5 seconds
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    log.info('Attempting to reconnect logs WebSocket...');
                    connectRef.current?.();
                }, 5000);
            };

            ws.onerror = (err) => {
                log.error('Logs WebSocket error:', err);
                setError('WebSocket connection error');
                ws.close();
            };
        } catch (err) {
            log.error('Failed to create logs WebSocket:', err);
            setError('Failed to create WebSocket connection');
        }
    }, [token, agentId, service, limit]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        if (token && agentId && service) {
            connect();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect, token, agentId, service]);

    // Send ping every 30 seconds to keep connection alive
    useEffect(() => {
        if (!connected || !wsRef.current) return;

        const pingInterval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);

        return () => clearInterval(pingInterval);
    }, [connected]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return { logs, connected, error, clearLogs };
}
