/**
 * Runs after `astro build`: turns every event video into a short silent clip for the site
 * (MP4 H.264, long side up to 1280 px, up to 8 s, about 1 MB) plus a WebP poster, written to
 * <outDir>/generated/events/<event>/ (see src/lib/video.ts). A clip already in that format (the
 * archive import makes them so) is only rewritten without metadata (a phone writes the shooting time
 * and GPS coordinates into its videos); anything else, such as a phone video the admin
 * uploaded, is compressed, HDR mapped to SDR. Results are cached in .video-cache by the hash of
 * the source, so only new videos are compressed. Needs ffmpeg on the PATH.
 * Usage: tsx scripts/prepare-videos.ts   (CONTENT_ROOT switches to fixture content and dist-test)
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { videoUrls } from '../src/lib/video';
import { encodeSiteClip, extractFrame, isSiteFormat, probeVideo, stripMetadata } from './lib/ffmpeg';

const root = process.env.CONTENT_ROOT ?? 'src/content';
const outDir = process.env.CONTENT_ROOT ? 'dist-test' : 'dist';
const cacheDir = '.video-cache';
const SETTINGS = 'h264-1280-crf27-8s-v2';

interface SourceVideo {
  slug: string;
  file: string;
  path: string;
}

function sourceVideos(): SourceVideo[] {
  const eventsDir = join(root, 'events');
  if (!existsSync(eventsDir)) return [];
  const found: SourceVideo[] = [];
  for (const slug of readdirSync(eventsDir).sort()) {
    const entryFile = join(eventsDir, slug, 'index.json');
    if (!existsSync(entryFile)) continue;
    const { videos } = JSON.parse(readFileSync(entryFile, 'utf8')) as { videos?: unknown };
    if (!Array.isArray(videos)) continue;
    for (const file of new Set(videos)) {
      if (typeof file !== 'string' || file.startsWith('blob:')) continue;
      const path = join(eventsDir, slug, file);
      if (existsSync(path)) found.push({ slug, file, path });
    }
  }
  return found;
}

async function compress(source: string, clip: string, poster: string): Promise<void> {
  const partClip = `${clip}.part.mp4`;
  if (isSiteFormat(probeVideo(source), statSync(source).size)) stripMetadata(source, partClip);
  else encodeSiteClip(source, partClip);
  await sharp(extractFrame(partClip, 0.3)).webp({ quality: 72 }).toFile(poster);
  renameSync(partClip, clip);
}

const videos = sourceVideos();
mkdirSync(cacheDir, { recursive: true });
let compressed = 0;
for (const video of videos) {
  const hash = createHash('sha1').update(SETTINGS).update(readFileSync(video.path)).digest('hex');
  const cachedClip = join(cacheDir, `${hash}.mp4`);
  const cachedPoster = join(cacheDir, `${hash}.webp`);
  if (!existsSync(cachedClip) || !existsSync(cachedPoster)) {
    await compress(video.path, cachedClip, cachedPoster);
    compressed += 1;
  }
  const urls = videoUrls(video.slug, video.file);
  for (const [cached, url] of [
    [cachedClip, urls.src],
    [cachedPoster, urls.poster],
  ] as const) {
    const target = join(outDir, url);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(cached, target);
  }
}

const largest = Math.max(0, ...videos.map((video) => statSync(join(outDir, videoUrls(video.slug, video.file).src)).size));
console.log(
  `Видео: ${videos.length}, сжато заново: ${compressed}, из кэша: ${videos.length - compressed}` +
    (videos.length ? `, самый большой ролик на сайте: ${Math.round(largest / 1024)} КБ` : ''),
);
