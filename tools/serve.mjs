/**
 * Zero-dependency static server for local play testing.
 *
 * ES modules cannot load over file://, so opening index.html by double-click
 * fails with a CORS error. Run this instead:  node tools/serve.mjs
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../game', import.meta.url)));
const PORT = Number.parseInt(process.env.PORT ?? '5173', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

/** Resolves a request path inside ROOT, or null when it escapes the root. */
function resolveSafePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const absolute = resolve(join(ROOT, relative));

  if (absolute !== ROOT && !absolute.startsWith(ROOT + sep)) return null;
  return absolute;
}

const server = createServer(async (request, response) => {
  const requestPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = resolveSafePath(requestPath);

  if (!filePath) {
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      // No caching: every reload must show the latest edit.
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DEFLECT dev server → http://${HOST}:${PORT}`);
  console.log(`serving ${ROOT}`);
});
