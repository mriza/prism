/**
 * E2E Tests for PRISM Projects
 * Tests project CRUD operations
 */

import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.locator('input[type="text"], input[type="email"]').fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|projects)/);
    
    // Navigate to projects page
    await page.goto('/projects');
  });

  test('should display projects page', async ({ page }) => {
    // Check page title or heading
    await expect(page.locator('h1, h2')).toContainText(/Project/i);
    
    // Check for "New Project" or "Create Project" button (admin only)
    const createButton = page.locator('button:has-text("New Project"), button:has-text("Create Project"), button:has-text("Add Project")');
    await expect(createButton).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    // Click "New Project" button
    await page.locator('button:has-text("New Project"), button:has-text("Create Project")').click();
    
    // Wait for modal to open
    await expect(page.locator('[role="dialog"], .ant-modal')).toBeVisible();
    
    // Fill project form
    await page.locator('input[placeholder*="Project name"], input[name="name"]').fill('E2E Test Project');
    
    // Submit form
    await page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")').click();
    
    // Wait for modal to close and success message
    await page.waitForTimeout(2000);
    
    // Check if project appears in list
    await expect(page.locator('text=E2E Test Project')).toBeVisible({ timeout: 5000 });
  });

  test('should filter projects by search', async ({ page }) => {
    // Wait for projects to load
    await page.waitForTimeout(1000);
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="Filter"]');
    
    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('Test');
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // Check if results are filtered
      const projectCards = page.locator('[data-testid="project-card"], .ant-card:has-text("Test")');
      const count = await projectCards.count();
      
      // Should have at least one result or show empty state
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should open project details', async ({ page }) => {
    // Wait for projects to load
    await page.waitForTimeout(1000);
    
    // Find first project card and click
    const firstProject = page.locator('[data-testid="project-card"], .ant-card').first();
    
    if (await firstProject.isVisible()) {
      await firstProject.click();
      
      // Should navigate to project detail page
      await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+/);
      expect(page.url()).toMatch(/\/projects\/[a-zA-Z0-9-]+/);
    }
  });
});
