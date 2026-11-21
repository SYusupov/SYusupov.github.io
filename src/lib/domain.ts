/** Site-wide vocabulary: languages, event types, fountain sizes, tariffs and limits. */

export const SITE_URL = 'https://chocoparty.uz';

/**
 * Ownership proofs for Google Search Console and Yandex Webmaster, kept in <head> of the home page
 * for good: both services re-check them, and the built-site audit stops a publication without them.
 */
export const SITE_VERIFICATION = {
  google: '_H0W1cv0lXvYjHswRHsfZ3d9v3Xm_6RqmBv40eZiMeY',
  yandex: '41d5f9ccab706f3f',
} as const;

/**
 * Address of the small login service (a free Cloudflare Worker) that lets the admin panel offer
 * «sign in with GitHub»; GitHub itself accepts a Google account. Empty until the service is set up:
 * the panel then signs in with an access token only. See chocoparty-materials/prompts/admin-login.md.
 */
export const CMS_AUTH_URL = '';

export const LOCALES = ['ru', 'uz', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';
export const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Fountain sizes: small — 3 tiers, ~40 cm; medium — 4 tiers, ~60 cm; large — 5 tiers, ~80 cm. */
export const SIZES = ['small', 'medium', 'large'] as const;
export type Size = (typeof SIZES)[number];

export const TARIFFS = ['light', 'optima', 'maxima'] as const;
export type Tariff = (typeof TARIFFS)[number];

/** What the calculator shows first. */
export const DEFAULT_SELECTION: { size: Size; tariff: Tariff } = { size: 'medium', tariff: 'optima' };

/** Accepted range for one price, in sum. */
export const PRICE_MIN = 100_000;
export const PRICE_MAX = 100_000_000;

/** Event types; every type but `other` has its own occasion page. */
export const EVENT_TYPES = ['wedding', 'birthday', 'kids-party', 'corporate', 'exhibition', 'opening', 'new-year', 'other'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const OCCASION_TYPES = EVENT_TYPES.filter((type) => type !== 'other');
export type OccasionType = Exclude<EventType, 'other'>;

/** The fountain seen at an event. */
export const FOUNTAINS = ['small', 'medium', 'large', 'several'] as const;
export type Fountain = (typeof FOUNTAINS)[number];

/**
 * How many photos and clips an event page may hold. It was 15 and 2 while the pages showed only the
 * best; 150 and 60 since the whole archive went onto the site for the manager to choose the best from
 * (the biggest event has 112 photos and 44 clips). Lower them again once the choice is made.
 */
export const GALLERY_MAX = 150;
export const VIDEOS_MAX = 60;
/**
 * File names under every photo and clip of an event page (the cover is marked «обложка»), so the
 * manager can name the ones to keep while choosing the best from the whole archive. Turn off once the
 * choice is made, together with lowering the limits above.
 */
export const SHOW_FILE_NAMES = true;
/** Largest video file the admin may upload; the build compresses it for the site. */
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
