/** The only place pages read content from. */
import type { ImageMetadata } from 'astro';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Locale, OccasionType } from './domain';
import type { PriceTable } from './pricing';
import { buildTime, promoWindow } from './promo';
import type { SiteSettings } from './schemas';

export type EventEntry = CollectionEntry<'events'>;

export async function getPrices(): Promise<PriceTable> {
  const entry = await getEntry('prices', 'prices');
  if (!entry) throw new Error('Нет файла цен: settings/prices.json');
  return entry.data;
}

export async function getSite(): Promise<SiteSettings> {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('Нет файла настроек: settings/site.json');
  return entry.data;
}

/** All events, newest first; two events on one day keep a stable order. */
export async function getEvents(): Promise<EventEntry[]> {
  const events = await getCollection('events');
  return events.sort((a, b) => b.data.date.localeCompare(a.data.date) || b.id.localeCompare(a.id));
}

export async function getEventsOfType(type: OccasionType): Promise<EventEntry[]> {
  return (await getEvents()).filter((event) => event.data.type === type);
}

export function eventYear(event: EventEntry): string {
  return event.data.date.slice(0, 4);
}

export type CompanyEntry = CollectionEntry<'companies'>;

/** Companies for the logo wall: only those with a logo; numbered first, then alphabetically. */
export async function getWallCompanies(): Promise<CompanyEntry[]> {
  const companies = await getCollection('companies');
  return companies
    .filter((company) => company.data.logo)
    .sort(
      (a, b) =>
        (a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER) ||
        a.data.name.localeCompare(b.data.name, 'ru'),
    );
}

export interface PromotionView {
  id: string;
  title: string;
  text: string;
  photo?: ImageMetadata;
  end: string;
  /** Window in epoch milliseconds, `until` exclusive. */
  from: number;
  until: number;
}

/** Promotions not over at build time, with title and text in the page's language, soonest first. */
export async function getPromotions(locale: Locale): Promise<PromotionView[]> {
  const now = buildTime();
  const promotions = await getCollection('promotions');
  return promotions
    .map((promotion) => ({ promotion, window: promoWindow(promotion.data.start, promotion.data.end) }))
    .filter(
      ({ promotion, window }) =>
        window.from < window.until &&
        window.until > now &&
        promotion.data.title[locale] &&
        promotion.data.text[locale],
    )
    .sort((a, b) => a.window.from - b.window.from)
    .map(({ promotion, window }) => ({
      id: promotion.id,
      title: promotion.data.title[locale] ?? '',
      text: promotion.data.text[locale] ?? '',
      photo: promotion.data.photo,
      end: promotion.data.end,
      ...window,
    }));
}

export interface ReviewView {
  author: string;
  role?: string;
  date: string;
  text: string;
}

/** Reviews written in the page's language, newest first. */
export async function getReviews(locale: Locale): Promise<ReviewView[]> {
  const reviews = await getCollection('reviews');
  return reviews
    .filter((review) => review.data.text[locale])
    .sort((a, b) => b.data.date.localeCompare(a.data.date))
    .map(({ data }) => ({ author: data.author, role: data.role, date: data.date, text: data.text[locale] ?? '' }));
}
