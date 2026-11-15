/** schema.org markup for search engines: the business, the FAQ and breadcrumbs. */
import { dictionaryFor, fill } from '../i18n';
import { SITE_URL, type Locale } from './domain';
import { formatPhone } from './format';
import type { PriceTable } from './pricing';
import { absoluteUrl, pathFor } from './routes';
import type { SiteSettings } from './schemas';

export function businessJsonLd(locale: Locale, site: SiteSettings, prices: PriceTable) {
  const t = dictionaryFor(locale);
  const all = Object.values(prices).flatMap((tariffs) => Object.values(tariffs));
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#business`,
    name: 'ChocoParty',
    description: t.meta.homeDescription,
    url: absoluteUrl(pathFor(locale, { kind: 'home' })),
    logo: `${SITE_URL}/brand/apple-touch-icon.png`,
    image: `${SITE_URL}/brand/apple-touch-icon.png`,
    telephone: site.phone,
    foundingDate: String(site.foundedYear),
    priceRange: `${Math.min(...all)}–${Math.max(...all)} UZS`,
    currenciesAccepted: 'UZS',
    address: { '@type': 'PostalAddress', addressLocality: t.contacts.city, addressCountry: 'UZ' },
    areaServed: t.contacts.city,
    sameAs: [`https://t.me/${site.telegram}`, ...(site.instagram ? [`https://instagram.com/${site.instagram}`] : [])],
  };
}

export function faqJsonLd(locale: Locale, phone: string) {
  const t = dictionaryFor(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: fill(item.a, { phone: formatPhone(phone) }) },
    })),
  };
}

export function breadcrumbsJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
