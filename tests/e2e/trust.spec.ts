import { expect, test } from '@playwright/test';

// Fixture content: Coca-Cola (SVG logo) and Olma (PNG logo); one review written only in Russian.

test.describe('trust block on the home page', () => {
  test('companies that trust us are shown with their logos', async ({ page }) => {
    await page.goto('/');
    const trust = page.locator('[data-trust]');
    await expect(trust.getByRole('img', { name: 'Coca-Cola' })).toBeVisible();
    await expect(trust.getByRole('img', { name: 'Olma' })).toBeVisible();
  });

  test('a review appears on the page of the language it is written in', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-reviews]')).toContainText('Фонтан стал главным украшением вечера');
  });

  test('there is no review block where no review is written in that language', async ({ page }) => {
    await page.goto('/uz/');
    await expect(page.locator('[data-trust]')).toBeVisible();
    await expect(page.locator('[data-reviews]')).toHaveCount(0);
  });
});
