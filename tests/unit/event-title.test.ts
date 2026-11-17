import { describe, expect, it } from 'vitest';
import { eventPhotoAlt, eventSentence, eventTitle } from '../../src/lib/event-title';

// Seam 4: an event's title, sentence and photo captions in three languages. A date is never shown:
// it only orders the events, so it is not part of any text.

const corporate = {
  date: '2025-12-14',
  type: 'corporate',
  client: 'Coca-Cola',
  venue: 'Hyatt Regency Tashkent',
  fountain: 'large',
  title: {},
} as const;
const wedding = { date: '2025-11-02', type: 'wedding', fountain: 'medium', title: {} } as const;
const graduation = {
  date: '2023-12-30',
  type: 'other',
  title: { ru: 'Выпускной', uz: 'Bitiruv kechasi', en: 'Graduation party' },
} as const;
const untitled = { date: '2024-03-08', type: 'other', title: {} } as const;

describe('event title', () => {
  it('a company event is named after the company', () => {
    expect(eventTitle(corporate, 'ru')).toBe('Корпоратив Coca-Cola');
    expect(eventTitle(corporate, 'uz')).toBe('Korporativ: Coca-Cola');
    expect(eventTitle(corporate, 'en')).toBe('Corporate event: Coca-Cola');
  });

  it('a private event has no names', () => {
    expect(eventTitle(wedding, 'ru')).toBe('Свадьба');
    expect(eventTitle(wedding, 'uz')).toBe("To'y");
    expect(eventTitle(wedding, 'en')).toBe('Wedding');
  });

  it('type «other» uses its own title, or «Праздник» when it has none', () => {
    expect(eventTitle(graduation, 'ru')).toBe('Выпускной');
    expect(eventTitle(graduation, 'en')).toBe('Graduation party');
    expect(eventTitle(untitled, 'ru')).toBe('Праздник');
    expect(eventTitle(untitled, 'uz')).toBe('Bayram');
  });
});

describe('sentence on the event page', () => {
  it('fountain, occasion and venue', () => {
    expect(eventSentence(corporate, 'ru')).toBe(
      'Большой шоколадный фонтан на корпоративе Coca-Cola, Hyatt Regency Tashkent.',
    );
    expect(eventSentence(corporate, 'uz')).toBe(
      'Coca-Cola korporativida katta shokoladli favvora, Hyatt Regency Tashkent.',
    );
    expect(eventSentence(corporate, 'en')).toBe(
      'A large chocolate fountain at a Coca-Cola corporate event, Hyatt Regency Tashkent.',
    );
  });

  it('never names a year or a month', () => {
    for (const locale of ['ru', 'uz', 'en'] as const) {
      expect(eventSentence(corporate, locale)).not.toMatch(/20\d\d/);
      expect(eventPhotoAlt(corporate, locale, 1)).not.toMatch(/20\d\d/);
    }
  });

  it('without a venue or a known fountain', () => {
    expect(eventSentence(wedding, 'ru')).toBe('Средний шоколадный фонтан на свадьбе.');
    expect(eventSentence(graduation, 'ru')).toBe('Шоколадный фонтан на празднике «Выпускной».');
    expect(eventSentence(graduation, 'en')).toBe('A chocolate fountain at the Graduation party.');
  });
});

describe('photo captions', () => {
  it('title, «chocolate fountain» and the photo number', () => {
    expect(eventPhotoAlt(corporate, 'ru', 3)).toBe('Корпоратив Coca-Cola — шоколадный фонтан, фото 3');
    expect(eventPhotoAlt(corporate, 'uz', 3)).toBe('Korporativ: Coca-Cola — shokoladli favvora, 3-rasm');
    expect(eventPhotoAlt(corporate, 'en', 3)).toBe('Corporate event: Coca-Cola — chocolate fountain, photo 3');
  });
});
