/**
 * Makes the first-screen videos of the home page from phone recordings (4K, HDR, with sound, GPS and
 * shooting time inside): per clip a 720×1280 file for computers and a 540×960 one for phones, silent,
 * SDR, without metadata, in public/media/hero-<n>.mp4 and hero-<n>-s.mp4; the poster the page shows
 * until a video plays (and when the visitor saves data or avoids motion) is a frame of the first
 * clip, written to src/assets/hero.webp. Clips play one after another; keep each about 8 seconds.
 *
 * Usage: tsx scripts/prepare-hero.ts [--poster <seconds in the first clip>] clip.MOV@from-to ...
 *   e.g. tsx scripts/prepare-hero.ts --poster 5.8 IMG_6501.MOV@0.8-8.1 IMG_6477.MOV@0.4-8.4
 */
import { mkdirSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { encodeHeroClip, extractFrame } from './lib/ffmpeg';

const { values, positionals } = parseArgs({ options: { poster: { type: 'string', default: '2' } }, allowPositionals: true });
if (!positionals.length) throw new Error('Нужен хотя бы один ролик: clip.MOV@от-до');

mkdirSync('public/media', { recursive: true });
let first = '';
let firstPoster = 0;
for (const [index, spec] of positionals.entries()) {
  const [file, range = ''] = spec.split('@');
  const [from, to] = range.split('-').map(Number);
  const start = Number.isFinite(from) ? from : 0;
  const length = Number.isFinite(to) ? to - start : 8;
  const n = index + 1;
  for (const [suffix, height, crf] of [['', 1280, 24], ['-s', 960, 27]] as const) {
    const target = `public/media/hero-${n}${suffix}.mp4`;
    encodeHeroClip(file, target, { start, length, height, crf });
    console.log(`${target}: ${Math.round(statSync(target).size / 1024)} КБ`);
  }
  if (index === 0) {
    first = file;
    firstPoster = Number(values.poster);
  }
}
await sharp(extractFrame(first, firstPoster))
  .resize({ width: 1080, height: 1920, fit: 'inside' })
  .webp({ quality: 80 })
  .toFile('src/assets/hero.webp');
console.log(`src/assets/hero.webp: ${Math.round(statSync('src/assets/hero.webp').size / 1024)} КБ`);
