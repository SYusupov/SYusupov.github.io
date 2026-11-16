/**
 * Where an event video lives on the site. scripts/prepare-videos.ts writes the compressed clip
 * and its poster to these paths after the build; pages only link to them.
 */
export function videoUrls(slug: string, file: string): { src: string; poster: string } {
  const base = `/generated/events/${slug}/${file.replace(/\.[^./]+$/, '')}`;
  return { src: `${base}.mp4`, poster: `${base}.webp` };
}
