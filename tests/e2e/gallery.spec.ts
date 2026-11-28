import { expect, test } from '@playwright/test';

// The manager's choice of photos is made, so event pages no longer carry file names under the photos
// and clips (switched by SHOW_FILE_NAMES). The fixture event corporate-1 has photos 01–03 and the clip «clip».

test.describe('an event page after the choice of photos', () => {
  test('the cover carries no «обложка» label', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await expect(page.locator('article.event img').first()).toBeVisible();
    await expect(page.locator('article.event').getByText('обложка', { exact: true })).toHaveCount(0);
  });

  test('photos and the clip carry no file names', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await expect(page.locator('[data-gallery] video, [data-gallery] img').first()).toBeVisible();
    await expect(page.locator('[data-gallery] figcaption')).toHaveCount(0);
  });

  test('a photo opened full size shows only the counter', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await page.getByRole('link', { name: 'Открыть фото 2 крупно' }).click();
    await expect(page.locator('[data-lightbox-counter]')).toHaveText('2 из 3');
  });

  test('in English the cover carries no «cover» label', async ({ page }) => {
    await page.goto('/en/events/corporate-1/');
    await expect(page.locator('article.event img').first()).toBeVisible();
    await expect(page.locator('article.event').getByText('cover', { exact: true })).toHaveCount(0);
  });
});
