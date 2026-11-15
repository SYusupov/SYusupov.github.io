/**
 * Sums written the same way on every runtime (Intl output differs between Node and browsers).
 * This module has no dictionary imports, so browser scripts can use it too.
 */
import type { Locale } from './domain';

const NBSP = ' ';

const SUM_STYLE: Record<Locale, { thousands: string; unit: string }> = {
  ru: { thousands: NBSP, unit: 'сум' },
  uz: { thousands: NBSP, unit: "so'm" },
  en: { thousands: ',', unit: 'UZS' },
};

function groupThousands(value: number, separator: string): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** «4 100 000 сум», «4 100 000 so'm», «4,100,000 UZS» — with non-breaking spaces. */
export function formatSum(amount: number, locale: Locale): string {
  const style = SUM_STYLE[locale];
  return `${groupThousands(amount, style.thousands)}${NBSP}${style.unit}`;
}

/** «+998 90 097 65 67» for «+998900976567»; other numbers stay as they are. */
export function formatPhone(phone: string): string {
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return match ? `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : phone;
}

/** The same text with ordinary spaces, for messages typed into a chat. */
export function plainSpaces(text: string): string {
  return text.replaceAll(NBSP, ' ');
}
