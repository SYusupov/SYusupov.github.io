/**
 * Loads the curated photo archive into the site: one event folder per «готово» row of the
 * «События» sheet (exported as CSV), from the album zip in the browser's downloads folder.
 * Photos become WebP up to 1600 px without metadata (cover.webp, 01.webp, …); videos are cut to
 * the best segment noted in the sheet and compressed; companies come from the «Компании» sheet.
 * A ledger (scripts/import-ledger.json) remembers imported rows, so a second run adds only new ones.
 *
 * Usage: tsx scripts/import-archive.ts --events events.csv [--companies companies.csv]
 *          [--downloads /mnt/c/Users/sayor/Downloads] [--content src/content] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { GALLERY_MAX, VIDEOS_MAX } from '../src/lib/domain';

const { values: args } = parseArgs({
  options: {
    events: { type: 'string' },
    companies: { type: 'string' },
    downloads: { type: 'string', default: '/mnt/c/Users/sayor/Downloads' },
    content: { type: 'string', default: 'src/content' },
    ledger: { type: 'string', default: 'scripts/import-ledger.json' },
    'dry-run': { type: 'boolean', default: false },
  },
});

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

function filesIn(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? filesIn(path) : [path];
    })
    .sort();
}

async function toWebp(source: string, target: string): Promise<void> {
  const resize = { width: 1600, height: 1600, fit: 'inside' as const, withoutEnlargement: true };
  try {
    await sharp(source).rotate().resize(resize).webp({ quality: 80 }).toFile(target);
  } catch (error) {
    if (!/\.hei[cf]$/i.test(source)) throw error;
    // sharp cannot decode HEVC; ffmpeg reads iPhone HEIC including tiled images.
    const png = execFileSync('ffmpeg', ['-v', 'error', '-i', source, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 256 * 1024 * 1024 });
    await sharp(png).resize(resize).webp({ quality: 80 }).toFile(target);
  }
}

/** The best segment (at most 8 s; the first 8 s when none is noted), silent, long side up to 1280 px. */
function cutVideo(source: string, target: string, from?: number, to?: number): void {
  const noted = from !== undefined && to !== undefined && to > from;
  const start = noted ? from : 0;
  const length = noted ? Math.min(8, to - from) : 8;
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', String(start), '-i', source, '-t', String(length), '-an',
    '-vf', "scale=w='if(gte(iw,ih),min(1280,iw),-2)':h='if(gte(iw,ih),-2,min(1280,ih))'",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target,
  ]);
}

/** «VID_0012.mp4 3–9; VID_0014.mp4 0-6» → [{ name, from, to }]. */
function videoNotes(value: string): { name: string; from?: number; to?: number }[] {
  return value
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const name = fileName(part);
      const range = /(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/.exec(part.replace(name, ''));
      return range
        ? { name, from: Number(range[1].replace(',', '.')), to: Number(range[2].replace(',', '.')) }
        : { name };
    })
    .filter((note) => note.name)
    .slice(0, VIDEOS_MAX);
}

/** Folder names as the admin panel makes them: the second event of a day gets «-1». */
function freeFolder(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 1; taken.has(name) || existsSync(join(args.content, 'events', name)); n += 1) name = `${base}-${n}`;
  taken.add(name);
  return name;
}

const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const ledger: Record<string, string> = existsSync(args.ledger) ? JSON.parse(readFileSync(args.ledger, 'utf8')) : {};
const report: string[] = [];
const taken = new Set<string>();

