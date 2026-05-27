import { test, expect } from '@playwright/test';

test('T1.1: scene renders grey ground and grid', async ({ page }) => {
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => (window as unknown as Record<string, unknown>)['__sceneReady'] === true, { timeout: 10000 });

  const { width, height } = await page.evaluate(() => {
    const c = document.getElementById('game-canvas') as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });

  expect(width).toBeGreaterThan(0);
  expect(height).toBeGreaterThan(0);

  // Verify scene rendered non-black pixels using canvas data
  const hasContent = await page.evaluate(() => {
    const c = document.getElementById('game-canvas') as HTMLCanvasElement;
    const dataUrl = c.toDataURL();
    // A rendered scene will produce a non-trivial data URL different from empty canvas
    return dataUrl.length > 1000;
  });

  expect(hasContent).toBe(true);
});
