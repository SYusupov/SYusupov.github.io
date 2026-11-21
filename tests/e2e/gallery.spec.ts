import { expect, test } from '@playwright/test';

// Every photo and clip of an event carries its file name, so the manager can say which ones to keep
// (switched by SHOW_FILE_NAMES). The fixture event corporate-1 has photos 01–03 and the clip «clip».

test.describe('file names under the photos and clips of an event', () => {
  test('the cover is marked as the cover', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await expect(page.locator('article.event').getByText('обложка', { exact: true })).toBeVisible();
  });

  test('the clip and every photo show their file names, in page order', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await expect(page.locator('[data-gallery] figcaption')).toHaveText(['clip', '01', '02', '03']);
  });

  test('a photo opened full size shows its file name next to the counter', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await page.getByRole('link', { name: 'Открыть фото 2 крупно' }).click();
    await expect(page.locator('[data-lightbox-counter]')).toHaveText('2 из 3 · 02');
  });

  test('in English the cover is marked «cover»', async ({ page }) => {
    await page.goto('/en/events/corporate-1/');
    await expect(page.locator('article.event').getByText('cover', { exact: true })).toBeVisible();
  });
});
