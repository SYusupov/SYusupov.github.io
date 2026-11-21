import { expect, test } from '@playwright/test';

// The fixture site is built as of 2025-12-15 12:00 Tashkent (BUILD_NOW). Fixture promotions:
//   «Новогодняя акция» 2025-12-01…2025-12-31, «День влюблённых» 2026-02-01…2026-02-14,
//   «Чёрная пятница» 2025-11-20…2025-11-30 (over before the build).
// The browser clock is set per test: a promotion appears and disappears by its dates by itself.

const at = (iso: string) => new Date(iso);

test.describe('promotions follow their dates in Tashkent time', () => {
  test('a running promotion shows on the home page and in the strip on every page', async ({ page }) => {
    await page.clock.setFixedTime(at('2025-12-15T12:00:00+05:00'));
    await page.goto('/');
    await expect(page.locator('[data-promo-block]').getByText('Новогодняя акция')).toBeVisible();
    await page.goto('/events/');
    await expect(page.locator('[data-promo-strip]').getByText('Новогодняя акция')).toBeVisible();
  });

  test('a promotion ahead of its dates stays hidden, then appears on its first day without a new build', async ({ page }) => {
    await page.clock.setFixedTime(at('2026-01-31T23:59:00+05:00'));
    await page.goto('/');
    await expect(page.getByText('День влюблённых')).toHaveCount(2);
    await expect(page.getByText('День влюблённых').first()).toBeHidden();
    await page.clock.setFixedTime(at('2026-02-01T00:01:00+05:00'));
    await page.goto('/');
    await expect(page.locator('[data-promo-block]').getByText('День влюблённых')).toBeVisible();
  });

  test('the last day counts in full, and the next morning the promotion is gone', async ({ page }) => {
    await page.clock.setFixedTime(at('2025-12-31T23:30:00+05:00'));
    await page.goto('/');
    await expect(page.locator('[data-promo-block]').getByText('Новогодняя акция')).toBeVisible();
    await page.clock.setFixedTime(at('2026-01-01T00:30:00+05:00'));
    await page.goto('/');
    await expect(page.locator('[data-promo-block]').getByText('Новогодняя акция')).toBeHidden();
  });

  test('a promotion over before the build is not on the page at all', async ({ page }) => {
    await page.clock.setFixedTime(at('2025-12-15T12:00:00+05:00'));
    await page.goto('/');
    await expect(page.getByText('Чёрная пятница')).toHaveCount(0);
  });

  test('a promotion without text in the page language is left out of that language', async ({ page }) => {
    await page.clock.setFixedTime(at('2025-12-15T12:00:00+05:00'));
    await page.goto('/uz/');
    await expect(page.locator('[data-promo-block]')).toHaveCount(0);
    await page.goto('/en/');
    await expect(page.locator('[data-promo-block]').getByText('New Year offer')).toBeVisible();
  });
});
