/** The only place pages read content from. */
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { OccasionType } from './domain';
import type { PriceTable } from './pricing';
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
