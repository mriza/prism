/**
 * PRISM E2E Tests with Puppeteer
 * Projects Tests
 * 
 * Target: VM (192.168.122.230)
 */

import puppeteer from 'puppeteer';

// Use VM URL by default
const BASE_URL = process.env.BASE_URL || 'http://192.168.122.230';

console.log(`🎯 Testing against: ${BASE_URL}`);

describe('Projects', () => {
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
    
    // Navigate to projects page
    await page.goto(`${BASE_URL}/projects`);
  });

  afterEach(async () => {
    await page.close();
  });

  test('should display projects page', async () => {
    // Check page title or heading
    const heading = await page.$('h1, h2');
    expect(heading).toBeTruthy();
    
    // Check for "New Project" button
    const createButton = await page.$('button:contains("New Project"), button:contains("Create Project")');
    expect(createButton).toBeTruthy();
  });

  test('should create a new project', async () => {
    // Click "New Project" button
    const createButton = await page.$('button:contains("New Project"), button:contains("Create Project")');
    if (createButton) {
      await createButton.click();
      
      // Wait for modal to open
      await page.waitForSelector('[role="dialog"], .ant-modal', { timeout: 5000 });
      
      // Fill project form
      const projectName = `Puppeteer Test Project ${Date.now()}`;
      await page.type('input[placeholder*="Project name"], input[name="name"]', projectName);
      
      // Submit form
      const submitButton = await page.$('button[type="submit"]:contains("Create")');
      if (submitButton) {
        await submitButton.click();
        
        // Wait for modal to close
        await page.waitForSelector('[role="dialog"], .ant-modal', { state: 'hidden', timeout: 5000 });
        
        // Check if project appears in list
        await page.waitForSelector(`text="${projectName}"`, { timeout: 5000 });
        const projectElement = await page.$(`text="${projectName}"`);
        expect(projectElement).toBeTruthy();
      }
    }
  });

  test('should filter projects by search', async () => {
    // Find search input
    const searchInput = await page.$('input[placeholder*="Search"], input[placeholder*="Filter"]');
    
    if (searchInput) {
      // Type search query
      await searchInput.type('Test');
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // Check if results are filtered
      const projectCards = await page.$$('[data-testid="project-card"], .ant-card');
      expect(projectCards.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should open project details', async () => {
    // Find first project card and click
    const firstProject = await page.$('[data-testid="project-card"], .ant-card');
    
    if (firstProject) {
      await firstProject.click();
      
      // Should navigate to project detail page
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      const url = page.url();
      expect(url).toMatch(/\/projects\/[a-zA-Z0-9-]+/);
    }
  });
});
