/** Order links that open a Telegram chat with the admin, the message already typed in. */
import { dictionaryFor } from '../i18n';
import { SIZES, TARIFFS, type Locale } from './domain';
import { packageText, telegramLink, type PackageChoice, type PackageStrings } from './order-text';
import { fill } from './template';

export function packageStrings(locale: Locale): PackageStrings {
  const t = dictionaryFor(locale);
  return {
    template: t.order.packageText,
    sizeNames: Object.fromEntries(SIZES.map((size) => [size, t.sizes[size].name])) as PackageStrings['sizeNames'],
    tariffNames: Object.fromEntries(TARIFFS.map((tariff) => [tariff, t.tariffs[tariff].name])) as PackageStrings['tariffNames'],
  };
}

export function packageOrderLink(options: PackageChoice & { locale: Locale; telegram: string }): string {
  const { locale, telegram, ...choice } = options;
  return telegramLink(telegram, packageText(packageStrings(locale), locale, choice));
}

export function eventOrderLink(options: { locale: Locale; telegram: string; title: string; url: string }): string {
  const t = dictionaryFor(options.locale);
  return telegramLink(options.telegram, fill(t.order.eventText, { title: options.title, url: options.url }));
}
