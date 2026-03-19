import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AgentUpdate {
  type: 'agent_connected' | 'agent_disconnected' | 'agent_updated' | 'agent_approved' | 'agent_deleted';
  payload: any;
  timestamp: number;
}

interface UseWebSocketAgentsReturn {
  connected: boolean;
  error: string | null;
}

export function useWebSocketAgents(
  onAgentUpdate: (update: AgentUpdate) => void
): UseWebSocketAgentsReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const connect = useCallback(() => {
    if (!token) {
      setError('No authentication token');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/agents?token=${token}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setError(null);
        
        // Subscribe to agents channel
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'agents'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          if (message.type === 'subscribed') {
            console.log('Subscribed to channel:', message.channel);
            return;
          }
          
          if (message.type === 'pong') {
            return;
          }

          // Forward agent update to callback
          if (message.type === 'agent_connected' ||
              message.type === 'agent_disconnected' ||
              message.type === 'agent_updated' ||
              message.type === 'agent_approved' ||
              message.type === 'agent_deleted') {
            onAgentUpdate({
              type: message.type,
              payload: message.payload,
              timestamp: message.timestamp
            });
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 5000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
        ws.close();
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [token, onAgentUpdate]);

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

  return { connected, error };
}
