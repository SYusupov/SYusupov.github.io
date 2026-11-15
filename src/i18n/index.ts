import type { Locale } from '../lib/domain';
import { en } from './en';
import { ru, type Dictionary } from './ru';
import { uz } from './uz';

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { ru, uz, en };

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replaces `{name}` placeholders with the given values. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
