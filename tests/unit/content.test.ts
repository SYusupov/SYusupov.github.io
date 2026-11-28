import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkContentRoot } from '../../src/lib/content-check';

// Seam 3: content with a mistake stops the publication with a message the admin can act on.
// Only what the admin form itself prevents is an error; the rest is fixed with a warning.

const invalid = (name: string) => `tests/fixtures/invalid/${name}`;

const made: string[] = [];
afterEach(() => {
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** The fixture content plus one event with this many photos and videos (tiny files). */
function contentWithEvent(photos: number, videos: number): string {
  const root = mkdtempSync(join(tmpdir(), 'chocoparty-content-'));
  made.push(root);
  cpSync('tests/fixtures/content', root, { recursive: true });
  const dir = join(root, 'events', 'other-big');
  mkdirSync(dir, { recursive: true });
  const tiny = 'tests/fixtures/content/events/birthday-1/01.webp';
  copyFileSync(tiny, join(dir, 'cover.webp'));
  const gallery = Array.from({ length: photos }, (_, index) => `photo-${index + 1}.webp`);
  for (const name of gallery) copyFileSync(tiny, join(dir, name));
  const clips = Array.from({ length: videos }, (_, index) => `clip-${index + 1}.mp4`);
  for (const name of clips) writeFileSync(join(dir, name), '');
  const entry = { date: '2025-01-10', type: 'other', title: { ru: 'Большое событие' }, cover: 'cover.webp', gallery, videos: clips };
  writeFileSync(join(dir, 'index.json'), JSON.stringify(entry));
  return root;
}

describe('content check before the build', () => {
  it('the fixture content passes without errors or warnings', () => {
    expect(checkContentRoot('tests/fixtures/content')).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ['event-without-cover', 'events/2025-01-10-wedding/index.json: «Обложка» — добавьте фото'],
    ['event-unknown-type', 'events/2025-01-10-party/index.json: «Тип мероприятия» — выберите тип из списка'],
    ['event-bad-date', 'events/2025-02-30-wedding/index.json: «Дата» — такой даты нет'],
    ['event-missing-photo', 'events/2025-01-10-wedding/index.json: «Фото» — нет файла 02.webp в папке мероприятия'],
    ['price-too-low', 'settings/prices.json: «Малый фонтан — до 30 гостей → Optima, сум» — цена не меньше 100 000 сум'],
    ['company-without-name', 'companies/no-name/index.json: «Название» — укажите название компании'],
    ['company-url-not-web', 'companies/odd/index.json: «Сайт компании» — адрес сайта в виде https://…'],
    ['company-missing-logo', 'companies/luna/index.json: «Логотип» — нет файла logo.png в папке компании'],
    ['review-without-russian-text', 'reviews/2025-01-10-anna/index.json: «Отзыв → По-русски» — напишите текст отзыва по-русски'],
    ['promotion-without-russian-title', 'promotions/2025-12-offer/index.json: «Заголовок → По-русски» — напишите заголовок по-русски'],
    [
      'site-telegram-with-at',
      'settings/site.json: «Telegram для заказов» — имя пользователя Telegram: латинские буквы, цифры и _, от 5 до 32 знаков, без @',
    ],
    ['site-metrika-with-spaces', 'settings/site.json: «Яндекс Метрика» — номер счётчика: только цифры, без пробелов'],
  ])('%s stops the publication with a clear message', (fixture, message) => {
    expect(checkContentRoot(invalid(fixture)).errors).toContain(message);
  });

  it('an event can hold 25 photos and 25 clips, the most the owner wants on a page', () => {
    expect(checkContentRoot(contentWithEvent(25, 25)).errors).toEqual([]);
  });

  it.each([
    [26, 1, '«Фото» — не больше'],
    [1, 26, '«Видео» — не больше'],
  ])('%i photos and %i clips: one over the limit stops the publication', (photos, videos, text) => {
    const { errors } = checkContentRoot(contentWithEvent(photos, videos));
    expect(errors.some((error) => error.includes(text))).toBe(true);
  });

  it('a broken file stops the publication and names the file', () => {
    const { errors } = checkContentRoot(invalid('event-broken-json'));
    expect(errors.some((error) => error.startsWith('events/2025-01-10-wedding/index.json: файл повреждён'))).toBe(true);
  });

  it('missing settings files stop the publication', () => {
    const { errors } = checkContentRoot(invalid('event-bad-date'));
    expect(errors).toContain('settings/prices.json: файла нет');
    expect(errors).toContain('settings/site.json: файла нет');
  });

  it('a repeated photo and an empty upload link pass with warnings', () => {
    expect(checkContentRoot(invalid('soft-gallery'))).toEqual({
      errors: [],
      warnings: [
        'events/2025-01-10-wedding/index.json: «Фото» — фото 01.webp добавлено дважды, оставлено одно',
        'events/2025-01-10-wedding/index.json: «Фото» — пустая ссылка на фото (сбой при загрузке), пропущена',
      ],
    });
  });

  it('a company without a logo passes with a warning and stays off the wall', () => {
    expect(checkContentRoot(invalid('soft-company-without-logo'))).toEqual({
      errors: [],
      warnings: ['companies/luna/index.json: «Логотип» — логотипа нет, компания не показывается на стене'],
    });
  });

  it('a promotion ending before it starts passes with a warning and is not shown', () => {
    expect(checkContentRoot(invalid('soft-promotion-ends-before-start'))).toEqual({
      errors: [],
      warnings: [
        'promotions/2025-12-offer/index.json: «Последний день» — он раньше первого дня, акция не показывается',
      ],
    });
  });

  it('type «Другое» without its own title passes with a warning', () => {
    expect(checkContentRoot(invalid('soft-other-without-title'))).toEqual({
      errors: [],
      warnings: [
        'events/2025-01-10-other/index.json: «Свой заголовок» — для типа «Другое» он не заполнен, на сайте будет «Праздник»',
      ],
    });
  });
});
