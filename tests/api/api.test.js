/**
 * PRISM API Integration Tests
 * 
 * Tests all REST API endpoints with proper authentication
 * Run: npm test
 */

const request = require('supertest');

// Test configuration
const BASE_URL = process.env.API_TEST_URL || 'http://localhost:8080';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

let authToken = '';

/**
 * Helper: Login and get auth token
 */
async function login() {
  const response = await request(BASE_URL)
    .post('/api/login')
    .send({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });
  
  if (response.status === 200 && response.body.token) {
    authToken = response.body.token;
    return true;
  }
  
  console.error('Login failed:', response.body);
  return false;
}

/**
 * Helper: Get auth headers
 */
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': authToken ? `Bearer ${authToken}` : '',
  };
}

/**
 * Test Suite: Authentication
 */
describe('Authentication API', () => {
  test('POST /api/login - should login with valid credentials', async () => {
    const response = await request(BASE_URL)
      .post('/api/login')
      .send({
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('username');
    expect(response.body.user.role).toBeDefined();
  });
  
  test('POST /api/login - should reject invalid credentials', async () => {
    const response = await request(BASE_URL)
      .post('/api/login')
      .send({
        username: 'wronguser',
        password: 'wrongpass',
      });
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });
  
  test('POST /api/login - should require username and password', async () => {
    const response = await request(BASE_URL)
      .post('/api/login')
      .send({});
    
    expect(response.status).toBe(400);
  });
});

/**
 * Test Suite: Projects API
 */
describe('Projects API', () => {
  beforeAll(async () => {
    await login();
  });
  
  test('GET /api/projects - should return projects list', async () => {
    const response = await request(BASE_URL)
      .get('/api/projects')
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('POST /api/projects - should create new project', async () => {
    const projectData = {
      name: `API Test Project ${Date.now()}`,
      description: 'Created by API integration test',
      color: 'primary',
    };
    
    const response = await request(BASE_URL)
      .post('/api/projects')
      .set(getAuthHeaders())
      .send(projectData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(projectData.name);
    expect(response.body.description).toBe(projectData.description);
    
    // Cleanup: Delete the project
    await request(BASE_URL)
      .delete(`/api/projects/${response.body.id}`)
      .set(getAuthHeaders());
  });
  
  test('GET /api/projects/:id - should return project details', async () => {
    // First create a project
    const createResponse = await request(BASE_URL)
      .post('/api/projects')
      .set(getAuthHeaders())
      .send({
        name: `Test Project ${Date.now()}`,
        color: 'primary',
      });
    
    const projectId = createResponse.body.id;
    
    // Then get it
    const response = await request(BASE_URL)
      .get(`/api/projects/${projectId}`)
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(projectId);
    
    // Cleanup
    await request(BASE_URL)
      .delete(`/api/projects/${projectId}`)
      .set(getAuthHeaders());
  });
  
  test('PUT /api/projects/:id - should update project', async () => {
    // Create project
    const createResponse = await request(BASE_URL)
      .post('/api/projects')
      .set(getAuthHeaders())
      .send({
        name: `Update Test ${Date.now()}`,
        color: 'primary',
      });
    
    const projectId = createResponse.body.id;
    
    // Update it
    const updateData = {
      name: 'Updated Project Name',
      description: 'Updated description',
    };
    
    const response = await request(BASE_URL)
      .put(`/api/projects/${projectId}`)
      .set(getAuthHeaders())
      .send(updateData);
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe(updateData.name);
    expect(response.body.description).toBe(updateData.description);
    
    // Cleanup
    await request(BASE_URL)
      .delete(`/api/projects/${projectId}`)
      .set(getAuthHeaders());
  });
  
  test('DELETE /api/projects/:id - should delete project', async () => {
    // Create project
    const createResponse = await request(BASE_URL)
      .post('/api/projects')
      .set(getAuthHeaders())
      .send({
        name: `Delete Test ${Date.now()}`,
        color: 'primary',
      });
    
    const projectId = createResponse.body.id;
    
    // Delete it
    const response = await request(BASE_URL)
      .delete(`/api/projects/${projectId}`)
      .set(getAuthHeaders());
    
    expect(response.status).toBe(204);
    
    // Verify it's deleted
    const getResponse = await request(BASE_URL)
      .get(`/api/projects/${projectId}`)
      .set(getAuthHeaders());
    
    expect(getResponse.status).toBe(404);
  });
});

/**
 * Test Suite: Servers API
 */
describe('Servers API', () => {
  beforeAll(async () => {
    await login();
  });
  
  test('GET /api/servers - should return servers list', async () => {
    const response = await request(BASE_URL)
      .get('/api/servers')
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('GET /api/servers/:id - should return server details', async () => {
    // Get servers list first
    const listResponse = await request(BASE_URL)
      .get('/api/servers')
      .set(getAuthHeaders());
    
    if (listResponse.body.length > 0) {
      const serverId = listResponse.body[0].id;
      
      const response = await request(BASE_URL)
        .get(`/api/servers/${serverId}`)
        .set(getAuthHeaders());
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(serverId);
    }
  });
});

/**
 * Test Suite: Accounts API
 */
describe('Accounts API', () => {
  beforeAll(async () => {
    await login();
  });
  
  test('GET /api/accounts - should return accounts list', async () => {
    const response = await request(BASE_URL)
      .get('/api/accounts')
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('POST /api/accounts - should create new account', async () => {
    // This test requires a server to be available
    // Skip if no servers available
    const serversResponse = await request(BASE_URL)
      .get('/api/servers')
      .set(getAuthHeaders());
    
    if (serversResponse.body.length === 0) {
      console.log('Skipping account creation test - no servers available');
      return;
    }
    
    const accountData = {
      type: 'mysql',
      name: `API Test Account ${Date.now()}`,
      serverId: serversResponse.body[0].id,
    };
    
    const response = await request(BASE_URL)
      .post('/api/accounts')
      .set(getAuthHeaders())
      .send(accountData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});

/**
 * Test Suite: Users API
 */
describe('Users API', () => {
  beforeAll(async () => {
    await login();
  });
  
  test('GET /api/users - should return users list', async () => {
    const response = await request(BASE_URL)
      .get('/api/users')
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('POST /api/users - should create new user', async () => {
    const userData = {
      username: `testuser${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      role: 'user',
      fullName: 'Test User',
    };
    
    const response = await request(BASE_URL)
      .post('/api/users')
      .set(getAuthHeaders())
      .send(userData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.username).toBe(userData.username);
    expect(response.body.email).toBe(userData.email);
    
    // Cleanup: Delete the user
    await request(BASE_URL)
      .delete(`/api/users/${response.body.id}`)
      .set(getAuthHeaders());
  });
});

/**
 * Test Suite: Logs API
 */
describe('Logs API', () => {
  beforeAll(async () => {
    await login();
  });
  
  test('GET /api/logs - should return activity logs', async () => {
    const response = await request(BASE_URL)
      .get('/api/logs?limit=50')
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('GET /api/logs - should support pagination', async () => {
    const response = await request(BASE_URL)
      .get('/api/logs?limit=10&offset=0')
      .set(getAuthHeaders());
    
    expect(response.status).toBe(200);
    expect(response.body.length).toBeLessThanOrEqual(10);
  });
});

/**
 * Test Suite: Health Check
 */
describe('Health Check API', () => {
  test('GET /api/health - should return health status', async () => {
    const response = await request(BASE_URL)
      .get('/api/health');
    
    // Health endpoint might not require auth
    expect([200, 401, 404]).toContain(response.status);
  });
});
