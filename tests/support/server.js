import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const name =
      decodeURIComponent(new URL(request.url, 'http://localhost').pathname.slice(1)) ||
      'index.html';
    const type = types[name.split('.').at(-1)];
    if (!type || name.startsWith('.') || name.includes('/') || name.includes('\\')) {
      response.writeHead(404).end();
      return;
    }
    const body = await readFile(resolve(root, name));
    response
      .writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' })
      .end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(8866, '127.0.0.1');
