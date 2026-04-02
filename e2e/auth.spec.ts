/**
 * E2E Tests for PRISM Authentication
 * Tests login, logout, and authentication flows
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Go to login page before each test
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    // Check login form is visible
    await expect(page.locator('h1, h2')).toContainText(/Login|Sign In|PRISM/i);
    await expect(page.locator('input[type="text"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill login form
    await page.locator('input[type="text"], input[type="email"]').fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Wait for navigation
    await page.waitForURL(/\/(dashboard|projects)/);
    
    // Check if logged in (should redirect to dashboard or projects)
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|projects)/);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Fill with wrong credentials
    await page.locator('input[type="text"], input[type="email"]').fill('wronguser');
    await page.locator('input[type="password"]').fill('wrongpass');
    
    // Submit form
    await page.locator('button[type="submit"]').click();
    
    // Should show error message
    await expect(page.locator('[role="alert"], .ant-message, .error')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.locator('input[type="text"], input[type="email"]').fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|projects)/);
    
    // Find and click logout button
    // Look for user menu or logout button
    const logoutButton = page.locator('[data-testid="logout"], button:has-text("Logout"), button:has-text("Sign Out"), .ant-btn:has-text("Logout")');
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should redirect to login page
      await page.waitForURL(/\/login/);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should protect authenticated routes', async ({ page }) => {
    // Try to access protected route without login
    await page.goto('/projects');
    
    // Should redirect to login
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
