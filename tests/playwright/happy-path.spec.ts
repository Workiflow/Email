import { test, expect } from '@playwright/test';

test.describe('Happy path workflow', () => {
  test('login and interact with a conversation (stub)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Shared Inbox')).toBeVisible();
  });
});
