import { expect, test } from '@playwright/test';

// Fixture content: Coca-Cola (SVG logo, one event), Olma (PNG logo, two events: clients «Olma» and
// «Olma Group»), Luna Catering (a site, no events) and Novikov Group (neither); one review written
// only in Russian.

test.describe('trust block on the home page', () => {
  test('companies that trust us are shown with their logos', async ({ page }) => {
    await page.goto('/');
    const trust = page.locator('[data-trust]');
    await expect(trust.getByRole('img', { name: 'Coca-Cola' })).toBeVisible();
    await expect(trust.getByRole('img', { name: 'Olma' })).toBeVisible();
  });

  test('a logo of a company with one event leads to that event, in the same tab', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('[data-trust]').getByRole('link', { name: 'Мероприятия для Coca-Cola' });
    await expect(link).toHaveAttribute('href', '/events/corporate-1/');
    expect(await link.getAttribute('target')).toBeNull();
  });

  test('a logo of a company with several events leads to the list of its events', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('[data-trust]').getByRole('link', { name: 'Мероприятия для Olma' });
    await expect(link).toHaveAttribute('href', '/events/?client=olma');
    await link.click();
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(2);
    await expect(page.locator('[data-event-card]:visible a[href="/events/exhibition-1/"]')).toHaveCount(1);
    await expect(page.locator('[data-event-card]:visible a[href="/events/new-year-1/"]')).toHaveCount(1);
    await expect(page.getByText('Мероприятия для Olma', { exact: true })).toBeVisible();
  });

  test('the list of one company’s events offers a way back to all events', async ({ page }) => {
    await page.goto('/events/?client=olma');
    await page.locator('[data-client-filter]').getByRole('link', { name: 'Все мероприятия' }).click();
    await expect(page).toHaveURL('/events/');
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(8);
  });

  test('an unknown company in the address changes nothing: every event is listed', async ({ page }) => {
    await page.goto('/events/?client=unknown');
    await expect(page.locator('[data-event-card]:visible')).toHaveCount(8);
    await expect(page.locator('[data-client-filter]')).toBeHidden();
  });

  test('a logo of a company without events leads to its site in a new tab, without referrer or search weight', async ({
    page,
  }) => {
    await page.goto('/');
    const link = page.locator('[data-trust]').getByRole('link', { name: 'Luna Catering' });
    await expect(link).toHaveAttribute('href', 'https://example.com/luna');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
    await expect(link).toHaveAttribute('rel', /nofollow/);
  });

  test('a company without events or a site stays a plain logo', async ({ page }) => {
    await page.goto('/');
    const trust = page.locator('[data-trust]');
    await expect(trust.getByRole('img', { name: 'Novikov Group' })).toBeVisible();
    await expect(trust.getByRole('link', { name: /Novikov Group/ })).toHaveCount(0);
  });

  test('in English a logo leads to the English event page', async ({ page }) => {
    await page.goto('/en/');
    const link = page.locator('[data-trust]').getByRole('link', { name: 'Events for Coca-Cola' });
    await expect(link).toHaveAttribute('href', '/en/events/corporate-1/');
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
