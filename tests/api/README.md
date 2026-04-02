# API Integration Tests for PRISM

Tests all REST API endpoints with proper authentication and validation.

## Prerequisites

- Node.js 18+
- PRISM server running
- Test user account created

## Setup

```bash
cd tests/api
npm install
```

## Configuration

Create `.env` file or set environment variables:

```bash
# API Test URL
export API_TEST_URL=http://localhost:8080

# Test credentials (must exist in the system)
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run with Watch Mode

```bash
npm run test:watch
```

### Run with Coverage

```bash
npm run test:coverage
```

## Test Suites

### Authentication API
- ✅ POST /api/login - Valid credentials
- ✅ POST /api/login - Invalid credentials
- ✅ POST /api/login - Required fields validation

### Projects API
- ✅ GET /api/projects - List projects
- ✅ POST /api/projects - Create project
- ✅ GET /api/projects/:id - Get project details
- ✅ PUT /api/projects/:id - Update project
- ✅ DELETE /api/projects/:id - Delete project

### Servers API
- ✅ GET /api/servers - List servers
- ✅ GET /api/servers/:id - Get server details

### Accounts API
- ✅ GET /api/accounts - List accounts
- ✅ POST /api/accounts - Create account

### Users API
- ✅ GET /api/users - List users
- ✅ POST /api/users - Create user

### Logs API
- ✅ GET /api/logs - Get activity logs
- ✅ GET /api/logs - Pagination support

### Health Check
- ✅ GET /api/health - Health status

## Test Structure

```javascript
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
});
```

## Expected Results

All tests should pass with:
- ✅ 200/201 for successful operations
- ✅ 400/401/404 for error cases
- ✅ Proper response structure
- ✅ Data cleanup after tests

## Troubleshooting

### Tests Fail with 401

**Check credentials**:
```bash
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
```

**Verify user exists in the system**.

### Tests Fail with ECONNREFUSED

**Check if server is running**:
```bash
curl http://localhost:8080/api/health
```

**Update API_TEST_URL**:
```bash
export API_TEST_URL=http://your-server:8080
```

### Tests Fail with Timeout

**Increase timeout in package.json**:
```json
{
  "jest": {
    "testTimeout": 60000
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    
    services:
      prism:
        image: prism-server:latest
        ports:
          - 8080:8080
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd tests/api
          npm install
      
      - name: Run API tests
        run: |
          cd tests/api
          npm test
        env:
          API_TEST_URL: http://localhost:8080
          TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## Best Practices

### Test Data Cleanup

Always clean up test data:
```javascript
test('should create project', async () => {
  const createResponse = await createProject();
  
  // Cleanup
  await deleteProject(createResponse.body.id);
});
```

### Use Unique Names

Prevent conflicts with unique names:
```javascript
const name = `Test Project ${Date.now()}`;
```

### Wait for Async Operations

```javascript
await response;
await new Promise(resolve => setTimeout(resolve, 1000));
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [PRISM API Docs](../../docs/api/openapi.yaml)

---

**Last Updated**: 2026-04-02  
**Version**: 1.0  
**Maintained By**: PRISM Development Team
