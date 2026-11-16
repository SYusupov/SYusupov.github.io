/**
 * When a promotion is on: from 00:00 of its first day to the end of its last day, Tashkent time
 * (UTC+5, no daylight saving). The build leaves out promotions already over; pages hide the rest
 * and a tiny inline script shows each one while the visitor's clock is inside its window.
 */
import { dictionaryFor } from '../i18n';
import type { Locale } from './domain';
import { fill } from './template';

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) - TASHKENT_OFFSET_MS;
}

/** `until` is exclusive: the first moment after the last day. */
export function promoWindow(start: string, end: string): { from: number; until: number } {
  return { from: startOfDay(start), until: startOfDay(end) + DAY_MS };
}

/** The build's «now»; tests fix it with BUILD_NOW. */
export function buildTime(): number {
  return process.env.BUILD_NOW ? Date.parse(process.env.BUILD_NOW) : Date.now();
}

/** «до 31 декабря», «31-dekabrgacha», «until 31 December». */
export function promoUntilLabel(end: string, locale: Locale): string {
  const t = dictionaryFor(locale);
  const [, month, day] = end.split('-').map(Number);
  return fill(t.promo.until, { day, month: t.dates.monthsGenitive[month - 1] });
}
