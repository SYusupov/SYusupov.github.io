import { describe, expect, it } from 'vitest';
import { eventOrderLink, packageOrderLink } from '../../src/lib/order-link';

function decode(link: string) {
  const url = new URL(link);
  return { address: `${url.origin}${url.pathname}`, text: url.searchParams.get('text') };
}

describe('order link for a package chosen in the calculator', () => {
  const choice = { telegram: 'choco_test', size: 'medium', tariff: 'optima', price: 4_100_000 } as const;

  it('Russian', () => {
    expect(decode(packageOrderLink({ ...choice, locale: 'ru' }))).toEqual({
      address: 'https://t.me/choco_test',
      text: 'Здравствуйте! Хочу заказать шоколадный фонтан. Размер: Средний. Тариф: Optima. Цена на сайте: 4 100 000 сум. Дата и место праздника: ',
    });
  });

  it('Uzbek', () => {
    expect(decode(packageOrderLink({ ...choice, locale: 'uz' }))).toEqual({
      address: 'https://t.me/choco_test',
      text: "Assalomu alaykum! Shokoladli favvora buyurtma qilmoqchiman. O'lcham: O'rtacha. Tarif: Optima. Saytdagi narx: 4 100 000 so'm. Bayram sanasi va manzili: ",
    });
  });

  it('English', () => {
    expect(decode(packageOrderLink({ ...choice, locale: 'en' }))).toEqual({
      address: 'https://t.me/choco_test',
      text: 'Hello! I would like to order a chocolate fountain. Size: Medium. Package: Optima. Price on the site: 4,100,000 UZS. Date and place of the celebration: ',
    });
  });

  it('another size and tariff change the text', () => {
    const link = packageOrderLink({ ...choice, size: 'large', tariff: 'maxima', price: 8_700_000, locale: 'ru' });
    expect(decode(link).text).toBe(
      'Здравствуйте! Хочу заказать шоколадный фонтан. Размер: Большой. Тариф: Maxima. Цена на сайте: 8 700 000 сум. Дата и место праздника: ',
    );
  });
});

describe('order link from an event page («Хочу так же»)', () => {
  const event = {
    telegram: 'choco_test',
    title: 'Корпоратив Coca-Cola',
    url: 'https://chocoparty.uz/events/corporate-1/',
  };

  it('Russian', () => {
    expect(decode(eventOrderLink({ ...event, locale: 'ru' }))).toEqual({
      address: 'https://t.me/choco_test',
      text: 'Здравствуйте! Хочу шоколадный фонтан, как на этом мероприятии: Корпоратив Coca-Cola (https://chocoparty.uz/events/corporate-1/). Дата и место моего праздника: ',
    });
  });

  it('English', () => {
    expect(decode(eventOrderLink({ ...event, title: 'Corporate event: Coca-Cola', locale: 'en' })).text).toBe(
      'Hello! I would like a chocolate fountain like at this event: Corporate event: Coca-Cola (https://chocoparty.uz/events/corporate-1/). Date and place of my celebration: ',
    );
  });
});
