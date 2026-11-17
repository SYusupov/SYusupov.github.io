/**
 * ffmpeg helpers shared by the archive import and the build-time video preparation:
 * what a clip on the site looks like, how to probe a source, how to cut or compress one,
 * how to take a still frame. Needs ffmpeg and ffprobe on the PATH.
 */
import { execFileSync } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';

/** A clip on the site: at most this long (seconds), at most this wide on the long side (pixels). */
export const CLIP_SECONDS = 8;
export const CLIP_LONG_SIDE = 1280;
const CLIP_FPS = 30;

export interface VideoInfo {
  codec: string;
  pixelFormat: string;
  width: number;
  height: number;
  /** Degrees from the container's display matrix; phones record sideways and rotate on playback. */
  rotation: number;
  fps: number;
  duration: number;
  hasAudio: boolean;
  /** `arib-std-b67` (HLG) and `smpte2084` (PQ) mean HDR. */
  transfer: string;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  color_transfer?: string;
  side_data_list?: { rotation?: number }[];
}

export function probeVideo(file: string): VideoInfo {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const { streams = [], format = {} } = JSON.parse(raw) as { streams?: ProbeStream[]; format?: { duration?: string } };
  const video = streams.find((stream) => stream.codec_type === 'video') ?? {};
  const [numerator, denominator] = (video.avg_frame_rate ?? '0/1').split('/').map(Number);
  return {
    codec: video.codec_name ?? '',
    pixelFormat: video.pix_fmt ?? '',
    width: video.width ?? 0,
    height: video.height ?? 0,
    rotation: Math.abs(video.side_data_list?.find((data) => data.rotation !== undefined)?.rotation ?? 0) % 360,
    fps: denominator ? numerator / denominator : 0,
    duration: Number(format.duration ?? 0),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
    transfer: video.color_transfer ?? '',
  };
}

/** Phone HDR video converted to H.264 untouched looks flat and grey; map it to SDR first. */
const HDR_TO_SDR = [
  'zscale=t=linear:npl=100',
  'format=gbrpf32le',
  'zscale=p=bt709',
  'tonemap=tonemap=hable:desat=0',
  'zscale=t=bt709:m=bt709:r=tv',
  'format=yuv420p',
];

export const hdrToSdr = (info: VideoInfo): string[] =>
  info.transfer === 'arib-std-b67' || info.transfer === 'smpte2084' ? HDR_TO_SDR : [];

/** Already in site format: nothing to gain from compressing it a second time. */
export function isSiteFormat(info: VideoInfo, bytes: number): boolean {
  return (
    info.codec === 'h264' &&
    info.pixelFormat === 'yuv420p' &&
    info.rotation === 0 &&
    !info.hasAudio &&
    Math.max(info.width, info.height) <= CLIP_LONG_SIDE &&
    info.fps <= CLIP_FPS + 0.5 &&
    info.duration <= CLIP_SECONDS + 0.2 &&
    bytes <= 3 * 1024 * 1024 &&
    hdrToSdr(info).length === 0
  );
}

/** A phone video carries the shooting time, the device and GPS coordinates; nothing of it may be published. */
// `-brand mp42` also drops the Dolby Vision brand a phone's HDR file hands on to the SDR copy.
const NO_METADATA = ['-map_metadata', '-1', '-map_metadata:s:v', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-brand', 'mp42'];

/** The same video stream copied without any metadata (no re-encoding). */
export function stripMetadata(source: string, target: string): void {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-map', '0:v:0', '-c', 'copy', ...NO_METADATA, '-movflags', '+faststart', target]);
}

/** An encoder keeps some of the source's signalling (a Dolby Vision brand): a copy-remux makes the file clean. */
function encodeThenClean(args: string[], target: string): void {
  const rough = `${target}.rough.mp4`;
  try {
    execFileSync('ffmpeg', [...args, rough]);
    stripMetadata(rough, `${target}.part.mp4`);
    renameSync(`${target}.part.mp4`, target);
  } finally {
    rmSync(rough, { force: true });
  }
}

/** Silent MP4 H.264 up to `length` seconds from `start`, long side up to 1280 px, 30 fps, upright, SDR, no metadata. */
export function encodeSiteClip(source: string, target: string, start = 0, length = CLIP_SECONDS): void {
  const info = probeVideo(source);
  const filters = [
    `scale=w='if(gte(iw,ih),min(${CLIP_LONG_SIDE},iw),-2)':h='if(gte(iw,ih),-2,min(${CLIP_LONG_SIDE},ih))'`,
    ...hdrToSdr(info),
    `fps=${CLIP_FPS}`,
    'format=yuv420p',
  ];
  encodeThenClean(
    [
      '-v', 'error', '-y', '-ss', String(start), '-i', source, '-t', String(Math.min(length, CLIP_SECONDS)), '-an',
      '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', ...NO_METADATA,
    ],
    target,
  );
}

/** A tall (9:16) clip for the first screen: HDR mapped to SDR, 30 fps, silent, without metadata. */
export function encodeHeroClip(
  source: string,
  target: string,
  { start, length, height, crf }: { start: number; length: number; height: number; crf: number },
): void {
  const filters = [`scale=-2:${height}`, ...hdrToSdr(probeVideo(source)), `fps=${CLIP_FPS}`, 'format=yuv420p'];
  encodeThenClean(
    [
      '-v', 'error', '-y', '-ss', String(start), '-i', source, '-t', String(length), '-an',
      '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', ...NO_METADATA,
    ],
    target,
  );
}

/** One full-size frame at `at` seconds as PNG, upright and SDR. */
export function extractFrame(source: string, at: number): Buffer {
  const filters = hdrToSdr(probeVideo(source));
  return execFileSync(
    'ffmpeg',
    ['-v', 'error', '-ss', String(at), '-i', source, '-frames:v', '1', ...(filters.length ? ['-vf', filters.join(',')] : []), '-f', 'image2pipe', '-vcodec', 'png', '-'],
    { maxBuffer: 256 * 1024 * 1024 },
  );
}
