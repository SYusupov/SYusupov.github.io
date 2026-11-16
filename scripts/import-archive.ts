/**
 * Loads the curated photo archive into the site: one event folder per «готово» row of the
 * «События» sheet (exported as CSV), from the album zip the photo session downloaded.
 * Photos become WebP up to 1600 px without metadata (cover.webp, 01.webp, …); video clips are cut
 * and compressed to the site format; companies come from the «Компании» sheet.
 *
 * The sheet says what happened at each event; scripts/import-curation.json holds what the site
 * needs in another form: video segments, frames cut from videos (for events with few photos),
 * the Russian title of «other» events, a public description, photos to leave out.
 * Venue stays empty on purpose: the sheet describes the place («зал с люстрами»), it does not name
 * it, and one string is shown in every language.
 *
 * A ledger (scripts/import-ledger.json) remembers imported rows, so a second run adds only new
 * ones. To redo an event: delete its folder and its ledger line.
 *
 * Usage: tsx scripts/import-archive.ts --events events.csv [--companies companies.csv]
 *          [--downloads "/mnt/c/Users/sayor/Desktop/chocoparty photos,/mnt/c/Users/sayor/Downloads"]
 *          [--content src/content]
 *          [--only 2,10] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { GALLERY_MAX, VIDEOS_MAX } from '../src/lib/domain';
import { CLIP_SECONDS, encodeSiteClip, extractFrame } from './lib/ffmpeg';

const { values: args } = parseArgs({
  options: {
    events: { type: 'string' },
    companies: { type: 'string' },
    downloads: { type: 'string', default: '/mnt/c/Users/sayor/Downloads' },
    content: { type: 'string', default: 'src/content' },
    ledger: { type: 'string', default: 'scripts/import-ledger.json' },
    curation: { type: 'string', default: 'scripts/import-curation.json' },
    only: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

// sharp's libvips has no HEVC decoder, and ffmpeg returns a single 512 px tile of an iPhone's tiled
// HEIC; heic-decode (libheif in WebAssembly) reads the whole image, rotated upright.
const decodeHeic = createRequire(import.meta.url)('heic-decode') as (input: {
  buffer: Buffer;
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;

const TYPES: Record<string, string> = {
  свадьба: 'wedding',
  'день рождения': 'birthday',
  'детский праздник': 'kids-party',
  корпоратив: 'corporate',
  'выставка или презентация': 'exhibition',
  открытие: 'opening',
};
const FOUNTAINS: Record<string, string> = { малый: 'small', средний: 'medium', большой: 'large', несколько: 'several' };
const IMAGE = /\.(jpe?g|png|heic|heif|webp)$/i;
const VIDEO = /\.(mp4|mov|m4v)$/i;
const RESIZE = { width: 1600, height: 1600, fit: 'inside' as const, withoutEnlargement: true };

interface Curation {
  /** Keeps the event out of the site; the reason is reported (a legible private name, a pending question). */
  skip?: string;
  /** Overrides the client from the sheet. */
  client?: string;
  /** Russian title of an «other» event. */
  title?: string;
  /** Russian public description. */
  description?: string;
  /** File name of the photo to use as the cover. */
  cover?: string;
  /** Photos to leave out (a legible name, a defect). */
  exclude?: string[];
  /** Clips cut from the album's videos; seconds, at most 8 each. */
  clips?: { file: string; from: number; to: number }[];
  /** Frames cut from the album's videos, for events with few photos. */
  stills?: { file: string; at: number; cover?: boolean }[];
}

/** RFC 4180 CSV: quoted fields may hold commas, quotes and line breaks. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') (field += '"'), (i += 1);
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') rows[rows.length - 1].push(field), (field = '');
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      rows[rows.length - 1].push(field);
      field = '';
      rows.push([]);
    } else field += char;
  }
  rows[rows.length - 1].push(field);
  const [header, ...data] = rows.filter((row) => row.some((cell) => cell.trim()));
  const keys = header.map((cell) => cell.trim().toLowerCase());
  return data.map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? '').trim()])));
}

/** The value of the first column whose header starts with `prefix` (sheet headers carry hints). */
const column = (row: Record<string, string>, prefix: string) =>
  Object.entries(row).find(([key]) => key.startsWith(prefix))?.[1] ?? '';

/** «IMG_0012.jpg https://photos…» → «IMG_0012.jpg». */
const fileName = (value: string) => value.split(/\s+/).find((part) => IMAGE.test(part) || VIDEO.test(part)) ?? '';

/** «Coca-Cola (CCI)» → «Coca-Cola», «Agio Pharmaceuticals Ltd» → «Agio Pharmaceuticals». */
const cleanName = (value: string) =>
  value
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+(Ltd|LLC|Inc|Co)\.?$/i, '')
    .trim();

