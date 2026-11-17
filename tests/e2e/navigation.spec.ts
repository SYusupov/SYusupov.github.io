import { expect, test } from '@playwright/test';

// Seam 6: the language switch keeps the visitor on the same page, and the old addresses lead on.

const pages = [
  { name: 'all events', ru: '/events/', uz: '/uz/events/', en: '/en/events/' },
  {
    name: 'an event',
    ru: '/events/corporate-1/',
    uz: '/uz/events/corporate-1/',
    en: '/en/events/corporate-1/',
  },
  { name: 'an occasion', ru: '/occasions/wedding/', uz: '/uz/occasions/wedding/', en: '/en/occasions/wedding/' },
];

for (const item of pages) {
  test(`the language switch on ${item.name} leads to the same page in the other languages`, async ({ page }) => {
    for (const current of ['ru', 'uz', 'en'] as const) {
      await page.goto(item[current]);
      await expect(page.locator('html')).toHaveAttribute('lang', current);
      for (const other of (['ru', 'uz', 'en'] as const).filter((locale) => locale !== current)) {
        await expect(page.locator(`[data-lang-switch] a[hreflang="${other}"]`)).toHaveAttribute('href', item[other]);
      }
    }
  });
}

test.describe('old addresses of the previous site', () => {
  for (const [old, target] of [
    ['/uz.html', '/uz/'],
    ['/en.html', '/en/'],
  ]) {
    test(`${old} leads to ${target}`, async ({ page }) => {
      await page.goto(old);
      await expect(page).toHaveURL(new RegExp(`${target.replaceAll('/', '\\/')}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', target.replaceAll('/', ''));
    });
  }

  test('an unknown address shows the «not found» page with a way home', async ({ page }) => {
    const response = await page.goto('/no-such-page/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('link', { name: 'На главную', exact: true })).toHaveAttribute('href', '/');
  });
});
