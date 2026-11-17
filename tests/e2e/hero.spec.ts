import { expect, test } from '@playwright/test';

// The first screen of the home page: a poster photo with two tall (9:16) clips that play one after
// another. On a computer the text is on the left and the clip beside it; on a phone the clip is on
// top and the text under it. A visitor who saves data or avoids motion keeps the photo.

const box = async (page: import('@playwright/test').Page, selector: string) => {
  const found = await page.locator(selector).boundingBox();
  if (!found) throw new Error(`${selector} has no box`);
  return found;
};

for (const [name, viewport] of [
  ['a laptop', { width: 1280, height: 720 }],
  ['a desktop', { width: 1440, height: 900 }],
  ['a full HD screen', { width: 1920, height: 1080 }],
] as const) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test('the clip stands beside the text, not over it, and both fit the first screen', async ({ page }) => {
      await page.goto('/');
      const text = await box(page, '[data-hero-content]');
      const media = await box(page, '[data-hero-media]');
      expect(media.x).toBeGreaterThanOrEqual(text.x + text.width);
      expect(media.height).toBeGreaterThan(media.width);
      expect(media.y + media.height).toBeLessThanOrEqual(viewport.height);
      const button = await box(page, '[data-hero-content] a.btn--primary');
      expect(button.y + button.height).toBeLessThanOrEqual(viewport.height);
    });
  });
}

for (const [name, viewport, wide] of [
  ['a small phone', { width: 360, height: 640 }, true],
  ['a phone', { width: 390, height: 664 }, true],
  ['a tall phone', { width: 430, height: 932 }, true],
  ['a tablet', { width: 820, height: 1180 }, false],
] as const) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test('the clip is on top, the text under it, and the headline starts on the first screen', async ({ page }) => {
      await page.goto('/');
      const media = await box(page, '[data-hero-media]');
      const heading = await box(page, '[data-hero-content] h1');
      expect(media.y + media.height).toBeLessThanOrEqual(heading.y);
      if (wide) expect(media.width).toBeGreaterThan(viewport.width - 40);
      else expect(media.width).toBeLessThan(viewport.width - 40);
      expect(heading.y).toBeLessThan(viewport.height);
    });
  });
}

test.describe('the clips', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('computers get the larger files: the first clip once the page is loaded, the next once the first plays', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/media/hero-')) requested.push(new URL(request.url()).pathname);
    });
    await page.goto('/');
    const videos = page.locator('[data-hero-video]');
    await expect(videos).toHaveCount(2);
    await expect(videos.nth(0)).toHaveAttribute('src', '/media/hero-1.mp4', { timeout: 8_000 });
    await expect(videos.nth(1)).toHaveAttribute('src', '/media/hero-2.mp4', { timeout: 10_000 });
    expect(requested.find((path) => path.endsWith('.mp4'))).toBe('/media/hero-1.mp4');
  });

  test('a visitor who avoids motion keeps the photo and loads no video', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForTimeout(2_000);
    await expect(page.locator('[data-hero-video]').first()).not.toHaveAttribute('src', /.+/);
    await expect(page.locator('[data-hero-media] img')).toBeVisible();
    await context.close();
  });

  test('the second clip takes over when the first ends', async ({ browser }) => {
    // The test browser plays no H.264: a tiny WebM of the same length stands in for both clips.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.route('**/media/hero-*.mp4', (route) =>
      route.fulfill({ path: 'tests/fixtures/media/tiny.webm', contentType: 'video/webm' }),
    );
    await page.goto('/');
    const videos = page.locator('[data-hero-video]');
    await expect(videos.nth(0)).toHaveClass(/is-playing/, { timeout: 10_000 });
    await expect(videos.nth(1)).toHaveClass(/is-playing/, { timeout: 10_000 });
    await expect(videos.nth(0)).not.toHaveClass(/is-playing/);
    await context.close();
  });
});

test.describe('on a phone the smaller files are used', () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test('the first clip is the 540 px one', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-hero-video]').first()).toHaveAttribute('src', '/media/hero-1-s.mp4', { timeout: 8_000 });
  });
});
