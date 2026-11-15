import { expect, test, type Locator } from '@playwright/test';

// Prices come from tests/fixtures/content/settings/prices.json: nine distinct numbers.

async function orderText(calculator: Locator) {
  const href = await calculator.getByRole('link', { name: 'Заказать этот набор' }).getAttribute('href');
  const url = new URL(href ?? '');
  return { address: `${url.origin}${url.pathname}`, text: url.searchParams.get('text') };
}

test.describe('price calculator', () => {
  test('shows the default package, its price and order link', async ({ page }) => {
    await page.goto('/');
    const calculator = page.locator('[data-calculator]');
    await expect(calculator.getByRole('radio', { name: /Средний/ })).toBeChecked();
    await expect(calculator.getByRole('radio', { name: /Optima/ })).toBeChecked();
    await expect(calculator.locator('[data-total]')).toHaveText('2 020 000 сум');
    expect(await orderText(calculator)).toEqual({
      address: 'https://t.me/choco_test',
      text: 'Здравствуйте! Хочу заказать шоколадный фонтан. Размер: Средний. Тариф: Optima. Цена на сайте: 2 020 000 сум. Дата и место праздника: ',
    });
  });

  test('another size and tariff change the price, the contents and the link', async ({ page }) => {
    await page.goto('/');
    const calculator = page.locator('[data-calculator]');
    await calculator.getByRole('radio', { name: /Большой/ }).check();
    await calculator.getByRole('radio', { name: /Maxima/ }).check();

    await expect(calculator.locator('[data-total]')).toHaveText('3 030 000 сум');
    await expect(calculator.getByText('3,5 кг клубники')).toBeVisible();
    expect((await orderText(calculator)).text).toBe(
      'Здравствуйте! Хочу заказать шоколадный фонтан. Размер: Большой. Тариф: Maxima. Цена на сайте: 3 030 000 сум. Дата и место праздника: ',
    );

    await calculator.getByRole('radio', { name: /Малый/ }).check();
    await expect(calculator.locator('[data-total]')).toHaveText('1 030 000 сум');
    await expect(calculator.getByText('1 кг клубники')).toBeVisible();
  });

  test('works in English with the English text', async ({ page }) => {
    await page.goto('/en/');
    const calculator = page.locator('[data-calculator]');
    await calculator.getByRole('radio', { name: /Light/ }).check();
    await expect(calculator.locator('[data-total]')).toHaveText('2,010,000 UZS');
    const href = await calculator.getByRole('link', { name: 'Order this package' }).getAttribute('href');
    expect(new URL(href ?? '').searchParams.get('text')).toBe(
      'Hello! I would like to order a chocolate fountain. Size: Medium. Package: Light. Price on the site: 2,010,000 UZS. Date and place of the celebration: ',
    );
  });
});
