/**
 * PRISM API Performance Tests
 * Using k6 for load testing
 * 
 * Install: https://k6.io/docs/getting-started/installation/
 * Run: k6 run tests/performance/api-load.js
 * Run with options: k6 run --vus 100 --duration 30s tests/performance/api-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users (stress test)
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests should be below 500ms
    errors: ['rate<0.1'],              // Error rate should be less than 10%
    api_latency: ['p(95)<300'],        // 95% of API calls should be below 300ms
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

// Headers
const headers = {
  'Content-Type': 'application/json',
  'Authorization': TEST_TOKEN ? `Bearer ${TEST_TOKEN}` : '',
};

/**
 * Test: API Health Check
 */
export function healthCheck() {
  const response = http.get(`${BASE_URL}/api/health`);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check latency < 100ms': (r) => r.timings.duration < 100,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(1);
}

/**
 * Test: Login Performance
 */
export function loginTest() {
  const payload = JSON.stringify({
    username: 'admin',
    password: 'admin123',
  });
  
  const response = http.post(`${BASE_URL}/api/login`, payload, { headers });
  
  const success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login returns token': (r) => r.json('token') !== undefined,
    'login latency < 300ms': (r) => r.timings.duration < 300,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(2);
}

/**
 * Test: Get Projects List
 */
export function getProjectsTest() {
  const response = http.get(`${BASE_URL}/api/projects`, { headers });
  
  const success = check(response, {
    'get projects status is 200': (r) => r.status === 200,
    'get projects returns array': (r) => Array.isArray(r.json()),
    'get projects latency < 200ms': (r) => r.timings.duration < 200,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(1);
}

/**
 * Test: Create Project
 */
export function createProjectTest() {
  const payload = JSON.stringify({
    name: `Performance Test Project ${Date.now()}`,
    description: 'Created by k6 performance test',
    color: 'primary',
  });
  
  const response = http.post(`${BASE_URL}/api/projects`, payload, { headers });
  
  const success = check(response, {
    'create project status is 201': (r) => r.status === 201,
    'create project returns id': (r) => r.json('id') !== undefined,
    'create project latency < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(2);
}

/**
 * Test: Get Servers List
 */
export function getServersTest() {
  const response = http.get(`${BASE_URL}/api/servers`, { headers });
  
  const success = check(response, {
    'get servers status is 200': (r) => r.status === 200,
    'get servers returns array': (r) => Array.isArray(r.json()),
    'get servers latency < 200ms': (r) => r.timings.duration < 200,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(1);
}

/**
 * Test: Get Accounts List
 */
export function getAccountsTest() {
  const response = http.get(`${BASE_URL}/api/accounts`, { headers });
  
  const success = check(response, {
    'get accounts status is 200': (r) => r.status === 200,
    'get accounts returns array': (r) => Array.isArray(r.json()),
    'get accounts latency < 200ms': (r) => r.timings.duration < 200,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(1);
}

/**
 * Test: Get Activity Logs
 */
export function getLogsTest() {
  const response = http.get(`${BASE_URL}/api/logs?limit=50`, { headers });
  
  const success = check(response, {
    'get logs status is 200': (r) => r.status === 200,
    'get logs returns array': (r) => Array.isArray(r.json()),
    'get logs latency < 300ms': (r) => r.timings.duration < 300,
  });
  
  errorRate.add(!success);
  apiLatency.add(response.timings.duration);
  
  sleep(1);
}

/**
 * Main export - choose which test to run
 */
export default function () {
  // Run all tests in sequence
  healthCheck();
  loginTest();
  getProjectsTest();
  getServersTest();
  getAccountsTest();
  getLogsTest();
  
  // Uncomment to test project creation (creates many test projects)
  // createProjectTest();
}
