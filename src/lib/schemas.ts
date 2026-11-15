/**
 * Content rules shared by the Astro build, the pre-build content check and the tests.
 * Only what the admin form itself prevents may stop a publication; everything else is
 * normalised here, and `eventWarnings` reports what was fixed (plan, section 5.4).
 * Messages are Russian sentence fragments: the check prints «<file>: «<field>» — <message>».
 */
import { z } from 'astro/zod';
import { ru } from '../i18n/ru';
import { EVENT_TYPES, FOUNTAINS, GALLERY_MAX, PRICE_MAX, PRICE_MIN, VIDEOS_MAX } from './domain';
import { formatSum, plainSpaces } from './format';

/** '' and null from the admin panel mean «not filled». */
const blankToUndefined = (value: unknown) =>
  value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

export const optionalText = z.preprocess(blankToUndefined, z.string().trim().optional());

/** Text in up to three languages; any language may be missing. */
export const localizedText = z.preprocess(
  (value) => blankToUndefined(value) ?? {},
  z.object({ ru: optionalText, uz: optionalText, en: optionalText }),
);

/** File lists from the admin: empty slots, failed-upload `blob:` links and repeats are dropped. */
function cleanFileList(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) return value;
  const kept: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '' || item.startsWith('blob:') || kept.includes(item)) continue;
    kept.push(item);
  }
  return kept;
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const sum = (amount: number) => plainSpaces(formatSum(amount, 'ru'));

const price = z
  .number({ error: 'укажите цену числом' })
  .int('цена должна быть целым числом')
  .min(PRICE_MIN, `цена не меньше ${sum(PRICE_MIN)}`)
  .max(PRICE_MAX, `цена не больше ${sum(PRICE_MAX)}`);

const tariffPrices = z.object({ light: price, optima: price, maxima: price });

export const pricesSchema = z.object({ small: tariffPrices, medium: tariffPrices, large: tariffPrices });

export const siteSchema = z.object({
  telegram: z
    .string({ error: 'укажите имя пользователя Telegram' })
    .regex(/^[A-Za-z0-9_]{5,32}$/, 'имя пользователя Telegram: латинские буквы, цифры и _, от 5 до 32 знаков, без @'),
  phone: z.string({ error: 'укажите телефон' }).regex(/^\+998\d{9}$/, 'телефон в виде +998XXXXXXXXX, без пробелов'),
  contactName: localizedText,
  instagram: optionalText,
  ordersCount: z.number({ error: 'укажите число заказов' }).int().min(0, 'число заказов не может быть отрицательным'),
  foundedYear: z.number().int().min(1990).max(2100),
  gaId: optionalText,
  metrikaId: optionalText,
});

export type SiteSettings = z.infer<typeof siteSchema>;

/**
 * Schemas whose photo fields depend on where they run: Astro passes `image()` (the file is
 * resolved and processed), the Node check passes a plain string (it checks the file itself).
 */
const date = z
  .string({ error: 'укажите дату' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'дата в виде ГГГГ-ММ-ДД')
  .refine(isRealDate, 'такой даты нет');

const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message);

export function makeSchemas<Photo extends z.ZodType>(photo: Photo) {
  const company = z.object({
    name: requiredText('укажите название компании'),
    logo: z.preprocess(blankToUndefined, photo.optional()),
    url: z.preprocess(blankToUndefined, z.url('адрес сайта в виде https://…').optional()),
    order: z.preprocess(blankToUndefined, z.number().int().optional()),
  });

  const review = z.object({
    author: requiredText('укажите имя'),
    role: optionalText,
    date,
    text: z.preprocess(
      (value) => blankToUndefined(value) ?? {},
      z.object({ ru: requiredText('напишите текст отзыва по-русски'), uz: optionalText, en: optionalText }),
    ),
  });

  const event = z.object({
    date,
    type: z.enum(EVENT_TYPES, { error: 'выберите тип из списка' }),
    client: optionalText,
    title: localizedText,
    venue: optionalText,
    fountain: z.preprocess(blankToUndefined, z.enum(FOUNTAINS, { error: 'выберите фонтан из списка' }).optional()),
    cover: photo,
    gallery: z.preprocess(
      cleanFileList,
      z.array(photo).min(1, 'добавьте хотя бы одно фото').max(GALLERY_MAX, `не больше ${GALLERY_MAX} фото`),
    ),
    videos: z.preprocess(cleanFileList, z.array(z.string()).max(VIDEOS_MAX, `не больше ${VIDEOS_MAX} роликов`)),
    description: localizedText,
  });

  return { event, company, review, prices: pricesSchema, site: siteSchema };
}

/** A company without a logo stays in the files but off the wall. */
export function companyWarnings(raw: unknown): ContentWarning[] {
  if (!raw || typeof raw !== 'object') return [];
  const logo = (raw as Record<string, unknown>).logo;
  return typeof logo === 'string' && logo.trim()
    ? []
    : [{ path: ['logo'], message: 'логотипа нет, компания не показывается на стене' }];
}

export interface ContentWarning {
  path: string[];
  message: string;
}

/** What the event schema silently fixes, worded for the admin. */
export function eventWarnings(raw: unknown): ContentWarning[] {
  if (!raw || typeof raw !== 'object') return [];
  const entry = raw as Record<string, unknown>;
  const warnings: ContentWarning[] = [];
  const lists = [
    ['gallery', 'фото'],
    ['videos', 'видео'],
  ] as const;
  for (const [key, noun] of lists) {
    const list = entry[key];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    for (const item of list) {
      if (typeof item !== 'string') continue;
      if (item.startsWith('blob:')) {
        warnings.push({ path: [key], message: `пустая ссылка на ${noun} (сбой при загрузке), пропущена` });
      } else if (seen.has(item)) {
        warnings.push({ path: [key], message: `${noun} ${item} добавлено дважды, оставлено одно` });
      }
      seen.add(item);
    }
  }
  if (entry.type === 'other') {
    const title = entry.title as Record<string, unknown> | undefined;
    if (!(typeof title?.ru === 'string' && title.ru.trim())) {
      warnings.push({
        path: ['title'],
        message: `для типа «Другое» он не заполнен, на сайте будет «${ru.eventTypes.other}»`,
      });
    }
  }
  return warnings;
}
