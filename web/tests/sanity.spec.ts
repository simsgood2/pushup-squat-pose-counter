import { test, expect } from '@playwright/test';

test('page loads and canvas exists', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/./);
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});
