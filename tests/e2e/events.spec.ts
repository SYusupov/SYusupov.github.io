import { expect, test } from '@playwright/test';

// Fixture content: eight events; the newest is corporate-1, the oldest other-1. Addresses carry no date.
const NEWEST = '/events/corporate-1/';
const OLDEST = '/events/other-1/';

test.describe('a new event shows up everywhere it should', () => {
  test('on the home page among the five latest', async ({ page }) => {
    await page.goto('/');
    const latest = page.locator('#events');
    await expect(latest.locator(`a[href="${NEWEST}"]`)).toBeVisible();
    await expect(latest.locator('[data-event-card]')).toHaveCount(5);
    await expect(latest.locator(`a[href="${OLDEST}"]`)).toHaveCount(0);
    await expect(latest.getByRole('link', { name: 'Все мероприятия' })).toHaveAttribute('href', '/events/');
  });

  test('in the list of all events', async ({ page }) => {
    await page.goto('/events/');
    await expect(page.locator(`a[href="${NEWEST}"]`)).toBeVisible();
    await expect(page.locator('[data-event-card]')).toHaveCount(8);
  });

  test('on its own page: title, sentence, photos, video and «Хочу так же»', async ({ page }) => {
    await page.goto(NEWEST);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Корпоратив Coca-Cola');
    await expect(
      page.getByText('Большой шоколадный фонтан на корпоративе Coca-Cola, Hyatt Regency Tashkent.', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-gallery] img')).toHaveCount(3);
    await expect(page.locator('[data-gallery] video')).toHaveAttribute('poster', /\.webp$/);
    const href = await page.getByRole('link', { name: 'Хочу так же' }).first().getAttribute('href');
    expect(new URL(href ?? '').searchParams.get('text')).toBe(
      'Здравствуйте! Хочу шоколадный фонтан, как на этом мероприятии: Корпоратив Coca-Cola (https://chocoparty.uz/events/corporate-1/). Дата и место моего праздника: ',
    );
  });

  test('on the page of its occasion, without events of other types', async ({ page }) => {
    await page.goto('/occasions/corporate/');
    await expect(page.locator(`a[href="${NEWEST}"]`)).toBeVisible();
    await expect(page.locator('a[href="/events/wedding-1/"]')).toHaveCount(0);
  });

  test('in English on its English page', async ({ page }) => {
    await page.goto('/en/events/corporate-1/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Corporate event: Coca-Cola');
  });
});

test.describe('no date is shown anywhere for an event', () => {
  for (const path of ['/events/corporate-1/', '/uz/events/corporate-1/', '/en/events/corporate-1/']) {
    test(`not on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('article.event')).not.toContainText(/\b20\d\d\b/);
      expect(await page.title()).not.toMatch(/\b20\d\d\b/);
      expect(await page.locator('meta[property="og:title"]').getAttribute('content')).not.toMatch(/\b20\d\d\b/);
      expect(await page.locator('meta[name="description"]').getAttribute('content')).not.toMatch(/\b20\d\d\b/);
    });
  }

  test('the eyebrow over the title names the type only', async ({ page }) => {
    await page.goto('/events/corporate-1/');
    await expect(page.locator('article.event .eyebrow')).toHaveText('Корпоратив');
  });

  test('the address of every event in the list has no date', async ({ page }) => {
    await page.goto('/events/');
    const hrefs = await page.locator('[data-event-card] a').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs).toHaveLength(8);
    for (const href of hrefs) expect(href).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

test.describe('filters on the list of all events', () => {
  test('a type given in the address shows only that type', async ({ page }) => {
    await page.goto('/events/?type=wedding');
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Свадьба' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('there is no filter by year, only by type', async ({ page }) => {
    await page.goto('/events/');
    await expect(page.getByRole('group', { name: 'Тип мероприятия' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Год' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Все годы' })).toHaveCount(0);
  });

  test('a year left in an old address changes nothing: every event is listed', async ({ page }) => {
    await page.goto('/events/?year=2024');
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(8);
  });
});

test.describe('the New Year occasion', () => {
  test('has a card among the occasions on the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/occasions/new-year/"]').first()).toBeVisible();
  });

  test('has its own page with its events only', async ({ page }) => {
    await page.goto('/occasions/new-year/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Шоколадный фонтан на Новый год');
    await expect(page.locator('a[href="/events/new-year-1/"]').first()).toBeVisible();
    await expect(page.locator(`a[href="${NEWEST}"]`)).toHaveCount(0);
  });

  test('has an English page', async ({ page }) => {
    await page.goto('/en/occasions/new-year/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chocolate fountain for New Year');
  });

  test('is a filter on the list of all events', async ({ page }) => {
    await page.goto('/events/?type=new-year');
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Новый год' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('names the event a New Year party', async ({ page }) => {
    await page.goto('/events/new-year-1/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Новогодний праздник Olma Group');
  });
});

test.describe('event cards do not show dates', () => {
  for (const [path, cards] of [
    ['/', 5],
    ['/events/', 8],
    ['/uz/events/', 8],
    ['/en/events/', 8],
  ] as const) {
    test(`on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('[data-event-card]')).toHaveCount(cards);
      await expect(page.locator('[data-event-card] .chip')).toHaveCount(0);
      await expect(page.locator('[data-event-card]').getByText(/\b20\d\d\b/)).toHaveCount(0);
    });
  }
});
