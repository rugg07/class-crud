import { test, expect } from '@playwright/test';

test.describe('Teacher Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('teacher can view classes, students, and grade submissions', async ({ page }) => {
    // Login as teacher
    await page.fill('input[type="email"]', 'teacher1@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    // Wait for redirect and verify page loads
    await page.waitForURL('**/teacher');
    await expect(page.locator('h1')).toContainText('My Students');

    // Verify student roster is visible
    await expect(page.locator('text=Student Roster')).toBeVisible();

    // Wait for loading to complete
    await page.waitForTimeout(500);

    // Find Student One in the roster
    const studentButton = page.locator('button.w-full', { has: page.locator('text=Student One') });
    await expect(studentButton).toBeVisible();

    // Click to expand student
    await studentButton.click();

    // Wait for submissions to load
    await expect(page.locator('text=Submissions')).toBeVisible();

    // Find feedback input for the first submission
    const feedbackTextarea = page.locator('textarea[placeholder*="Add feedback"]').first();
    await expect(feedbackTextarea).toBeVisible();

    // Add feedback
    await feedbackTextarea.fill('Great work! Keep it up.');

    // Find grade input (first one)
    const gradeInput = page.locator('input[type="number"]').first();
    await expect(gradeInput).toBeVisible();

    // Enter grade
    await gradeInput.fill('85');

    // Click save feedback & grade button
    await page.click('button:has-text("Save Feedback & Grade")');

    // Wait for success notification
    await expect(page.locator('text=Success')).toBeVisible();
    await expect(page.locator('text=Grade and feedback saved')).toBeVisible();

    // Verify feedback was saved by checking toast
    await page.waitForTimeout(500);
    await expect(page.locator('text=saved')).toBeVisible();
  });
});
