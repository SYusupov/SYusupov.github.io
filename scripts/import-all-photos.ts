/**
 * Loads EVERY photo and video of the events, for the manager to choose the best ones on the site.
 * The photo session exported them one folder per event («Все №N …», N is the event's number in the
 * «События» sheet); nothing is picked by quality. Two steps, so that what is doubtful can be held back:
 *
 *   stage  converts each file once into a staging folder outside the repository (photos: WebP up to
 *          1600 px, no metadata; videos: silent MP4 clips in the site format, no metadata) and
 *          measures it (size, sharpness, brightness, duration) into <stage>/<N>/items.json, with a
 *          small preview in <stage>/<N>/thumbs for contact sheets. A video longer than a site clip
 *          becomes a clip of its first CLIP_SECONDS seconds. A video with the same name as a photo
 *          beside it is the motion half of a Live Photo, part of the same frame, and is skipped.
 *   apply  copies the approved items into src/content/events and writes each event's index.json:
 *          an event already on the site keeps what was set up for it (title, description, cover and
 *          the clips picked earlier, unless the new clip holds them) and gets every approved photo
 *          and clip; an event not on the site yet is created from its row of the sheet. Items named
 *          in the hold file stay out (the owner had everything published on 2026-11-21; what the
 *          first import left out is kept in scripts/import-curation.json as `excludedBefore`, for the
 *          record only). Events of a single frame («singles») get no page.
 *
 * Usage: tsx scripts/import-all-photos.ts stage --photos <exported folders> --stage <staging folder>
 *          [--only 2,10] [--force]
 *        tsx scripts/import-all-photos.ts apply --stage <staging folder> --photos <exported folders>
 *          --events events.csv [--hold hold.json] [--content src/content] [--only 2,10] [--dry-run]
 *          [--report held.json]
 * hold.json: { "<event number>": { "<file name in the export>": "why it is held back" } }
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { GALLERY_MAX, VIDEOS_MAX } from '../src/lib/domain';
import { CLIP_SECONDS, encodeSiteClip, extractFrame, hdrToSdr, probeVideo } from './lib/ffmpeg';
import { cleanName, column, eventTypeOf, fountainOf, numberOf, ownTitleOf, parseCsv } from './lib/sheet';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    photos: { type: 'string' },
    stage: { type: 'string' },
    events: { type: 'string' },
    hold: { type: 'string' },
    report: { type: 'string' },
    content: { type: 'string', default: 'src/content' },
    ledger: { type: 'string', default: 'scripts/import-ledger.json' },
    curation: { type: 'string', default: 'scripts/import-curation.json' },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

// sharp's libvips has no HEVC decoder; heic-decode (libheif in WebAssembly) reads the whole image, upright.
const decodeHeic = createRequire(import.meta.url)('heic-decode') as (input: {
  buffer: Buffer;
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;

const IMAGE = /\.(jpe?g|png|heic|heif|webp)$/i;
const VIDEO = /\.(mp4|mov|m4v)$/i;
const RESIZE = { width: 1600, height: 1600, fit: 'inside' as const, withoutEnlargement: true };
const THUMB = { width: 360, height: 360, fit: 'inside' as const };

export interface StagedItem {
  /** File name in the export. */
  name: string;
  kind: 'photo' | 'video' | 'live' | 'other' | 'error';
  /** File name without extension, lowercased and made safe for an address: the staged file's name. */
  stem?: string;
  bytes?: number;
  width?: number;
  height?: number;
  /** Laplacian variance of a 512 px grey copy: low means blurred. */
  sharpness?: number;
  /** Mean grey level 0–255 of the same copy. */
  brightness?: number;
  /** 64-bit average hash (hex), to spot near-duplicates. */
  hash?: string;
  /** Seconds. */
  duration?: number;
  hdr?: boolean;
  /** A video longer than a site clip: the site gets its first CLIP_SECONDS seconds. */
  tooLong?: boolean;
  /** Staged file relative to the event's staging folder: photos/<stem>.webp or videos/<stem>.mp4. */
  file?: string;
  fileBytes?: number;
  thumb?: string;
  pairedWith?: string;
  message?: string;
}

const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const readJson = <T>(path: string | undefined, fallback: T): T =>
  path && existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** «IMG_0012.HEIC» → «img-0012»; the name a staged file (and later a file on the site) carries. */
