/**
 * Checks the built site before it is published:
 *   - every internal link, image, video and poster points to a file that exists;
 *   - language versions link to each other both ways;
 *   - every event has a page in three languages, is linked from the list of all events and
 *     from its occasion page, and the five newest are on the home page;
 *   - schema.org markup parses; the admin panel publishes to the main branch on GitHub;
 *   - the home page keeps the Google and Yandex ownership tags in <head> (the services re-check
 *     them), and every page carries the Metrika counter when site.json names one.
 * Usage: tsx scripts/audit-dist.ts   (CONTENT_ROOT switches to fixture content and dist-test)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LOCALES, OCCASION_TYPES, SITE_URL, SITE_VERIFICATION } from '../src/lib/domain';
import { pathFor } from '../src/lib/routes';

const root = process.env.CONTENT_ROOT ?? 'src/content';
const outDir = process.env.CONTENT_ROOT ? 'dist-test' : 'dist';
const problems: string[] = [];

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

/** The file GitHub Pages would serve for a site path, or undefined. */
function fileFor(sitePath: string): string | undefined {
  const clean = decodeURIComponent(sitePath.split('#')[0].split('?')[0]);
  const target = join(outDir, clean);
  if (clean.endsWith('/')) return existsSync(join(target, 'index.html')) ? join(target, 'index.html') : undefined;
  if (existsSync(target) && statSync(target).isFile()) return target;
  if (existsSync(`${target}.html`)) return `${target}.html`;
  return undefined;
}

const pageOf = (file: string) => `/${relative(outDir, file).replace(/index\.html$/, '')}`;
const pages = new Map(htmlFiles(outDir).map((file) => [pageOf(file), readFileSync(file, 'utf8')]));

// 1. Internal links and media.
const reference = /\s(?:href|src|poster|srcset)="([^"]+)"/g;
for (const [page, html] of pages) {
  for (const [, value] of html.matchAll(reference)) {
    for (const candidate of value.split(',').map((part) => part.trim().split(/\s+/)[0])) {
      const local = candidate.startsWith(SITE_URL) ? candidate.slice(SITE_URL.length) || '/' : candidate;
      if (!local.startsWith('/') || local.startsWith('//')) continue;
      if (!fileFor(local)) problems.push(`битая ссылка: ${page} → ${candidate}`);
    }
  }
}

// 2. Language versions point to each other.
const alternate = /<link rel="alternate" hreflang="(ru|uz|en)" href="([^"]+)"/g;
for (const [page, html] of pages) {
  const links = new Map([...html.matchAll(alternate)].map(([, lang, href]) => [lang, href.slice(SITE_URL.length)]));
  if (!links.size) continue;
  for (const [lang, target] of links) {
    const other = pages.get(target);
    if (!other) {
      problems.push(`языковая версия не найдена: ${page} → ${lang} ${target}`);
      continue;
    }
    const back = new Map([...other.matchAll(alternate)].map(([, l, href]) => [l, href.slice(SITE_URL.length)]));
    if (![...back.values()].includes(page)) problems.push(`нет обратной языковой ссылки: ${target} → ${page}`);
  }
}

// 3. Every event is published everywhere it should be.
const eventsDir = join(root, 'events');
const events = existsSync(eventsDir)
  ? readdirSync(eventsDir)
      .filter((name) => existsSync(join(eventsDir, name, 'index.json')))
      .map((id) => ({ id, ...(JSON.parse(readFileSync(join(eventsDir, id, 'index.json'), 'utf8')) as { date: string; type: string }) }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  : [];
const linksTo = (page: string, target: string) => (pages.get(page) ?? '').includes(`href="${target}"`);
for (const locale of LOCALES) {
  const list = pathFor(locale, { kind: 'events' });
  const home = pathFor(locale, { kind: 'home' });
  events.forEach((event, index) => {
    const eventPage = pathFor(locale, { kind: 'event', slug: event.id });
    if (!pages.has(eventPage)) problems.push(`нет страницы мероприятия: ${eventPage}`);
    if (!linksTo(list, eventPage)) problems.push(`мероприятия нет в списке: ${list} → ${eventPage}`);
    if ((OCCASION_TYPES as readonly string[]).includes(event.type)) {
      const occasion = pathFor(locale, { kind: 'occasion', type: event.type as (typeof OCCASION_TYPES)[number] });
      if (!linksTo(occasion, eventPage)) problems.push(`мероприятия нет на странице повода: ${occasion} → ${eventPage}`);
    }
    if (index < 5 && !linksTo(home, eventPage)) problems.push(`нового мероприятия нет на главной: ${home} → ${eventPage}`);
  });
}

// 4. Markup and the admin panel.
for (const [page, html] of pages) {
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(json);
    } catch {
      problems.push(`разметка schema.org не читается: ${page}`);
    }
  }
}
const adminConfig = join(outDir, 'admin', 'config.json');
if (!existsSync(adminConfig)) problems.push('нет настройки админки: /admin/config.json');
else {
  const { backend } = JSON.parse(readFileSync(adminConfig, 'utf8')) as { backend?: { name?: string; branch?: string } };
  if (backend?.name !== 'github' || backend.branch !== 'main') {
    problems.push(`админка публикует не в main на GitHub: ${JSON.stringify(backend)}`);
  }
}

// 5. Ownership tags and the Metrika counter.
const headOf = (html: string) => html.slice(0, html.indexOf('</head>'));
const bodyOf = (html: string) => html.slice(html.indexOf('<body'));
const ownership = [
  ['google-site-verification', SITE_VERIFICATION.google],
  ['yandex-verification', SITE_VERIFICATION.yandex],
];
for (const [name, content] of ownership) {
  if (!headOf(pages.get('/') ?? '').includes(`<meta name="${name}" content="${content}">`)) {
    problems.push(`нет метатега подтверждения в <head> главной: ${name}`);
  }
}
const { metrikaId } = JSON.parse(readFileSync(join(root, 'settings', 'site.json'), 'utf8')) as { metrikaId?: string };
if (metrikaId) {
  for (const [page, html] of pages) {
    // Only pages built from the site layout; the admin panel and the old-address redirects are not counted.
    if (!html.includes('property="og:site_name"')) continue;
    const head = headOf(html);
    if (!head.includes(`mc.yandex.ru/metrika/tag.js?id=${metrikaId}'`) || !head.includes(`ym(${metrikaId}, 'init'`)) {
      problems.push(`нет кода счётчика Метрики в <head>: ${page}`);
    }
    if (!bodyOf(html).includes(`<img src="https://mc.yandex.ru/watch/${metrikaId}"`)) {
      problems.push(`нет пикселя Метрики в <body>: ${page}`);
    }
  }
}

for (const problem of problems) console.error(`Ошибка: ${problem}`);
if (problems.length) {
  console.error(`\nПроверка собранного сайта не прошла, ошибок: ${problems.length}.`);
  process.exit(1);
}
console.log(`Собранный сайт в порядке: страниц ${pages.size}, мероприятий ${events.length}.`);