/** «большой (5 ярусов, ~80 см)» → «large»; «не видно» → nothing. */
const fountainOf = (value: string) => FOUNTAINS[value.toLowerCase().split(/[\s(,]/)[0]];

/** The sheet's number as a plain string: «2.0» (a spreadsheet export) and «2» are the same row. */
const numberOf = (row: Record<string, string>) => String(Number.parseInt(column(row, '№'), 10));

function filesIn(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? filesIn(path) : [path];
    })
    .sort();
}

async function toWebp(source: string, target: string): Promise<void> {
  if (/\.hei[cf]$/i.test(source)) {
    const { width, height, data } = await decodeHeic({ buffer: readFileSync(source) });
    const pixels = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    await sharp(pixels, { raw: { width, height, channels: 4 } }).resize(RESIZE).webp({ quality: 80 }).toFile(target);
    return;
  }
  await sharp(source).rotate().resize(RESIZE).webp({ quality: 80 }).toFile(target);
}

/** Folder names as the admin panel makes them: the second event of a day gets «-1». */
function freeFolder(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 1; taken.has(name) || existsSync(join(args.content, 'events', name)); n += 1) name = `${base}-${n}`;
  taken.add(name);
  return name;
}

/** «Сайт 2025-09-06 свадьба — https://photos…» → «Сайт 2025-09-06 свадьба». */
const albumName = (value: string) => value.replace(/\s*https?:\/\/\S+/, '').replace(/\s*—\s*$/, '').trim();

/** The zips of one album: the browser names them «<album>-1-001.zip» (and -002 … for big albums). */
function albumZips(folders: string[], zipColumn: string, albumColumn: string): string[] {
  const album = albumName(albumColumn);
  const escaped = album.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = new RegExp(`^${escaped}-\\d+-\\d{3}\\.zip$`);
  for (const folder of folders.filter((path) => existsSync(path))) {
    const direct = zipColumn && join(folder, zipColumn.split(' (')[0].trim());
    if (direct && existsSync(direct)) return [direct];
    const found = album ? readdirSync(folder).filter((name) => named.test(name)).sort() : [];
    if (found.length) return found.map((name) => join(folder, name));
  }
  return [];
}

const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);

const ledger = readJson<Record<string, string>>(args.ledger, {});
const curation = readJson<Record<string, Curation>>(args.curation, {});
const folders = args.downloads.split(',').map((path) => path.trim());
const only = args.only ? new Set(args.only.split(',').map((part) => part.trim())) : undefined;
const report: string[] = [];
const taken = new Set<string>();

interface Still {
  /** File name of a photo, or «video@seconds» of a frame. */
  name: string;
  cover: boolean;
  write: (target: string) => Promise<void>;
}

