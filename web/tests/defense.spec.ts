import { expect, test } from '@playwright/test';

test('T3.2: a placed tower kills wave enemies before they reach the end', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');

  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__gridReady'] === true,
    { timeout: 10000 }
  );

  const placed = await page.evaluate(() => {
    const win = window as unknown as {
      __placeGridTower: (row: number, col: number) => boolean;
    };
    return win.__placeGridTower(4, 4);
  });
  expect(placed).toBe(true);

  await page.waitForFunction(
    () => {
      const win = window as unknown as Record<string, unknown>;
      return win['__defenseSpawnedEnemyCount'] === 5 &&
        win['__defenseKilledEnemyCount'] === 5 &&
        win['__defenseReachedEndCount'] === 0 &&
        win['__defenseWaveComplete'] === true;
    },
    { timeout: 45000 }
  );

  const finalState = await page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    return {
      alive: win['__defenseAliveEnemyCount'],
      killed: win['__defenseKilledEnemyCount'],
      reachedEnd: win['__defenseReachedEndCount'],
      spawned: win['__defenseSpawnedEnemyCount'],
      complete: win['__defenseWaveComplete'],
    };
  });

  expect(finalState).toEqual({
    alive: 0,
    killed: 5,
    reachedEnd: 0,
    spawned: 5,
    complete: true,
  });
});
