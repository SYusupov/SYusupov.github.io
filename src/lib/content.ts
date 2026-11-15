/** The only place pages read content from. */
import { getEntry } from 'astro:content';
import type { PriceTable } from './pricing';
import type { SiteSettings } from './schemas';

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
