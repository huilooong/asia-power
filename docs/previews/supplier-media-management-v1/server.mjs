import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../../..');
const host = '127.0.0.1';
const port = Number(process.env.AP_SUPPLIER_PREVIEW_PORT || 8791);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon' };

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-preview-mode': 'read-only' });
  res.end(body);
}

function safeLocalPath(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const relative = urlPath === '/'
    ? 'docs/previews/supplier-media-management-v1/index.html'
    : (['styles.css', 'app.js'].includes(clean)
      ? `docs/previews/supplier-media-management-v1/${clean}`
      : clean);
  const full = path.resolve(workspace, relative);
  return full.startsWith(`${workspace}${path.sep}`) ? full : null;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, JSON.stringify({ error: 'Preview server is read-only' }), 'application/json; charset=utf-8');
    return;
  }

  if (requestUrl.pathname === '/api/half-cuts/public' || requestUrl.pathname.startsWith('/uploads/')) {
    try {
      const upstream = await fetch(`https://asia-power.com${requestUrl.pathname}${requestUrl.search}`, { method: req.method, redirect: 'follow' });
      const headers = { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store', 'x-preview-mode': 'read-only-proxy' };
      res.writeHead(upstream.status, headers);
      if (req.method === 'HEAD') res.end();
      else res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      send(res, 502, JSON.stringify({ error: 'Read-only upstream unavailable' }), 'application/json; charset=utf-8');
    }
    return;
  }

  const local = safeLocalPath(requestUrl.pathname);
  if (!local || !fs.existsSync(local) || !fs.statSync(local).isFile()) {
    send(res, 404, 'Not found');
    return;
  }
  const body = fs.readFileSync(local);
  send(res, 200, req.method === 'HEAD' ? '' : body, mime[path.extname(local).toLowerCase()] || 'application/octet-stream');
});

server.listen(port, host, () => {
  console.log(`AsiaPower supplier media preview: http://${host}:${port}/`);
  console.log('Read-only proxy: GET /api/half-cuts/public and /uploads/* only');
});
