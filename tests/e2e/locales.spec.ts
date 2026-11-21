import { expect, test } from '@playwright/test';

const SITE = 'https://chocoparty.uz';
const versions = [
  { path: '/', lang: 'ru' },
  { path: '/uz/', lang: 'uz' },
  { path: '/en/', lang: 'en' },
];

for (const version of versions) {
  test.describe(`home page ${version.path}`, () => {
    test('opens in its own language', async ({ page }) => {
      const response = await page.goto(version.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', version.lang);
    });

    test('declares all three language versions for search engines', async ({ page }) => {
      await page.goto(version.path);
      for (const other of versions) {
        await expect(
          page.locator(`head link[rel="alternate"][hreflang="${other.lang}"]`),
        ).toHaveAttribute('href', `${SITE}${other.path}`);
      }
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE}${version.path}`,
      );
    });

    test('language switch leads to the other two versions', async ({ page }) => {
      await page.goto(version.path);
      for (const other of versions.filter((item) => item !== version)) {
        await expect(page.locator(`[data-lang-switch] a[hreflang="${other.lang}"]`)).toHaveAttribute(
          'href',
          other.path,
        );
      }
    });
  });
}
