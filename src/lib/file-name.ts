/**
 * The file name of a photo or clip as the admin saw it, without folder and extension: «img-2800».
 * Built pages link photos as /_astro/img-2800.NKylzGsj.webp (Astro adds an 8-character hash), the dev
 * server as /@fs/…/img-2800.webp?origWidth=…; clips are listed by their own file names.
 */
export function fileNameOf(src: string): string {
  const last = src.split(/[?#]/)[0].split('/').pop() ?? '';
  const stem = last.replace(/\.[^.]+$/, '');
  return /^[^.]+\.[\w-]{8}$/.test(stem) ? stem.replace(/\.[\w-]{8}$/, '') : stem;
}
