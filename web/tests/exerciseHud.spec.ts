import { test, expect } from '@playwright/test';
import type { LandmarkResult } from '../src/mocap/poseStream';

function makeBase33(): { x: number; y: number; z: number; visibility: number }[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1.0 }));
}

// Jumping jack — closed: arms down, feet together
function makeJJClosed(): LandmarkResult {
  const lm = makeBase33();
  lm[11] = { x: -0.2, y: 0.2, z: 0, visibility: 1 }; // LEFT_SHOULDER
  lm[12] = { x:  0.2, y: 0.2, z: 0, visibility: 1 }; // RIGHT_SHOULDER
  lm[15] = { x: -0.2, y: 0.6, z: 0, visibility: 1 }; // LEFT_WRIST (below shoulder)
  lm[16] = { x:  0.2, y: 0.6, z: 0, visibility: 1 }; // RIGHT_WRIST
  lm[27] = { x: -0.05, y: 1.8, z: 0, visibility: 1 }; // LEFT_ANKLE (together)
  lm[28] = { x:  0.05, y: 1.8, z: 0, visibility: 1 }; // RIGHT_ANKLE
  return { landmarks: [lm], worldLandmarks: [lm] };
}

// Jumping jack — open: arms raised, feet apart
function makeJJOpen(): LandmarkResult {
  const lm = makeBase33();
  lm[11] = { x: -0.2, y: 0.2, z: 0, visibility: 1 }; // LEFT_SHOULDER
  lm[12] = { x:  0.2, y: 0.2, z: 0, visibility: 1 }; // RIGHT_SHOULDER
  // wristY (0.1) < shoulderY (0.2) - 0.05 (= 0.15) → arms raised
  lm[15] = { x: -0.5, y: 0.1, z: 0, visibility: 1 }; // LEFT_WRIST (raised)
  lm[16] = { x:  0.5, y: 0.1, z: 0, visibility: 1 }; // RIGHT_WRIST
  lm[27] = { x: -0.3, y: 1.8, z: 0, visibility: 1 }; // LEFT_ANKLE (apart)
  lm[28] = { x:  0.3, y: 1.8, z: 0, visibility: 1 }; // RIGHT_ANKLE
  return { landmarks: [lm], worldLandmarks: [lm] };
}

test('T2.7: HUD renders and shows non-zero gold after jumping jack rep', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__hudReady'] === true,
    { timeout: 10000 }
  );

  const hud = page.locator('[data-testid="exercise-hud"]');
  await expect(hud).toBeVisible();

  const goldEl = page.locator('[data-testid="gold"]');
  await expect(goldEl).toHaveText('0');

  // Frame 1 (closed) → JumpingJack phase: ready → down
  await page.evaluate((result) => {
    const w = window as unknown as Record<string, unknown>;
    (w['__updatePose'] as (r: unknown) => void)(result);
  }, makeJJClosed());

  await page.waitForTimeout(50);

  // Frame 2 (open) → JumpingJack phase: down → up, count++, gold += 4
  await page.evaluate((result) => {
    const w = window as unknown as Record<string, unknown>;
    (w['__updatePose'] as (r: unknown) => void)(result);
  }, makeJJOpen());

  await page.waitForTimeout(100);

  const goldText = await goldEl.textContent();
  expect(Number(goldText)).toBeGreaterThan(0);
});
