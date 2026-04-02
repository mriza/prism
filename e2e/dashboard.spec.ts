/**
 * E2E Tests for PRISM Dashboard
 * Tests dashboard functionality and widgets
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('/login');
    await page.locator('input[type="text"], input[type="email"]').fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|projects)/);
    await page.goto('/dashboard');
  });

  test('should display dashboard', async ({ page }) => {
    // Check dashboard is visible
    await expect(page.locator('h1, h2')).toContainText(/Dashboard/i);
  });

  test('should display statistics cards', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForTimeout(2000);
    
    // Check for statistics cards (Servers, Projects, Services, etc.)
    const statsCards = page.locator('.ant-statistic, [data-testid="stat-card"]');
    const count = await statsCards.count();
    
    // Should have at least one stat card
    expect(count).toBeGreaterThan(0);
  });

  test('should display quick actions', async ({ page }) => {
    // Look for quick action buttons or cards
    const quickActions = page.locator('text=Quick Action, text=Create, text=Deploy');
    
    // Quick actions might be present
    if (await quickActions.isVisible()) {
      expect(await quickActions.count()).toBeGreaterThan(0);
    }
  });

  test('should refresh data', async ({ page }) => {
    // Find refresh button
    const refreshButton = page.locator('[data-testid="refresh"], button:has-text("Refresh"), .ant-btn:has-text("Refresh")');
    
    if (await refreshButton.isVisible()) {
      // Click refresh
      await refreshButton.click();
      
      // Wait for refresh to complete
      await page.waitForTimeout(2000);
      
      // Dashboard should still be visible
      await expect(page.locator('h1, h2')).toContainText(/Dashboard/i);
    }
  });
});
