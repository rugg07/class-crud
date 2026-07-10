import { test, expect } from '@playwright/test';

test.describe('Student Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('student can view enrolled classes and assignments', async ({ page }) => {
    // Login as student
    await page.fill('input[type="email"]', 'student1@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    // Wait for redirect and verify page loads
    await page.waitForURL('**/student');
    await expect(page.locator('h1')).toContainText('My Classes');

    // Wait for classes to load
    await page.waitForTimeout(500);

    // Find "Algebra 101" class card
    const classCard = page.locator('div', { has: page.locator('text=Algebra 101') });
    await expect(classCard).toBeVisible();

    // Verify class displays assignment count
    await expect(classCard.locator('text=2 assignments')).toBeVisible();

    // Verify published assignments are shown
    await expect(classCard.locator('text=Algebra Basics Quiz')).toBeVisible();
    await expect(classCard.locator('text=Linear Equations Practice')).toBeVisible();

    // Verify assignment status badges
    const assignmentBadges = classCard.locator('span:has-text("Published")');
    await expect(assignmentBadges).toHaveCount(2);

    // Verify due dates are displayed
    await expect(classCard.locator('text=Due:')).toBeVisible();

    // Verify draft assignments are NOT shown to student
    await expect(page.locator('text=Quadratic Equations Project')).not.toBeVisible();
  });
});
