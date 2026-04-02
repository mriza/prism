/**
 * PRISM Database Performance Tests
 * Tests database query performance under load
 * 
 * Run: k6 run tests/performance/database-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom metrics
const queryLatency = new Trend('db_query_latency');
const queryErrorRate = new Rate('db_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 20 },    // Stay at 20 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  
  thresholds: {
    db_query_latency: ['p(95)<100'],   // 95% of queries < 100ms
    db_errors: ['rate<0.05'],          // Error rate < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': TEST_TOKEN ? `Bearer ${TEST_TOKEN}` : '',
};

/**
 * Test: Get all projects (database query)
 */
function testGetProjects() {
  const start = Date.now();
  const response = http.get(`${BASE_URL}/api/projects`, { headers });
  const duration = Date.now() - start;
  
  const success = check(response, {
    'get projects success': (r) => r.status === 200,
    'get projects returns data': (r) => r.json().length >= 0,
  });
  
  queryLatency.add(duration);
  queryErrorRate.add(!success);
  
  sleep(0.5);
}

/**
 * Test: Get all servers (database query)
 */
function testGetServers() {
  const start = Date.now();
  const response = http.get(`${BASE_URL}/api/servers`, { headers });
  const duration = Date.now() - start;
  
  const success = check(response, {
    'get servers success': (r) => r.status === 200,
    'get servers returns data': (r) => r.json().length >= 0,
  });
  
  queryLatency.add(duration);
  queryErrorRate.add(!success);
  
  sleep(0.5);
}

/**
 * Test: Get all accounts (database query with joins)
 */
function testGetAccounts() {
  const start = Date.now();
  const response = http.get(`${BASE_URL}/api/accounts`, { headers });
  const duration = Date.now() - start;
  
  const success = check(response, {
    'get accounts success': (r) => r.status === 200,
    'get accounts returns data': (r) => Array.isArray(r.json()),
  });
  
  queryLatency.add(duration);
  queryErrorRate.add(!success);
  
  sleep(0.5);
}

/**
 * Test: Get activity logs (database query with pagination)
 */
function testGetLogs() {
  const start = Date.now();
  const response = http.get(`${BASE_URL}/api/logs?limit=100&offset=0`, { headers });
  const duration = Date.now() - start;
  
  const success = check(response, {
    'get logs success': (r) => r.status === 200,
    'get logs returns data': (r) => Array.isArray(r.json()),
  });
  
  queryLatency.add(duration);
  queryErrorRate.add(!success);
  
  sleep(0.5);
}

/**
 * Test: Search projects (database query with filter)
 */
function testSearchProjects() {
  const start = Date.now();
  const response = http.get(`${BASE_URL}/api/projects?search=test`, { headers });
  const duration = Date.now() - start;
  
  const success = check(response, {
    'search projects success': (r) => r.status === 200,
    'search projects returns data': (r) => Array.isArray(r.json()),
  });
  
  queryLatency.add(duration);
  queryErrorRate.add(!success);
  
  sleep(0.5);
}

export default function () {
  // Run database queries
  testGetProjects();
  testGetServers();
  testGetAccounts();
  testGetLogs();
  testSearchProjects();
}
