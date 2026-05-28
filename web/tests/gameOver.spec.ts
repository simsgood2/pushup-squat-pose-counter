import { expect, test } from '@playwright/test';

test('T4.2/T4.3: 적이 끝점 도달 시 라이프 감소 후 GameOver 전환', async ({ page }) => {
  test.setTimeout(30000);

  await page.goto('/');

  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__forcePhase'] === 'function',
    { timeout: 10000 }
  );

  // Defense 페이즈 강제 진입 + 라이프 1로 설정
  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    (win['__forcePhase'] as (p: string) => void)('Defense');
    (win['__setLives'] as (n: number) => void)(1);
  });

  const livesBeforeWave = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__lives']?.()
  );
  expect(livesBeforeWave).toBe(1);

  // 웨이브 시작 (타워 없이)
  await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__startDefenseWave']?.()
  );

  // 적이 끝점 도달 → lives=0 → GameOver
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__phase']?.() === 'GameOver',
    { timeout: 20000 }
  );

  const finalPhase = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__phase']?.()
  );
  expect(finalPhase).toBe('GameOver');

  const finalLives = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__lives']?.()
  );
  expect(finalLives).toBe(0);
});

test('T4.2: 골드 0으로 타워 배치 불가', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__forcePhase'] === 'function',
    { timeout: 10000 }
  );

  await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__forcePhase']?.('Defense')
  );

  // 골드 0인 상태에서 타워 배치 시도
  const placed = await page.evaluate(() => {
    const win = window as unknown as { __placeGridTower: (r: number, c: number) => boolean };
    return win.__placeGridTower(0, 0);
  });
  expect(placed).toBe(false);

  const towerCount = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gridTowerCount'] as number
  );
  expect(towerCount).toBe(0);
});

test('T4.2: 골드 충분 시 타워 배치 성공 + 골드 차감', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(
    () => typeof (window as unknown as Record<string, unknown>)['__forcePhase'] === 'function',
    { timeout: 10000 }
  );

  await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    (win['__forcePhase'] as (p: string) => void)('Defense');
    (win['__addGold'] as (n: number) => void)(50);
  });

  const goldBefore = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gold']?.()
  );
  expect(goldBefore).toBe(50);

  const placed = await page.evaluate(() => {
    const win = window as unknown as { __placeGridTower: (r: number, c: number) => boolean };
    return win.__placeGridTower(0, 0);
  });
  expect(placed).toBe(true);

  const goldAfter = await page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__gold']?.()
  );
  expect(goldAfter).toBe(20); // 50 - 30 = 20
});
