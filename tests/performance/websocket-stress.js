/**
 * PRISM WebSocket Stress Test
 * Tests WebSocket connection handling under load
 * 
 * This test simulates multiple concurrent WebSocket connections
 * to test the server's WebSocket hub capacity.
 * 
 * Run: k6 run --vus 50 --duration 1m tests/performance/websocket-stress.js
 */

import ws from 'k6/ws';
import { check } from 'k6';
import { Rate, Gauge } from 'k6/metrics';

// Custom metrics
const connectionSuccess = new Rate('ws_connections');
const messageSuccess = new Rate('ws_messages');
const activeConnections = new Gauge('active_connections');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 connections
    { duration: '1m', target: 10 },    // Stay at 10 connections
    { duration: '30s', target: 50 },   // Ramp up to 50 connections
    { duration: '2m', target: 50 },    // Stay at 50 connections
    { duration: '30s', target: 100 },  // Ramp up to 100 connections
    { duration: '1m', target: 100 },   // Stay at 100 connections (stress)
    { duration: '30s', target: 0 },    // Ramp down
  ],
  
  thresholds: {
    ws_connections: ['rate>0.9'],      // 90% connection success rate
    ws_messages: ['rate>0.95'],        // 95% message success rate
    ws_connecting_duration: ['p(95)<1000'],  // 95% connect in <1s
  },
};

const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/api/ws';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

export default function () {
  // Track active connections
  activeConnections.add(1);
  
  const url = WS_URL + (TEST_TOKEN ? `?token=${TEST_TOKEN}` : '');
  
  const response = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      connectionSuccess.add(true);
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'events'
      }));
    });
    
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        messageSuccess.add(true);
        
        // Verify message structure
        check(message, {
          'message has type': (m) => m.type !== undefined,
          'message has payload': (m) => m.payload !== undefined,
        });
      } catch (e) {
        messageSuccess.add(false);
      }
    });
    
    socket.on('close', () => {
      connectionSuccess.add(true);
      activeConnections.add(-1);
    });
    
    socket.on('error', (error) => {
      connectionSuccess.add(false);
      console.error('WebSocket error:', error);
    });
    
    // Keep connection alive for 10 seconds
    socket.setTimeout(() => {
      socket.close();
    }, 10000);
  });
  
  // Check connection was established
  check(response, {
    'status is 101': (r) => r && r.status === 101,
  });
}
