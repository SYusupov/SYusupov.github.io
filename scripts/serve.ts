/**
 * Serves a built site folder the way GitHub Pages does, for browser tests and local review:
 * `/dir/` → `dir/index.html`, `/dir` → 301 to `/dir/`, `/page` → `page.html`, otherwise `404.html`.
 * Usage: tsx scripts/serve.ts <folder> <port>
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [folderArg = 'dist', portArg = '4321'] = process.argv.slice(2);
const root = resolve(folderArg);
const port = Number(portArg);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.yml': 'text/yaml; charset=utf-8',
};

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
const isDir = (path: string) => existsSync(path) && statSync(path).isDirectory();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const target = normalize(join(root, pathname));
  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }

  let file: string | undefined;
  let status = 200;
  if (pathname.endsWith('/') && isFile(join(target, 'index.html'))) {
    file = join(target, 'index.html');
  } else if (!pathname.endsWith('/') && isFile(target)) {
    file = target;
  } else if (!pathname.endsWith('/') && isDir(target) && isFile(join(target, 'index.html'))) {
    response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
    return;
  } else if (!pathname.endsWith('/') && isFile(`${target}.html`)) {
    file = `${target}.html`;
  } else {
    status = 404;
    file = isFile(join(root, '404.html')) ? join(root, '404.html') : undefined;
  }

  if (!file) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(status, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}/`);
});
