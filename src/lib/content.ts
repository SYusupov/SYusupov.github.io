/** The only place pages read content from. */
import type { ImageMetadata } from 'astro';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Locale, OccasionType } from './domain';
import type { PriceTable } from './pricing';
import { buildTime, promoWindow } from './promo';
import type { SiteSettings } from './schemas';

type CollectionName = 'events' | 'companies' | 'reviews' | 'promotions';
const cache = new Map<CollectionName, Promise<unknown>>();

/** Each collection is read once per build (in dev every time, so edits show up at once). */
function collection<C extends CollectionName>(name: C): Promise<CollectionEntry<C>[]> {
  if (!import.meta.env.PROD) return getCollection(name);
  if (!cache.has(name)) cache.set(name, getCollection(name));
  return cache.get(name) as Promise<CollectionEntry<C>[]>;
}

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
  const events = [...(await collection('events'))];
  return events.sort((a, b) => b.data.date.localeCompare(a.data.date) || b.id.localeCompare(a.id));
}

export async function getEventsOfType(type: OccasionType): Promise<EventEntry[]> {
  return (await getEvents()).filter((event) => event.data.type === type);
}

export type CompanyEntry = CollectionEntry<'companies'>;

/** Companies for the logo wall: only those with a logo; numbered first, then alphabetically. */
export async function getWallCompanies(): Promise<CompanyEntry[]> {
  const companies = await collection('companies');
  return companies
    .filter((company) => company.data.logo)
    .sort(
      (a, b) =>
        (a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER) ||
        a.data.name.localeCompare(b.data.name, 'ru'),
    );
}

/** A name as it is compared: lower case, anything but letters and digits counts as a space. */
const comparable = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Whether an event was for this company: its client is the company's name, or one of the two names
 * begins with the other («Bashkent» and «Bashkent Development»).
 */
export function isEventOf(company: CompanyEntry, event: EventEntry): boolean {
  const client = comparable(event.data.client ?? '');
  const name = comparable(company.data.name);
  return client !== '' && (client === name || client.startsWith(`${name} `) || name.startsWith(`${client} `));
}

export function eventsOfCompany(company: CompanyEntry, events: EventEntry[]): EventEntry[] {
  return events.filter((event) => isEventOf(company, event));
}

export function companiesOfEvent(event: EventEntry, companies: CompanyEntry[]): CompanyEntry[] {
  return companies.filter((company) => isEventOf(company, event));
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
  const promotions = await collection('promotions');
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
  const reviews = await collection('reviews');
  return reviews
    .filter((review) => review.data.text[locale])
    .sort((a, b) => b.data.date.localeCompare(a.data.date))
    .map(({ data }) => ({ author: data.author, role: data.role, date: data.date, text: data.text[locale] ?? '' }));
}
