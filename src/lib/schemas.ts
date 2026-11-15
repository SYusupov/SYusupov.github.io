/**
 * Content rules shared by the Astro build, the pre-build content check and the tests.
 * Only what the admin form itself prevents may stop a publication; everything else is
 * normalised here (see the plan, section 5.4). Messages are in Russian for the admin.
 */
import { z } from 'astro/zod';
import { PRICE_MAX, PRICE_MIN } from './domain';

/** '' and null from the admin panel mean «not filled». */
const blankToUndefined = (value: unknown) =>
  value === '' || value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

export const optionalText = z.preprocess(blankToUndefined, z.string().trim().optional());

/** Text in up to three languages; any language may be missing. */
export const localizedText = z.preprocess(
  (value) => blankToUndefined(value) ?? {},
  z.object({ ru: optionalText, uz: optionalText, en: optionalText }),
);

const price = z
  .number({ error: 'Укажите цену числом' })
  .int('Цена должна быть целым числом')
  .min(PRICE_MIN, `Цена не меньше ${PRICE_MIN.toLocaleString('ru-RU')} сум`)
  .max(PRICE_MAX, `Цена не больше ${PRICE_MAX.toLocaleString('ru-RU')} сум`);

const tariffPrices = z.object({ light: price, optima: price, maxima: price });

export const pricesSchema = z.object({ small: tariffPrices, medium: tariffPrices, large: tariffPrices });

export const siteSchema = z.object({
  telegram: z
    .string({ error: 'Укажите имя пользователя Telegram' })
    .regex(/^[A-Za-z0-9_]{5,32}$/, 'Имя пользователя Telegram: латинские буквы, цифры и _, от 5 до 32 знаков, без @'),
  phone: z
    .string({ error: 'Укажите телефон' })
    .regex(/^\+998\d{9}$/, 'Телефон в виде +998XXXXXXXXX, без пробелов'),
  contactName: localizedText,
  instagram: optionalText,
  ordersCount: z.number({ error: 'Укажите число заказов' }).int().min(0, 'Число заказов не может быть отрицательным'),
  foundedYear: z.number().int().min(1990).max(2100),
  gaId: optionalText,
  metrikaId: optionalText,
});

export type SiteSettings = z.infer<typeof siteSchema>;
