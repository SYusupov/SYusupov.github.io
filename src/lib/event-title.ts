/**
 * How an event is named and described on the site, in each language. Private events carry no names.
 * An event's date is never shown (the owner's decision): it only orders the events.
 */
import { dictionaryFor } from '../i18n';
import type { EventType, Fountain, Locale } from './domain';
import { fill } from './template';

export interface EventFacts {
  date: string;
  type: EventType;
  client?: string;
  venue?: string;
  fountain?: Fountain;
  title: Partial<Record<Locale, string | undefined>>;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

function ownTitle(event: EventFacts, locale: Locale): string | undefined {
  return event.type === 'other' ? event.title[locale]?.trim() || undefined : undefined;
}

/** «Корпоратив Coca-Cola», «Свадьба», or the own title of an «other» event. */
export function eventTitle(event: EventFacts, locale: Locale): string {
  const t = dictionaryFor(locale);
  if (event.type === 'other') return ownTitle(event, locale) ?? t.eventNames.other;
  const type = t.eventNames[event.type];
  return event.client ? fill(t.eventPhrases.titleWithClient, { type, client: event.client }) : type;
}

/** One sentence from what is known: fountain, occasion and venue. */
export function eventSentence(event: EventFacts, locale: Locale): string {
  const phrases = dictionaryFor(locale).eventPhrases;
  const title = ownTitle(event, locale);
  const occasion = title
    ? fill(phrases.occasionWithTitle, { title })
    : event.client
      ? fill(phrases.occasionWithClient[event.type], { client: event.client })
      : phrases.occasion[event.type];
  return capitalize(
    fill(phrases.sentence, {
      fountain: phrases.fountain[event.fountain ?? 'none'],
      occasion,
      venue: event.venue ? fill(phrases.venue, { venue: event.venue }) : '',
    }),
  );
}

/** Alternative text of a photo: the title, «chocolate fountain» and the photo number. */
export function eventPhotoAlt(event: EventFacts, locale: Locale, number: number): string {
  return fill(dictionaryFor(locale).eventPhrases.photoAlt, { title: eventTitle(event, locale), n: number });
}
