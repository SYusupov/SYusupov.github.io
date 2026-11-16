import { expect, test } from '@playwright/test';

// Fixture content: seven events; the newest is 2025-12-14-corporate, the oldest 2023-12-30-other.
const NEWEST = '/events/2025-12-14-corporate/';
const OLDEST = '/events/2023-12-30-other/';

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
    await expect(page.locator('[data-event-card]')).toHaveCount(7);
  });

  test('on its own page: title, sentence, photos, video and «Хочу так же»', async ({ page }) => {
    await page.goto(NEWEST);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Корпоратив Coca-Cola');
    await expect(
      page.getByText('Большой шоколадный фонтан на корпоративе Coca-Cola, Hyatt Regency Tashkent, декабрь 2025.'),
    ).toBeVisible();
    await expect(page.locator('[data-gallery] img')).toHaveCount(3);
    await expect(page.locator('[data-gallery] video')).toHaveAttribute('poster', /\.webp$/);
    const href = await page.getByRole('link', { name: 'Хочу так же' }).first().getAttribute('href');
    expect(new URL(href ?? '').searchParams.get('text')).toBe(
      'Здравствуйте! Хочу шоколадный фонтан, как на этом мероприятии: Корпоратив Coca-Cola (https://chocoparty.uz/events/2025-12-14-corporate/). Дата и место моего праздника: ',
    );
  });

  test('on the page of its occasion, without events of other types', async ({ page }) => {
    await page.goto('/occasions/corporate/');
    await expect(page.locator(`a[href="${NEWEST}"]`)).toBeVisible();
    await expect(page.locator('a[href="/events/2025-11-02-wedding/"]')).toHaveCount(0);
  });

  test('in English on its English page', async ({ page }) => {
    await page.goto('/en/events/2025-12-14-corporate/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Corporate event: Coca-Cola');
  });
});

test.describe('filters on the list of all events', () => {
  test('a type given in the address shows only that type', async ({ page }) => {
    await page.goto('/events/?type=wedding');
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Свадьба' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('choosing a year narrows the list and goes into the address', async ({ page }) => {
    await page.goto('/events/');
    await page.getByRole('button', { name: '2024', exact: true }).click();
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(2);
    await expect(page).toHaveURL(/[?&]year=2024/);
    await page.getByRole('button', { name: 'Все годы' }).click();
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(7);
  });
});
