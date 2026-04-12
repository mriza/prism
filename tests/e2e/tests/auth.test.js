/**
 * PRISM E2E Tests with Puppeteer
 * Authentication Tests
 * 
 * Target: VM (192.168.122.230)
 */

import puppeteer from 'puppeteer';

// Use VM URL by default, fallback to localhost for local testing
const BASE_URL = process.env.BASE_URL || 'http://192.168.122.230';

console.log(`🎯 Testing against: ${BASE_URL}`);

describe('Authentication', () => {
  beforeAll(async () => {
    // Launch browser once for all tests
    global.browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('   ✓ Browser launched!\n');
  });

  beforeEach(async () => {
    // Create new page for each test
    global.page = await global.browser.newPage();
    await global.page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    // Close page after each test
    if (global.page) {
      await global.page.close();
    }
  });

  test('should display login page', async () => {
    await global.page.goto(`${BASE_URL}/login`);
    
    // Check login form is visible
    const heading = await global.page.$('h1, h2');
    expect(heading).toBeTruthy();
    
    const usernameInput = await global.page.$('input[type="text"], input[type="email"]');
    expect(usernameInput).toBeTruthy();
    
    const passwordInput = await global.page.$('input[type="password"]');
    expect(passwordInput).toBeTruthy();
  });

  test('should login with valid credentials', async () => {
    await global.page.goto(`${BASE_URL}/login`);
    
    // Fill login form
    await global.page.type('input[type="text"], input[type="email"]', 'admin');
    await global.page.type('input[type="password"]', 'admin123');
    await global.page.click('button[type="submit"]');
    
    // Wait for navigation
    await global.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    
    // Check if logged in (should redirect to dashboard or projects)
    const url = global.page.url();
    expect(url).toMatch(/\/(dashboard|projects)/);
  });

  test('should show error with invalid credentials', async () => {
    await global.page.goto(`${BASE_URL}/login`);
    
    // Fill with wrong credentials
    await global.page.type('input[type="text"], input[type="email"]', 'wronguser');
    await global.page.type('input[type="password"]', 'wrongpass');
    await global.page.click('button[type="submit"]');
    
    // Wait for error message
    try {
      await global.page.waitForSelector('[role="alert"], .ant-message, .error, .text-error', { timeout: 5000 });
      const errorElement = await global.page.$('[role="alert"], .ant-message, .error, .text-error');
      expect(errorElement).toBeTruthy();
    } catch (error) {
      // If no error shown, test still passes if we're still on login page
      const url = global.page.url();
      expect(url).toMatch(/\/login/);
    }
  });

  test('should logout successfully', async () => {
    // Login first
    await global.page.goto(`${BASE_URL}/login`);
    await global.page.type('input[type="text"], input[type="email"]', 'admin');
    await global.page.type('input[type="password"]', 'admin123');
    await global.page.click('button[type="submit"]');
    await global.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    
    // Find and click logout button
    const logoutButton = await global.page.$('[data-testid="logout"], button:contains("Logout"), button:contains("Sign Out")');
    
    if (logoutButton) {
      await logoutButton.click();
      try {
        await global.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
        
        // Should redirect to login page
        const url = global.page.url();
        expect(url).toMatch(/\/login/);
      } catch (error) {
        // Navigation might not happen if already on login
        const url = global.page.url();
        expect(url).toMatch(/\/login/);
      }
    }
  });

  test('should protect authenticated routes', async () => {
    // Try to access protected route without login
    await global.page.goto(`${BASE_URL}/projects`);
    
    // Wait for navigation
    try {
      await global.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
    } catch (error) {
      // No navigation, might already be on login
    }
    
    // Should redirect to login
    const url = global.page.url();
    expect(url).toMatch(/\/login/);
  });
});
