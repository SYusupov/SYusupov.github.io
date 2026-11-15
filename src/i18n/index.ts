import type { Locale } from '../lib/domain';
import { en } from './en';
import { ru, type Dictionary } from './ru';
import { uz } from './uz';

export type { Dictionary };
export { fill } from '../lib/template';

const dictionaries: Record<Locale, Dictionary> = { ru, uz, en };

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
