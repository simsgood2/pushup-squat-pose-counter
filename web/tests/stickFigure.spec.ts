import { test, expect } from '@playwright/test';
import type { LandmarkResult } from '../src/mocap/poseStream';

// Generate 33 mock landmarks spread across a human-sized volume
function makeMockLandmarks(): LandmarkResult {
  const landmarks = Array.from({ length: 33 }, (_, i) => ({
    x: ((i % 6) - 3) * 0.15,
    y: (Math.floor(i / 6) - 2) * 0.2,
    z: 0.0,
    visibility: 1.0,
  }));
  return { landmarks: [landmarks], worldLandmarks: [landmarks] };
}

test('T1.4: stick figure renders 33 landmark spheres via mock injection', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__stickFigureReady'] === true,
    { timeout: 10000 }
  );

  const mockResult = makeMockLandmarks();

  await page.evaluate((result) => {
    const w = window as unknown as Record<string, unknown>;
    (w['__updatePose'] as (r: unknown) => void)(result);
  }, mockResult);

  // Allow one render frame
  await page.waitForTimeout(150);

  const visibleCount = await page.evaluate(() => {
    return (window as unknown as Record<string, unknown>)['__visibleSphereCount'] as number;
  });

  expect(visibleCount).toBe(33);

  // Also verify canvas has rendered content (non-trivial data URL)
  const canvasHasContent = await page.evaluate(() => {
    const c = document.getElementById('game-canvas') as HTMLCanvasElement;
    return c.toDataURL().length > 1000;
  });
  expect(canvasHasContent).toBe(true);
});
