# PRISM E2E Tests

End-to-end tests for PRISM using Playwright.

## Setup

### Install Dependencies

```bash
cd e2e
npm install
```

### Install Playwright Browsers

```bash
npx playwright install
```

This will install Chromium, Firefox, and WebKit browsers for testing.

## Configuration

### Environment Variables

Create `e2e/.env` file:

```bash
# Base URL of PRISM frontend
E2E_BASE_URL=http://localhost:5173

# Test credentials
E2E_TEST_USERNAME=admin
E2E_TEST_PASSWORD=admin123
```

### Update Test Credentials

Edit test files if your test credentials are different:
- `e2e/auth.spec.ts`
- `e2e/projects.spec.ts`
- `e2e/dashboard.spec.ts`

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests with UI

```bash
npm run test:ui
```

### Run Tests in Debug Mode

```bash
npm run test:debug
```

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
```

### Run Specific Test

```bash
npx playwright test -g "should login with valid credentials"
```

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Files

- `auth.spec.ts` - Authentication tests (login, logout)
- `projects.spec.ts` - Project CRUD tests
- `dashboard.spec.ts` - Dashboard tests

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

## Viewing Results

### HTML Report

```bash
npm run test:report
```

This opens the HTML report in your browser.

### JSON Results

Results are saved to `e2e-results/results.json`

### JUnit XML

JUnit results are saved to `e2e-results/junit.xml`

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd e2e
          npm install
          npx playwright install --with-deps
      
      - name: Run E2E tests
        run: |
          cd e2e
          npm test
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: e2e-results/
```

## Best Practices

### Wait for Elements

```typescript
// ✅ Good - wait for element
await expect(page.locator('text=Success')).toBeVisible();

// ❌ Bad - fixed timeout
await page.waitForTimeout(5000);
```

### Use Data Attributes

```typescript
// ✅ Good - stable selector
await page.locator('[data-testid="submit-button"]').click();

// ❌ Bad - fragile selector
await page.locator('button:nth-child(3)').click();
```

### Page Object Model

For complex tests, use Page Object Model:

```typescript
// e2e/pages/LoginPage.ts
export class LoginPage {
  constructor(private page) {}
  
  async goto() {
    await this.page.goto('/login');
  }
  
  async login(username: string, password: string) {
    await this.page.locator('input[type="text"]').fill(username);
    await this.page.locator('input[type="password"]').fill(password);
    await this.page.locator('button[type="submit"]').click();
  }
}

// In test file
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('admin', 'admin123');
```

## Troubleshooting

### Tests Fail Immediately

**Check if frontend is running**:
```bash
# Frontend should be running on port 5173
curl http://localhost:5173
```

**Update base URL**:
```bash
# In e2e/.env
E2E_BASE_URL=http://localhost:5173
```

### Tests Timeout

**Increase timeout in playwright.config.ts**:
```typescript
export default defineConfig({
  timeout: 60000, // 60 seconds
  expect: {
    timeout: 10000, // 10 seconds
  },
});
```

### Browser Not Installing

**Install with dependencies**:
```bash
npx playwright install --with-deps
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test](https://playwright.dev/docs/test-intro)
- [Playwright API](https://playwright.dev/docs/api/class-playwright)

---

**Last Updated**: 2026-04-02  
**Version**: 1.0
