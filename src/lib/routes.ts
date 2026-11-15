/** The URL map: every internal link is built here, never by hand in templates. */
import { DEFAULT_LOCALE, LOCALES, SITE_URL, type Locale, type OccasionType } from './domain';

export type Page =
  | { kind: 'home' }
  | { kind: 'events' }
  | { kind: 'event'; slug: string }
  | { kind: 'occasion'; type: OccasionType };

function localeRoot(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '/' : `/${locale}/`;
}

export function pathFor(locale: Locale, page: Page): string {
  const root = localeRoot(locale);
  switch (page.kind) {
    case 'home':
      return root;
    case 'events':
      return `${root}events/`;
    case 'event':
      return `${root}events/${page.slug}/`;
    case 'occasion':
      return `${root}occasions/${page.type}/`;
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

/** The same page in every language, default language first. */
export function alternatesFor(page: Page): { locale: Locale; path: string }[] {
  return LOCALES.map((locale) => ({ locale, path: pathFor(locale, page) }));
}
