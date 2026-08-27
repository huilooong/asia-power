#!/usr/bin/env node
/* Read-only visual preview: local UI assets + production GET data/media. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.AP_SECONDARY_PREVIEW_PORT || 8793);
const ORIGIN = 'https://asia-power.com';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
};

function safeLocalPath(urlPath) {
  let pathname;
  try { pathname = decodeURIComponent(urlPath); } catch { return null; }
  const clean = pathname === '/' ? '/index.html' : pathname;
  const candidate = path.resolve(ROOT, `.${clean}`);
  if (!candidate.startsWith(`${ROOT}${path.sep}`)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const index = path.join(candidate, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null;
}

async function proxyReadOnly(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, HEAD' });
    res.end(JSON.stringify({ error: 'Read-only preview' }));
    return;
  }
  const upstream = await fetch(`${ORIGIN}${url.pathname}${url.search}`, {
    headers: { accept: req.headers.accept || '*/*', range: req.headers.range || '' },
  });
  const headers = {};
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  headers['cache-control'] = 'no-store';
  res.writeHead(upstream.status, headers);
  if (req.method === 'HEAD' || !upstream.body) return res.end();
  for await (const chunk of upstream.body) res.write(chunk);
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      await proxyReadOnly(req, res, url);
      return;
    }
    const local = safeLocalPath(url.pathname);
    if (!local) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(local).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(local).pipe(res);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Preview proxy failed', message: error.message }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AsiaPower sitewide secondary preview: http://${HOST}:${PORT}`);
  console.log('Read-only: local UI assets with production GET inventory/media.');
});
