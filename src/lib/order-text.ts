/**
 * Telegram order texts without dictionary imports: the calculator script runs this in the browser
 * with the strings the page hands it, so the link there matches the one built at build time.
 */
import type { Locale, Size, Tariff } from './domain';
import { formatSum, plainSpaces } from './format';
import { fill } from './template';

export interface PackageStrings {
  template: string;
  sizeNames: Record<Size, string>;
  tariffNames: Record<Tariff, string>;
}

export interface PackageChoice {
  size: Size;
  tariff: Tariff;
  price: number;
}

export function telegramLink(account: string, text: string): string {
  return `https://t.me/${account}?text=${encodeURIComponent(text)}`;
}

export function packageText(strings: PackageStrings, locale: Locale, choice: PackageChoice): string {
  return fill(strings.template, {
    size: strings.sizeNames[choice.size],
    tariff: strings.tariffNames[choice.tariff],
    price: plainSpaces(formatSum(choice.price, locale)),
  });
}