if (args.events) {
  for (const row of parseCsv(readFileSync(args.events, 'utf8'))) {
    const number = numberOf(row);
    if (column(row, 'статус').toLowerCase() !== 'готово') continue;
    if (ledger[number] || (only && !only.has(number))) continue;
    const extra = curation[number] ?? {};
    if (extra.skip) {
      report.push(`№${number}: пропущено — ${extra.skip}`);
      continue;
    }
    const typeText = column(row, 'тип').toLowerCase();
    const type = TYPES[typeText] ?? (typeText.startsWith('другое') ? 'other' : '');
    const date = column(row, 'дата (');
    if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      report.push(`№${number}: пропущено — тип «${typeText}» или дата «${date}» не распознаны`);
      continue;
    }
    const zips = albumZips(folders, column(row, 'zip'), column(row, 'альбом'));
    if (!zips.length) {
      report.push(`№${number}: пропущено — нет архива альбома «${albumName(column(row, 'альбом'))}» в ${folders.join(', ')}`);
      continue;
    }
    const folder = freeFolder(`${date}-${type}`, taken);
    if (args['dry-run']) {
      report.push(`№${number}: будет ${folder} из ${zips.map((zip) => basename(zip)).join(', ')}`);
      continue;
    }

    // Downloaded archives are untrusted: each one is unpacked into its own new, empty folder.
    const unpacked = mkdtempSync(join(tmpdir(), 'chocoparty-album-'));
    try {
      for (const zip of zips) execFileSync('python3', ['-I', '-m', 'zipfile', '-e', zip, unpacked]);
      const media = filesIn(unpacked);
      const find = (name: string) => media.find((path) => basename(path) === name);

      const left = new Set(extra.exclude ?? []);
      const stills: Still[] = media
        .filter((path) => IMAGE.test(path) && !left.has(basename(path)))
        .map((path) => ({ name: basename(path), cover: false, write: (target) => toWebp(path, target) }));
      for (const frame of extra.stills ?? []) {
        const video = find(frame.file);
        if (!video) {
          report.push(`№${number}: видео ${frame.file} для кадра не найдено в архиве`);
          continue;
        }
        stills.push({
          name: `${frame.file}@${frame.at}`,
          cover: Boolean(frame.cover),
          write: (target) => sharp(extractFrame(video, frame.at)).resize(RESIZE).webp({ quality: 80 }).toFile(target).then(() => undefined),
        });
      }
      const sheetCover = fileName(column(row, 'обложка'));
      const cover =
        stills.find((still) => still.name === extra.cover) ??
        stills.find((still) => still.cover) ??
        stills.find((still) => still.name === sheetCover) ??
        stills[0];
      const rest = stills.filter((still) => still !== cover);
      if (!cover || rest.length === 0) {
        report.push(`№${number}: пропущено — кадров меньше двух (обложка и хотя бы одно фото в галерее)`);
        continue;
      }
      if (rest.length > GALLERY_MAX) report.push(`№${number}: кадров ${rest.length}, взяты первые ${GALLERY_MAX}`);

      const dir = join(args.content, 'events', folder);
      mkdirSync(dir, { recursive: true });
      await cover.write(join(dir, 'cover.webp'));
      const gallery: string[] = [];
      for (const still of rest.slice(0, GALLERY_MAX)) {
        const name = `${String(gallery.length + 1).padStart(2, '0')}.webp`;
        await still.write(join(dir, name));
        gallery.push(name);
      }

      const videos: string[] = [];
      for (const clip of (extra.clips ?? []).slice(0, VIDEOS_MAX)) {
        const source = find(clip.file);
        if (!source) {
          report.push(`№${number}: ролик ${clip.file} не найден в архиве`);
          continue;
        }
        if (!(clip.to > clip.from) || clip.to - clip.from > CLIP_SECONDS + 0.05) {
          report.push(`№${number}: ролик ${clip.file}: отрезок ${clip.from}–${clip.to} не годится (нужно от 0 до ${CLIP_SECONDS} с)`);
          continue;
        }
        const name = `video-${videos.length + 1}.mp4`;
        encodeSiteClip(source, join(dir, name), clip.from, clip.to - clip.from);
        videos.push(name);
      }

      const ownTitle = type === 'other' ? (extra.title ?? typeText.replace(/^другое:?\s*/, '')) : '';
      const client = extra.client ?? cleanName(column(row, 'клиент'));
      const fountain = fountainOf(column(row, 'фонтан'));
      writeJson(join(dir, 'index.json'), {
        date,
        type,
        ...(client && { client }),
        ...(ownTitle && { title: { ru: ownTitle.charAt(0).toUpperCase() + ownTitle.slice(1) } }),
        ...(fountain && { fountain }),
        cover: 'cover.webp',
        gallery,
        ...(videos.length && { videos }),
        ...(extra.description && { description: { ru: extra.description } }),
      });
      ledger[number] = folder;
      writeJson(args.ledger, ledger);
      report.push(`№${number}: ${folder} — фото ${gallery.length + 1}, видео ${videos.length}`);
    } finally {
      rmSync(unpacked, { recursive: true, force: true });
    }
  }
}

/** The first web address in a sheet cell that also carries a note («https://… (юбилейный логотип)»). */
const firstUrl = (value: string) => /https?:\/\/[^\s)]+/.exec(value)?.[0] ?? '';

if (args.companies) {
  for (const row of parseCsv(readFileSync(args.companies, 'utf8'))) {
    const name = cleanName(column(row, 'название'));
    if (!name) continue;
    const slug = name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
    const dir = join(args.content, 'companies', slug);
    if (existsSync(join(dir, 'index.json'))) continue;
    if (args['dry-run']) {
      report.push(`компания ${name}: будет ${slug}`);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    const logoUrl = firstUrl(column(row, 'логотип: адрес'));
    let logo = '';
    if (logoUrl) {
      try {
        const response = await fetch(logoUrl, { signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error(`ответ ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const isSvg = (response.headers.get('content-type') ?? '').includes('svg') || extname(new URL(logoUrl).pathname) === '.svg';
        if (isSvg) {
          const text = bytes.toString('utf8');
          if (!/<svg[\s>]/.test(text) || /<script/i.test(text)) throw new Error('это не безопасный SVG');
          logo = 'logo.svg';
          writeFileSync(join(dir, logo), bytes);
        } else {
          logo = 'logo.png';
          await sharp(bytes).resize({ height: 240, withoutEnlargement: true }).png().toFile(join(dir, logo));
        }
      } catch (error) {
        report.push(`компания ${name}: логотип не скачался (${error instanceof Error ? error.message : error})`);
      }
    }
    const url = firstUrl(column(row, 'сайт'));
    writeJson(join(dir, 'index.json'), { name, ...(logo && { logo }), ...(url && { url }) });
    report.push(`компания ${name}: ${slug}${logo ? '' : ' (без логотипа)'}`);
  }
}

console.log(report.join('\n') || 'Новых строк нет.');
