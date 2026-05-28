import { test, expect } from '@playwright/test';

test('T4.1: initial phase is Menu', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__phase'] === 'function',
    { timeout: 10000 }
  );
  const phase = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__phase']?.()
  );
  expect(phase).toBe('Menu');
});

test('T4.1: start button click transitions to Exercise', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__phase'] === 'function',
    { timeout: 10000 }
  );
  await page.click('[data-testid="start-button"]');
  const phase = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__phase']?.()
  );
  expect(phase).toBe('Exercise');
});

test('T4.1: __forcePhase forces Defense state', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__forcePhase'] === 'function',
    { timeout: 10000 }
  );
  await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__forcePhase']?.('Defense')
  );
  const phase = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__phase']?.()
  );
  expect(phase).toBe('Defense');
});

test('T4.1: __round returns current round', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__round'] === 'function',
    { timeout: 10000 }
  );
  const round = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__round']?.()
  );
  expect(round).toBe(1);
});
