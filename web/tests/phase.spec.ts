import { test, expect } from '@playwright/test';

test('T4.1: initial phase is Menu', async ({ page }) => {
  await page.goto('/');
  const menuOverlay = page.locator('[data-testid="menu-overlay"]');
  await expect(menuOverlay).toBeVisible();

  const phaseLabel = page.locator('[data-testid="phase-label"]');
  await expect(phaseLabel).toHaveText('Menu');
});

test('T4.1: start button click transitions to Exercise', async ({ page }) => {
  await page.goto('/');
  const startBtn = page.locator('[data-testid="start-button"]');
  await expect(startBtn).toBeVisible();

  await startBtn.click();

  const menuOverlay = page.locator('[data-testid="menu-overlay"]');
  await expect(menuOverlay).toBeHidden();

  const phaseLabel = page.locator('[data-testid="phase-label"]');
  await expect(phaseLabel).toHaveText('Exercise');
});

test('T4.1: round starts at 1', async ({ page }) => {
  await page.goto('/');
  const startBtn = page.locator('[data-testid="start-button"]');
  await startBtn.click();

  const roundLabel = page.locator('[data-testid="round-label"]');
  await expect(roundLabel).toHaveText('1');
});
