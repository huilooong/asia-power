const http = require('http');
const fs = require('fs');
const path = require('path');
const execFile = require('util').promisify(require('child_process').execFile);
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/ops/restore-public-site-20260915/manifest.json')));
const files = new Set(manifest.map(e => e.local));
const cache = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = decodeURIComponent(url.pathname).slice(1);
    if (!file || file.endsWith('/')) file += 'index.html';
    if (files.has(file)) {
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(root, file)));
    }
    const target = 'https://asia-power.com' + url.pathname + url.search;
    if (!cache.has(target)) cache.set(target, execFile('curl', ['-fsSL', '--max-time', '25', target], { maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' }).then(r => r.stdout));
    res.writeHead(200, { 'Content-Type': url.pathname.startsWith('/api/') ? 'application/json' : (mime[path.extname(file)] || 'application/octet-stream'), 'Cache-Control': 'no-store' });
    res.end(await cache.get(target));
  } catch (e) { res.writeHead(502); res.end('Preview resource unavailable'); }
}).listen(8877, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:8877'));
