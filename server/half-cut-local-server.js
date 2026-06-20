/**
 * AsiaPower — Local half-cut dev server
 * Static site + JSON state + multipart photo/video uploads (no Base64 in records).
 *
 * Usage: node server/half-cut-local-server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { createHalfCutApi } = require('./lib/half-cut-api');
const { createSessionAuth } = require('./lib/http-auth');
const { createRateLimiter } = require('./lib/rate-limit');
const { isBlockedStaticPath, applySecurityHeaders } = require('./lib/security-paths');
const { createContactLeadStore } = require('./lib/contact-leads');
const { notifyContactLead } = require('./lib/half-cut-notifications');
const { resolveClientGeo } = require('./lib/ip-geo');
const { isContactSpam } = require('./lib/lead-spam');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = ROOT;
const PORT = Number(process.env.PORT) || 8787;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

const limitLogin = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const limitContactLead = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 });
const limitRememberModel = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60 });
const contactLeads = createContactLeadStore(path.join(ROOT, 'data', 'contact-leads.json'));

function json(res, code, payload) {
  applySecurityHeaders(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const auth = createSessionAuth({
  usersFile: path.join(ROOT, 'data', 'users.json'),
  json,
  limitLogin,
});

const halfCut = createHalfCutApi(ROOT, {
  auth: {
    requireAdmin: (req, res) => auth.requireAdmin(req, res),
    allowUpload: (req) => auth.allowUpload(req),
  },
});
halfCut.ensureDirs();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function redirect(res, location, code = 301) {
  res.writeHead(code, {
    Location: location,
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end();
}

function sendNotFound(req, res) {
  const accept = req.headers.accept || '';
  if (accept.includes('application/json')) return json(res, 404, { error: 'Not found' });
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><body><h1>404</h1></body></html>');
}

function streamFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  const mime = mimeMap[ext] || halfCut.getUploadMime(filePath);
  const isText = mime.startsWith('text/') || mime === 'application/javascript' || mime === 'application/json';
  const isAsset = !['.html', '.xml', '.txt', '.json'].includes(ext);
  applySecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': isText ? `${mime}; charset=utf-8` : mime,
    'Cache-Control': isAsset ? 'public, max-age=86400' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function isDeniedStaticPath(pathname) {
  if (isBlockedStaticPath(pathname)) return true;
  const lower = String(pathname || '').toLowerCase();
  return lower.startsWith('/uploads/');
}

function serveStatic(req, res, pathname) {
  if (halfCut.isUploadPath(pathname)) {
    const u = auth.authUser(req);
    const isAdmin = u?.role === 'admin';
    if (!halfCut.canServeUpload(req, pathname, isAdmin)) return sendNotFound(req, res);
    const filePath = halfCut.resolveUploadFile(pathname);
    if (!filePath) return sendNotFound(req, res);
    return streamFile(req, res, filePath);
  }

  if (isDeniedStaticPath(pathname)) return sendNotFound(req, res);

  const redirectMap = {
    '/engines.html': '/engines/',
    '/gearboxes.html': '/gearboxes/',
    '/chassis-parts.html': '/chassis-parts/',
    '/half-cuts.html': '/half-cuts/',
  };
  if (redirectMap[pathname]) return redirect(res, redirectMap[pathname]);

  let cleanPath;
  try {
    cleanPath = decodeURIComponent(pathname);
  } catch {
    return sendNotFound(req, res);
  }
  if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;

  if (cleanPath !== '/' && !path.extname(cleanPath.replace(/\/$/, ''))) {
    const basePath = cleanPath.replace(/\/$/, '') || '';
    const relBase = basePath.replace(/^\//, '');
    const dirIndex = path.join(PUBLIC_DIR, relBase, 'index.html');
    const htmlFile = path.join(PUBLIC_DIR, `${relBase}.html`);
    if (!cleanPath.endsWith('/') && fs.existsSync(dirIndex)) return redirect(res, `${pathname}/`);
    if (fs.existsSync(htmlFile) && !fs.existsSync(dirIndex)) return redirect(res, `${pathname}.html`);
    if (cleanPath.endsWith('/') && fs.existsSync(dirIndex)) cleanPath = `${basePath}/index.html`;
  }

  cleanPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const filePath = path.join(PUBLIC_DIR, cleanPath.replace(/^\/+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendNotFound(req, res);
  }
  return streamFile(req, res, filePath);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Token, X-Supplier-Key',
        'Access-Control-Max-Age': '86400',
      });
      return res.end();
    }
    try {
      if (await auth.handleAuthRoutes(req, res, p, readBody)) return;
      if (req.method === 'POST' && p === '/api/leads/contact') {
        if (!limitContactLead(req)) return json(res, 429, { error: 'Too many requests' });
        const body = await readBody(req);
        if (isContactSpam(body)) return json(res, 400, { error: 'Invalid enquiry' });
        try {
          const geo = await resolveClientGeo(req);
          const lead = contactLeads.appendContactLead(body, {
            page: body.page,
            ...geo,
          });
          notifyContactLead(lead);
          return json(res, 201, { ok: true, id: lead.id });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Invalid enquiry' });
        }
      }
      if (req.method === 'GET' && p === '/api/vehicle-catalog/learned-models') {
        return json(res, 200, { models: halfCut.modelMemory.getAll() });
      }
      if (req.method === 'POST' && p === '/api/vehicle-catalog/remember-model') {
        if (!limitRememberModel(req)) return json(res, 429, { error: 'Too many requests' });
        const body = await readBody(req);
        const brand = String(body.brand || '').trim();
        const model = String(body.model || '').trim();
        if (!brand || !model) return json(res, 400, { error: 'brand and model required' });
        const added = halfCut.modelMemory.remember(brand, model);
        return json(res, 200, {
          ok: true,
          added,
          brand,
          model,
          models: halfCut.modelMemory.getForBrand(brand),
        });
      }
      if (p.startsWith('/api/half-cuts/')) {
        await halfCut.handleRequest(req, res, p, json);
        return;
      }
      return json(res, 404, { error: 'API not found' });
    } catch (err) {
      return json(res, 400, { error: err.message || 'Request failed' });
    }
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, p);
  }

  return json(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, BIND_HOST, () => {
  console.log(`Half-cut local server: http://${BIND_HOST}:${PORT}`);
  console.log(`Uploads: ${halfCut.UPLOADS_DIR}`);
  console.log(`State: ${halfCut.DATA_DIR}`);
});
