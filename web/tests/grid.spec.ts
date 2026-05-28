import { test, expect } from '@playwright/test';

test('T3.1: clicking canvas places a tower mesh on the grid', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__gridReady'] === true,
    { timeout: 10000 }
  );

  const initialCount = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gridTowerCount'] as number
  );
  expect(initialCount).toBe(0);

  // Click the centre of the canvas — NDC (0,0) ray hits approx. (0,0,0) on the ground plane,
  // which falls inside the 8×8 grid centred at the origin.
  const canvas = page.locator('#game-canvas');
  await canvas.click();

  await page.waitForTimeout(150);

  const newCount = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gridTowerCount'] as number
  );
  expect(newCount).toBe(1);

  // Clicking the same spot again should NOT add a second tower (cell already occupied)
  await canvas.click();
  await page.waitForTimeout(150);

  const countAfterSecondClick = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gridTowerCount'] as number
  );
  expect(countAfterSecondClick).toBe(1);
});