if (args.events) {
  const rows = parseCsv(readFileSync(args.events, 'utf8'));
  for (const row of rows) {
    const number = column(row, '№');
    if (column(row, 'статус').toLowerCase() !== 'готово') continue;
    if (ledger[number]) continue;
    const typeText = column(row, 'тип').toLowerCase();
    const type = TYPES[typeText] ?? (typeText.startsWith('другое') ? 'other' : '');
    const date = column(row, 'дата (');
    const zipName = column(row, 'zip');
    if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      report.push(`строка ${number}: пропущена — тип «${typeText}» или дата «${date}» не распознаны`);
      continue;
    }
    const zip = join(args.downloads, zipName);
    if (!zipName || !existsSync(zip)) {
      report.push(`строка ${number}: пропущена — нет архива «${zipName}» в ${args.downloads}`);
      continue;
    }
    const folder = freeFolder(`${date}-${type}`, taken);
    if (args['dry-run']) {
      report.push(`строка ${number}: будет ${folder} из ${zipName}`);
      continue;
    }

    // Downloaded archives are untrusted: each one is unpacked into its own new, empty folder.
    const unpacked = mkdtempSync(join(tmpdir(), 'chocoparty-album-'));
    execFileSync('python3', ['-I', '-m', 'zipfile', '-e', zip, unpacked]);
    const media = filesIn(unpacked);
    const dir = join(args.content, 'events', folder);
    mkdirSync(dir, { recursive: true });

    const coverName = fileName(column(row, 'обложка'));
    const images = media.filter((path) => IMAGE.test(path));
    const coverSource = images.find((path) => basename(path) === coverName) ?? images[0];
    if (!coverSource) {
      report.push(`строка ${number}: в архиве нет фото`);
      continue;
    }
    await toWebp(coverSource, join(dir, 'cover.webp'));
    const gallerySources = images.filter((path) => path !== coverSource);
    if (gallerySources.length > GALLERY_MAX) report.push(`строка ${number}: фото ${gallerySources.length}, взяты первые ${GALLERY_MAX}`);
    const gallery: string[] = [];
    for (const source of gallerySources.slice(0, GALLERY_MAX)) {
      const name = `${String(gallery.length + 1).padStart(2, '0')}.webp`;
      await toWebp(source, join(dir, name));
      gallery.push(name);
    }

    const videos: string[] = [];
    for (const note of videoNotes(column(row, 'видео'))) {
      const source = media.find((path) => basename(path) === note.name);
      if (!source) {
        report.push(`строка ${number}: видео ${note.name} не найдено в архиве`);
        continue;
      }
      const name = `video-${videos.length + 1}.mp4`;
      cutVideo(source, join(dir, name), note.from, note.to);
      videos.push(name);
    }

    const otherTitle = type === 'other' ? typeText.replace(/^другое:?\s*/, '') : '';
    const fountain = FOUNTAINS[column(row, 'фонтан').toLowerCase()];
    const entry = {
      date,
      type,
      ...(column(row, 'клиент') && { client: column(row, 'клиент') }),
      ...(otherTitle && { title: { ru: otherTitle.charAt(0).toUpperCase() + otherTitle.slice(1) } }),
      ...(column(row, 'площадка') && { venue: column(row, 'площадка') }),
      ...(fountain && { fountain }),
      cover: 'cover.webp',
      gallery,
      ...(videos.length && { videos }),
      ...(column(row, 'заметка') && { description: { ru: column(row, 'заметка') } }),
    };
    writeJson(join(dir, 'index.json'), entry);
    ledger[number] = folder;
    writeJson(args.ledger, ledger);
    report.push(`строка ${number}: ${folder} — фото ${gallery.length + 1}, видео ${videos.length}`);
  }
}

if (args.companies) {
  for (const row of parseCsv(readFileSync(args.companies, 'utf8'))) {
    const name = column(row, 'название');
    if (!name) continue;
    const slug = name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '');
    const dir = join(args.content, 'companies', slug);
    if (existsSync(join(dir, 'index.json'))) continue;
    if (args['dry-run']) {
      report.push(`компания ${name}: будет ${slug}`);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    const logoUrl = column(row, 'логотип: адрес');
    let logo = '';
    if (logoUrl) {
      const response = await fetch(logoUrl);
      const kind = response.headers.get('content-type') ?? '';
      const extension = kind.includes('svg') || extname(new URL(logoUrl).pathname) === '.svg' ? '.svg' : '.png';
      if (response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        logo = `logo${extension}`;
        if (extension === '.png') await sharp(bytes).resize({ height: 240, withoutEnlargement: true }).png().toFile(join(dir, logo));
        else writeFileSync(join(dir, logo), bytes);
      } else report.push(`компания ${name}: логотип не скачался (${response.status})`);
    }
    const url = column(row, 'сайт');
    writeJson(join(dir, 'index.json'), { name, ...(logo && { logo }), ...(/^https?:\/\//.test(url) && { url }) });
    report.push(`компания ${name}: ${slug}${logo ? '' : ' (без логотипа)'}`);
  }
}

console.log(report.join('\n') || 'Новых строк нет.');
