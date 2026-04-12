/**
 * PRISM E2E Tests with Puppeteer
 * Dashboard Tests
 * 
 * Target: VM (192.168.122.230)
 */

import puppeteer from 'puppeteer';

// Use VM URL by default
const BASE_URL = process.env.BASE_URL || 'http://192.168.122.230';

console.log(`🎯 Testing against: ${BASE_URL}`);

describe('Dashboard', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Login before each test
    await page.goto(`${BASE_URL}/login`);
    await page.type('input[type="text"], input[type="email"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
  });

  afterEach(async () => {
    await page.close();
  });

  test('should display dashboard', async () => {
    // Check dashboard is visible
    const heading = await page.$('h1, h2');
    expect(heading).toBeTruthy();
  });

  test('should display statistics cards', async () => {
    // Wait for dashboard to load
    await page.waitForTimeout(2000);
    
    // Check for statistics cards
    const statsCards = await page.$$('.ant-statistic, [data-testid="stat-card"]');
    expect(statsCards.length).toBeGreaterThan(0);
  });

  test('should display quick actions', async () => {
    // Look for quick action buttons or cards
    const quickActions = await page.$('text=Quick Action, text=Create, text=Deploy');
    expect(quickActions).toBeTruthy();
  });

  test('should refresh data', async () => {
    // Find refresh button
    const refreshButton = await page.$('[data-testid="refresh"], button:contains("Refresh"), .ant-btn:contains("Refresh")');
    
    if (refreshButton) {
      // Click refresh
      await refreshButton.click();
      
      // Wait for refresh to complete
      await page.waitForTimeout(2000);
      
      // Dashboard should still be visible
      const heading = await page.$('h1, h2');
      expect(heading).toBeTruthy();
    }
  });
});