function uniqueStem(name: string, used: Set<string>): string {
  const base = basename(name, extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  let stem = base || 'file';
  for (let n = 2; used.has(stem); n += 1) stem = `${base || 'file'}-${n}`;
  used.add(stem);
  return stem;
}

/** Sharpness, brightness and a 64-bit average hash of a picture, from a small grey copy. */
async function measure(file: string): Promise<{ sharpness: number; brightness: number; hash: string }> {
  const { data, info } = await sharp(file).resize({ width: 512, height: 512, fit: 'inside' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  let total = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const laplacian = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }
  for (const value of data) total += value;
  const small = await sharp(data, { raw: { width: w, height: h, channels: 1 } }).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
  const mean = small.reduce((acc, value) => acc + value, 0) / small.length;
  let bits = '';
  for (const value of small) bits += value >= mean ? '1' : '0';
  const hash = BigInt(`0b${bits}`).toString(16).padStart(16, '0');
  return { sharpness: round(sumSquares / count - (sum / count) ** 2), brightness: round(total / data.length), hash };
}

/** How many of the 64 bits of two hashes differ. */
function distance(a: string, b: string): number {
  let bits = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  for (; bits; bits >>= 1n) count += Number(bits & 1n);
  return count;
}

async function stagePhoto(source: string, dir: string, name: string, stem: string): Promise<StagedItem> {
  const file = `photos/${stem}.webp`;
  const target = join(dir, file);
  let width: number;
  let height: number;
  if (/\.hei[cf]$/i.test(source)) {
    const decoded = await decodeHeic({ buffer: readFileSync(source) });
    ({ width, height } = decoded);
    if (args.force || !existsSync(target)) {
      const pixels = Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
      await sharp(pixels, { raw: { width, height, channels: 4 } }).resize(RESIZE).webp({ quality: 80 }).toFile(target);
    }
  } else {
    const meta = await sharp(source).metadata();
    const sideways = (meta.orientation ?? 1) >= 5;
    width = (sideways ? meta.height : meta.width) ?? 0;
    height = (sideways ? meta.width : meta.height) ?? 0;
    if (args.force || !existsSync(target)) await sharp(source).rotate().resize(RESIZE).webp({ quality: 80 }).toFile(target);
  }
  const thumb = `thumbs/${stem}.jpg`;
  await sharp(target).resize(THUMB).jpeg({ quality: 70 }).toFile(join(dir, thumb));
  return {
    name,
    kind: 'photo',
    stem,
    bytes: statSync(source).size,
    width,
    height,
    ...(await measure(target)),
    file,
    fileBytes: statSync(target).size,
    thumb,
  };
}

async function stageVideo(source: string, dir: string, name: string, stem: string): Promise<StagedItem> {
  const info = probeVideo(source);
  const sideways = info.rotation === 90 || info.rotation === 270;
  const item: StagedItem = {
    name,
    kind: 'video',
    stem,
    bytes: statSync(source).size,
    width: sideways ? info.height : info.width,
    height: sideways ? info.width : info.height,
    duration: round(info.duration),
    hdr: hdrToSdr(info).length > 0,
  };
  const thumb = `thumbs/${stem}.jpg`;
  await sharp(extractFrame(source, Math.min(0.5, info.duration / 2))).resize(THUMB).jpeg({ quality: 70 }).toFile(join(dir, thumb));
  item.thumb = thumb;
  if (info.duration > CLIP_SECONDS + 0.5) item.tooLong = true;
  const file = `videos/${stem}.mp4`;
  const target = join(dir, file);
  if (args.force || !existsSync(target)) encodeSiteClip(source, target, 0, Math.min(info.duration, CLIP_SECONDS));
  item.file = file;
  item.fileBytes = statSync(target).size;
  return item;
}

async function stageEvent(key: string, folder: string): Promise<string> {
  const dir = join(args.stage as string, key);
  for (const sub of ['photos', 'videos', 'thumbs']) mkdirSync(join(dir, sub), { recursive: true });
  const names = readdirSync(folder).filter((name) => statSync(join(folder, name)).isFile()).sort(natural);
  const imageStems = new Set(names.filter((name) => IMAGE.test(name)).map((name) => basename(name, extname(name)).toLowerCase()));
  const used = new Set<string>();
  const items: StagedItem[] = [];
  for (const name of names) {
    const source = join(folder, name);
    const plain = basename(name, extname(name));
    try {
      if (VIDEO.test(name) && imageStems.has(plain.toLowerCase())) {
        const photo = names.find((other) => IMAGE.test(other) && basename(other, extname(other)).toLowerCase() === plain.toLowerCase());
        items.push({ name, kind: 'live', pairedWith: photo });
      } else if (IMAGE.test(name)) items.push(await stagePhoto(source, dir, name, uniqueStem(name, used)));
      else if (VIDEO.test(name)) items.push(await stageVideo(source, dir, name, uniqueStem(name, used)));
      else items.push({ name, kind: 'other' });
    } catch (error) {
      items.push({ name, kind: 'error', message: error instanceof Error ? error.message.split('\n')[0] : String(error) });
    }
  }
  writeJson(join(dir, 'items.json'), items);
  const count = (kind: StagedItem['kind']) => items.filter((item) => item.kind === kind).length;
  return `№${key}: фото ${count('photo')}, видео ${count('video')} (длинных ${items.filter((item) => item.tooLong).length}), Live Photo ${count('live')}, ошибок ${count('error')}`;
}

/** The export's folder of an event: «Все №58 2022-10-07 …» for key «58». */
function exportFolders(): Map<string, string> {
  const found = new Map<string, string>();
  for (const folder of readdirSync(args.photos as string).sort(natural)) {
    if (!statSync(join(args.photos as string, folder)).isDirectory()) continue;
    const key = /^Все №(\d+)\b/.exec(folder)?.[1] ?? (folder.includes('одиночные') ? 'singles' : '');
    if (key) found.set(key, join(args.photos as string, folder));
  }
  return found;
}

const onlyKeys = args.only ? new Set(args.only.split(',').map((part) => part.trim())) : undefined;

async function stage(): Promise<void> {
  if (!args.photos || !args.stage) throw new Error('нужны --photos и --stage');
  for (const [key, folder] of exportFolders()) {
    if (onlyKeys && !onlyKeys.has(key)) continue;
    console.log(await stageEvent(key, folder));
  }
}

interface Curation {
  client?: string;
  title?: string;
  description?: string;
  cover?: string;
  /** What the first import left out; kept for the record, no longer applied. */
  excludedBefore?: string[];
  clips?: { file: string; from: number; to: number }[];
}

interface HeldItem {
  event: string;
  name: string;
  why: string;
}

const ORDER = ['date', 'type', 'client', 'title', 'fountain', 'cover', 'gallery', 'videos', 'description'];

/** The cover of an event that is not on the site yet: the sheet's pick, else the sharpest well-lit landscape. */
function pickCover(photos: StagedItem[], wanted: string): StagedItem {
  const named = photos.find((photo) => photo.name === wanted);
  if (named) return named;
  const score = (photo: StagedItem) =>
    Math.min(photo.sharpness ?? 0, 1500) *
    ((photo.width ?? 0) >= (photo.height ?? 0) ? 1.25 : 1) *
    ((photo.brightness ?? 0) >= 60 && (photo.brightness ?? 0) <= 200 ? 1 : 0.5) *
    ((photo.width ?? 0) >= 1000 ? 1 : 0.4);
  return [...photos].sort((a, b) => score(b) - score(a))[0];
}

async function stillFrom(video: string, at: number, target: string): Promise<void> {
  await sharp(extractFrame(video, at)).resize(RESIZE).webp({ quality: 80 }).toFile(target);
}

async function apply(): Promise<void> {
  if (!args.stage || !args.photos || !args.events) throw new Error('нужны --stage, --photos и --events');
  const rows = parseCsv(readFileSync(args.events, 'utf8'));
  const hold = readJson<Record<string, Record<string, string>>>(args.hold, {});
  const curation = readJson<Record<string, Curation>>(args.curation, {});
  const ledger = readJson<Record<string, string>>(args.ledger, {});
  const folders = exportFolders();
  const report: string[] = [];
  const held: HeldItem[] = [];
  const repeats: HeldItem[] = [];

  for (const key of readdirSync(args.stage).sort(natural)) {
    if (key === 'singles' || (onlyKeys && !onlyKeys.has(key))) continue;
    const row = rows.find((candidate) => numberOf(candidate) === key);
    if (!row) {
      report.push(`№${key}: пропущено — нет строки в таблице`);
      continue;
    }
    const items = readJson<StagedItem[]>(join(args.stage, key, 'items.json'), []);
    const reasons = new Map<string, string>(Object.entries(hold[key] ?? {}));
    for (const item of items) {
      if (reasons.has(item.name)) held.push({ event: key, name: item.name, why: reasons.get(item.name) as string });
      else if (item.kind === 'video' && item.tooLong && !item.file) held.push({ event: key, name: item.name, why: `видео ${item.duration} с: нет ролика, повторите stage` });
      else if (item.kind === 'error') held.push({ event: key, name: item.name, why: `не конвертируется: ${item.message}` });
    }
    const stagedPath = (item: StagedItem) => join(args.stage as string, key, item.file as string);
    // The same photo saved twice under two names is shown once: a page with two identical files also confuses the build.
    const digestOf = (path: string) => createHash('sha1').update(readFileSync(path)).digest('hex');
    const firstOf = new Map<string, StagedItem>();
    const photos: StagedItem[] = [];
    for (const item of items.filter((candidate) => candidate.kind === 'photo' && candidate.file && !reasons.has(candidate.name)).sort((a, b) => natural(a.name, b.name))) {
      const digest = digestOf(stagedPath(item));
      const same = firstOf.get(digest);
      if (same) repeats.push({ event: key, name: item.name, why: `повтор: тот же кадр, что ${same.name}` });
      else (firstOf.set(digest, item), photos.push(item));
    }
    const clips = items.filter((item) => item.kind === 'video' && item.file && !reasons.has(item.name));

    const type = eventTypeOf(column(row, 'тип'));
    const date = column(row, 'дата (');
    const folder = ledger[key] ?? `${type}-${key}`;
    const dir = join(args.content, 'events', folder);
    const existing = existsSync(join(dir, 'index.json'));
    const old = existing ? readJson<Record<string, unknown>>(join(dir, 'index.json'), {}) : {};
    if (!existing && (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      report.push(`№${key}: пропущено — тип «${column(row, 'тип')}» или дата «${date}» не распознаны`);
      continue;
    }

    // Cover and gallery.
    const cover: string = existing ? (old.cover as string) : 'cover.webp';
    let gallery: string[] = [];
    let keepOldGallery = false;
    const writes: { from: string; to: string }[] = [];
    const frames: { video: string; at: number; to: string }[] = [];
    const source = folders.get(key);
    if (existing && photos.length === 0) {
      keepOldGallery = true; // an event of videos only: the frames picked earlier stay
    } else if (photos.length > 0) {
      let coverItem: StagedItem | undefined;
      if (existing) {
        // The cover is the staged photo with the very same bytes; failing that, the nearest by look (a frame picked from a video matches none).
        const coverPath = join(dir, cover);
        const coverDigest = digestOf(coverPath);
        coverItem = photos.find((photo) => digestOf(stagedPath(photo)) === coverDigest);
        if (!coverItem) {
          const coverHash = (await measure(coverPath)).hash;
          const nearest = photos.map((photo) => ({ photo, d: distance(photo.hash as string, coverHash) })).sort((a, b) => a.d - b.d)[0];
          if (nearest && nearest.d <= 2) coverItem = nearest.photo;
        }
      } else {
        coverItem = photos.length > 1 ? pickCover(photos, /[\w.-]+\.(?:heic|jpe?g|png)/i.exec(column(row, 'обложка'))?.[0] ?? '') : photos[0];
        writes.push({ from: stagedPath(coverItem), to: join(dir, 'cover.webp') });
      }
      const rest = photos.filter((photo) => photo !== coverItem);
      gallery = rest.map((photo) => `${photo.stem}.webp`);
      for (const photo of rest) writes.push({ from: stagedPath(photo), to: join(dir, `${photo.stem}.webp`) });
      if (rest.length === 0) {
        if (existing) keepOldGallery = true; // the cover is the only photo left: the gallery picked earlier stays
        else if (clips.length > 0 && source) {
          // one photo and some clips: a frame of the first clip is the gallery's photo
          frames.push({ video: join(source, clips[0].name), at: (clips[0].duration ?? 2) / 2, to: join(dir, 'frame-1.webp') });
          gallery = ['frame-1.webp'];
        } else {
          report.push(`№${key}: пропущено — один подходящий кадр, страница из одного фото не создаётся`);
          continue;
        }
      }
    } else if (clips.length > 0 && source) {
      // no photos at all: frames of the videos stand in for them (the cover and up to two more)
      const early = (video: StagedItem) => Math.min(0.5, (video.duration ?? 1) / 2);
      const middle = (video: StagedItem) => (video.duration ?? 2) / 2;
      const picks =
        clips.length > 1
          ? clips.slice(0, 3).map((video) => ({ video, at: early(video) }))
          : [
              { video: clips[0], at: early(clips[0]) },
              { video: clips[0], at: middle(clips[0]) },
            ];
      picks.forEach(({ video, at }, index) => {
        const to = index === 0 ? join(dir, 'cover.webp') : join(dir, `frame-${index}.webp`);
        frames.push({ video: join(source, video.name), at, to });
        if (index > 0) gallery.push(`frame-${index}.webp`);
      });
    } else {
      report.push(`№${key}: пропущено — нет ни одного подходящего фото или ролика`);
      continue;
    }

    if (keepOldGallery) gallery = (old.gallery as string[]) ?? [];
    // Frames picked earlier from the videos (files the staging does not know) stay after the photos.
    const knownPhotos = new Set(items.filter((item) => item.kind === 'photo' && item.stem).map((item) => `${item.stem}.webp`));
    const keptFrames = existing && !keepOldGallery ? ((old.gallery as string[] | undefined) ?? []).filter((name) => !knownPhotos.has(name) && name !== cover) : [];
    gallery.push(...keptFrames.filter((name) => !gallery.includes(name)));

    // Clips: every approved one; the clips picked earlier stay unless their whole video comes now.
    const videos: string[] = [];
    const keep: string[] = [];
    if (existing) {
      // «video-N.mp4» are the clips picked at the first import (N-th of the curation's clips); every other clip
      // was written by this script and is rebuilt from the staging, so a second run changes nothing. A picked
      // clip goes when the new clip of the same video holds it: the whole video, or its first CLIP_SECONDS
      // seconds when the piece lies within them.
      const picked = curation[key]?.clips ?? [];
      const published = new Map(clips.map((clip) => [clip.name, clip]));
      for (const file of (old.videos as string[] | undefined) ?? []) {
        const number = /^video-(\d+)\.mp4$/.exec(file)?.[1];
        if (!number) continue;
        const piece = picked[Number(number) - 1];
        const clip = piece && published.get(piece.file);
        const covered = clip && (!clip.tooLong || piece.to <= CLIP_SECONDS);
        if (!covered) keep.push(file);
      }
    }
    videos.push(...keep);
    for (const clip of clips) {
      writes.push({ from: stagedPath(clip), to: join(dir, `${clip.stem}.mp4`) });
      videos.push(`${clip.stem}.mp4`);
    }
    if (gallery.length > GALLERY_MAX) report.push(`№${key}: фото ${gallery.length} больше предела ${GALLERY_MAX}`);
    if (videos.length > VIDEOS_MAX) report.push(`№${key}: роликов ${videos.length} больше предела ${VIDEOS_MAX}`);

    const client = curation[key]?.client ?? cleanName(column(row, 'клиент'));
    const fountain = fountainOf(column(row, 'фонтан'));
    const description = curation[key]?.description;
    const entry: Record<string, unknown> = existing
      ? { ...old, gallery, videos }
      : {
          date,
          type,
          ...(client && { client }),
          ...(type === 'other' && { title: { ru: curation[key]?.title ?? ownTitleOf(column(row, 'тип')) } }),
          ...(fountain && { fountain }),
          cover,
          gallery,
          videos,
          ...(description && { description: { ru: description } }),
        };
    if (!videos.length) delete entry.videos;
    const ordered = Object.fromEntries([
      ...ORDER.filter((name) => name in entry).map((name) => [name, entry[name]]),
      ...Object.entries(entry).filter(([name]) => !ORDER.includes(name)),
    ]);

    const trimmed = clips.filter((clip) => clip.tooLong).length;
    report.push(
      `№${key}: ${folder} — ${existing ? 'обновлено' : 'новое'}, фото ${gallery.length + 1}, видео ${videos.length}` +
        (keep.length ? ` (прежних роликов оставлено ${keep.length})` : '') +
        (trimmed ? ` (обрезано до ${CLIP_SECONDS} с: ${trimmed})` : ''),
    );
    if (args['dry-run']) continue;

    mkdirSync(dir, { recursive: true });
    if (existing) {
      // the folder is rebuilt: photos and clips go, except the cover and the clips kept
      for (const name of readdirSync(dir)) {
        if (name === 'index.json' || name === 'cover.webp' || keep.includes(name) || keptFrames.includes(name)) continue;
        if (keepOldGallery && gallery.includes(name)) continue;
        if (/\.(webp|mp4)$/i.test(name)) rmSync(join(dir, name));
      }
    }
    for (const write of writes) copyFileSync(write.from, write.to);
    for (const frame of frames) await stillFrom(frame.video, frame.at, frame.to);
    writeJson(join(dir, 'index.json'), ordered);
    if (!ledger[key]) {
      ledger[key] = folder;
      writeJson(args.ledger, ledger);
    }
  }
  if (args.report) writeJson(args.report, { held, repeats });
  console.log(report.join('\n') || 'Нечего загружать.');
  console.log(`Задержано файлов: ${held.length}; повторов не выложено: ${repeats.length}`);
}

if (positionals[0] === 'stage') await stage();
else if (positionals[0] === 'apply') await apply();
else {
  console.error('Команды: stage, apply');
  process.exit(1);
}
