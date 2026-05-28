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

  const clickPoint = await page.evaluate(() => {
    const win = window as unknown as {
      __gridCellScreenPoint: (row: number, col: number) => { x: number; y: number } | null;
    };
    return win.__gridCellScreenPoint(4, 4);
  });
  expect(clickPoint).not.toBeNull();

  await page.mouse.click(clickPoint!.x, clickPoint!.y);

  await page.waitForTimeout(150);

  const newCount = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gridTowerCount'] as number
  );
  expect(newCount).toBe(1);

  // Clicking the same spot again should NOT add a second tower (cell already occupied)
  await page.mouse.click(clickPoint!.x, clickPoint!.y);
  await page.waitForTimeout(150);

  const countAfterSecondClick = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gridTowerCount'] as number
  );
  expect(countAfterSecondClick).toBe(1);
});
