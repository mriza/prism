import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { handleError, log } from '../utils/log';
import type { Event } from '../types';

interface UseActivityLogsReturn {
    events: Event[];
    connected: boolean;
    error: string | null;
}

export function useActivityLogs(
    agentId?: string,
    service?: string,
    limit: number = 50
): UseActivityLogsReturn {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
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
            // Note: We use the same generic WS hub for general updates
            const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${token}`;

            log.debug('Connecting to activity WebSocket (events channel)');
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                log.debug('Activity WebSocket connected');
                setConnected(true);
                setError(null);

                // Subscribe to events channel
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    channel: 'events'
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'event') {
                        const newEvent = message.payload as Event;
                        
                        // Filter by agent and service if specified
                        if (agentId && newEvent.agentId !== agentId) return;
                        if (service && newEvent.service !== service) return;
                        
                        setEvents(prev => [newEvent, ...prev].slice(0, limit));
                    }
                } catch (err) {
                    log.error('Failed to parse activity WebSocket message:', err);
                }
            };

            ws.onclose = () => {
                log.info('Activity WebSocket disconnected');
                setConnected(false);

                // Attempt to reconnect after 5 seconds
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    log.info('Attempting to reconnect activity WebSocket...');
                    connectRef.current?.();
                }, 5000);
            };

            ws.onerror = (err) => {
                log.error('Activity WebSocket error:', err);
                setError('WebSocket connection error');
                ws.close();
            };
        } catch (err) {
            log.error('Failed to create activity WebSocket:', err);
            setError('Failed to create WebSocket connection');
        }
    }, [token, agentId, service, limit]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    // Initial fetch of historic logs
    useEffect(() => {
        const fetchHistory = async () => {
            let url = `/api/logs?limit=${limit}`;
            if (agentId) url += `&agentId=${encodeURIComponent(agentId)}`;
            if (service) url += `&service=${encodeURIComponent(service)}`;

            await handleError(
                async () => {
                    const resp = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        setEvents(data || []);
                    }
                },
                'Failed to fetch activity history',
                { showToast: false }
            );
        };

        if (token) {
            fetchHistory();
        }
    }, [token, agentId, service, limit]);

    useEffect(() => {
        if (token) {
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
    }, [connect, token]);

    return { events, connected, error };
}
