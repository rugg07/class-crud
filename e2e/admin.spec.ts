import { test, expect } from '@playwright/test';

test.describe('Admin Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('admin can login and manage student status', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    // Wait for redirect and verify page loads
    await page.waitForURL('**/admin');
    await expect(page.locator('h1')).toContainText('Administration');

    // Find students tab and click it
    await page.click('button:has-text("Students")');

    // Wait for students table to load
    await expect(page.locator('table')).toBeVisible();

    // Find student1 in the table
    const student1Row = page.locator('table tbody tr', { has: page.locator('text=student1@example.com') });
    await expect(student1Row).toBeVisible();

    // Verify initial status is "active"
    await expect(student1Row.locator('button:has-text("Suspend")')).toBeVisible();

    // Click suspend button
    await student1Row.click('button:has-text("Suspend")');

    // Wait for toast notification
    await expect(page.locator('text=Status updated')).toBeVisible();

    // Verify button changed to "Activate"
    await expect(student1Row.locator('button:has-text("Activate")')).toBeVisible();

    // Click activate to restore
    await student1Row.click('button:has-text("Activate")');

    // Wait for confirmation
    await expect(page.locator('text=Status updated')).toBeVisible();

    // Verify button changed back to "Suspend"
    await expect(student1Row.locator('button:has-text("Suspend")')).toBeVisible();
  });
});
