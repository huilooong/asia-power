const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 8080;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
const ROOT = process.env.INVENTORY_SITE_ROOT || __dirname;
const loadEnvPath = [
  path.join(__dirname, 'lib', 'load-env.js'),
  path.join(__dirname, '..', 'server', 'lib', 'load-env.js'),
].find((candidate) => fs.existsSync(candidate));
if (loadEnvPath) {
  require(loadEnvPath).loadEnv(ROOT);
}
const telegramNotifyPath = [
  path.join(__dirname, 'lib', 'telegram-notify.js'),
  path.join(__dirname, '..', 'server', 'lib', 'telegram-notify.js'),
].find((candidate) => fs.existsSync(candidate));
if (telegramNotifyPath) {
  require(telegramNotifyPath).resetConfig();
}

const halfCutApiPath = [
  path.join(__dirname, 'lib', 'half-cut-api.js'),
  path.join(__dirname, '..', 'server', 'lib', 'half-cut-api.js'),
].find((candidate) => fs.existsSync(candidate));
if (!halfCutApiPath) {
  throw new Error('half-cut-api module not found');
}
const { createHalfCutApi } = require(halfCutApiPath);
const { assertProductionEnv, isProduction } = require(
  [path.join(__dirname, 'lib', 'startup-checks.js'), path.join(__dirname, '..', 'server', 'lib', 'startup-checks.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'startup-checks.js')
);
assertProductionEnv();
const { createRateLimiter } = require(
  [path.join(__dirname, 'lib', 'rate-limit.js'), path.join(__dirname, '..', 'server', 'lib', 'rate-limit.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'rate-limit.js')
);
const { isBlockedStaticPath, applySecurityHeaders } = require(
  [path.join(__dirname, 'lib', 'security-paths.js'), path.join(__dirname, '..', 'server', 'lib', 'security-paths.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'security-paths.js')
);
const halfCutNotificationsPath = [
  path.join(__dirname, 'lib', 'half-cut-notifications.js'),
  path.join(__dirname, '..', 'server', 'lib', 'half-cut-notifications.js'),
].find((candidate) => fs.existsSync(candidate));
const { notifyWhatsappClick, notifyContactLead, notifyHalfCutLead, notifyProductLead } = halfCutNotificationsPath
  ? require(halfCutNotificationsPath)
  : { notifyWhatsappClick: () => {}, notifyContactLead: () => {}, notifyHalfCutLead: () => {}, notifyProductLead: () => {} };
const contactLeadsPath = [
  path.join(__dirname, 'lib', 'contact-leads.js'),
  path.join(__dirname, '..', 'server', 'lib', 'contact-leads.js'),
].find((candidate) => fs.existsSync(candidate));
const { createContactLeadStore } = require(contactLeadsPath || path.join(__dirname, '..', 'server', 'lib', 'contact-leads.js'));
const siteAnalyticsPath = [
  path.join(__dirname, 'lib', 'site-analytics.js'),
  path.join(__dirname, '..', 'server', 'lib', 'site-analytics.js'),
].find((candidate) => fs.existsSync(candidate));
const { createSiteAnalytics } = require(siteAnalyticsPath || path.join(__dirname, '..', 'server', 'lib', 'site-analytics.js'));
const ipGeoPath = [
  path.join(__dirname, 'lib', 'ip-geo.js'),
  path.join(__dirname, '..', 'server', 'lib', 'ip-geo.js'),
].find((candidate) => fs.existsSync(candidate));
const { resolveClientGeo } = require(ipGeoPath || path.join(__dirname, '..', 'server', 'lib', 'ip-geo.js'));
const leadSpamPath = [
  path.join(__dirname, 'lib', 'lead-spam.js'),
  path.join(__dirname, '..', 'server', 'lib', 'lead-spam.js'),
].find((candidate) => fs.existsSync(candidate));
const { isContactSpam, isHalfCutSpam, isProductSpam, contactSpamReason, halfCutSpamReason, productSpamReason } = require(leadSpamPath || path.join(__dirname, '..', 'server', 'lib', 'lead-spam.js'));
const sitemapPath = [
  path.join(__dirname, 'lib', 'sitemap.js'),
  path.join(__dirname, '..', 'server', 'lib', 'sitemap.js'),
].find((candidate) => fs.existsSync(candidate));
const { buildSitemapXml, sendSitemap } = require(sitemapPath || path.join(__dirname, '..', 'server', 'lib', 'sitemap.js'));
const halfCutPrerenderPath = [
  path.join(__dirname, 'lib', 'half-cut-prerender.js'),
  path.join(__dirname, '..', 'server', 'lib', 'half-cut-prerender.js'),
].find((candidate) => fs.existsSync(candidate));
const { renderHalfCutDetailPage, sendPrerenderedHtml } = require(
  halfCutPrerenderPath || path.join(__dirname, '..', 'server', 'lib', 'half-cut-prerender.js')
);
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const INBOUND_FILE = path.join(DATA_DIR, 'inbound-intake.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const CONTACT_LEADS_FILE = path.join(DATA_DIR, 'contact-leads.json');
const contactLeads = createContactLeadStore(CONTACT_LEADS_FILE);
const siteAnalytics = createSiteAnalytics(DATA_DIR);

// Base currency: 1 USD = x currency
const FX_USD = {
  USD: 1,
  GHS: 15.8,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.1,
  NGN: 1550,
  KES: 128,
  ZAR: 18.7,
  AED: 3.67,
  SAR: 3.75,
  INR: 83.1,
  JPY: 149,
  CAD: 1.36,
  AUD: 1.52
};

function toUSD(price, currency) {
  const rate = FX_USD[String(currency || 'USD').toUpperCase()] || 1;
  return Number(price) / rate;
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let users = loadJson(USERS_FILE, [
  {
    id: 'admin-1',
    username: 'admin',
    role: 'admin',
    supplierName: 'Platform Admin',
    salt: 'seed',
    hash: 'seed-change-me'
  }
]);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

if (users[0]?.hash === 'seed-change-me') {
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD environment variable is required for initial admin setup');
  }
  const { salt, hash } = hashPassword(process.env.ADMIN_PASSWORD);
  users[0].salt = salt;
  users[0].hash = hash;
  saveJson(USERS_FILE, users);
  console.log('[init] Admin password initialized from ADMIN_PASSWORD');
}

let items = loadJson(ITEMS_FILE, [
  { id: 'i1', model: '1ZR', description: 'In transit batch A', price: 21000, currency: 'GHS', qty: 4, status: 'transit', ownerType: 'self', supplierId: null, approved: true },
  { id: 'i2', model: '2AZ 4-speed', description: 'Consignment (Wu)', price: 15716.025, currency: 'USD', qty: 3, status: 'stock', ownerType: 'consignment', supplierId: null, approved: true },
  { id: 'i3', model: 'G4KE', description: 'Consignment (Wu)', price: 25061.4, currency: 'USD', qty: 2, status: 'stock', ownerType: 'consignment', supplierId: null, approved: true }
]);
let posts = loadJson(POSTS_FILE, []);

const sessions = new Map();
const SESSIONS_FILE = path.join(DATA_DIR, 'auth-sessions.json');
const SESSION_MAX_AGE_SEC = 604800;

function loadSessionsFromDisk() {
  if (!fs.existsSync(SESSIONS_FILE)) return;
  try {
    const store = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    const now = Date.now();
    let changed = false;
    Object.entries(store || {}).forEach(([sid, entry]) => {
      if (!entry || entry.expiresAt <= now) {
        delete store[sid];
        changed = true;
        return;
      }
      sessions.set(sid, entry.userId);
    });
    if (changed) fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.warn('[auth] failed to load sessions:', err.message);
  }
}

function persistSessionsToDisk() {
  const now = Date.now();
  const store = {};
  sessions.forEach((userId, sid) => {
    store[sid] = { userId, expiresAt: now + SESSION_MAX_AGE_SEC * 1000 };
  });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
}

function addSession(sid, userId) {
  sessions.set(sid, userId);
  let store = {};
  if (fs.existsSync(SESSIONS_FILE)) {
    try { store = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch { store = {}; }
  }
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (!store[key] || store[key].expiresAt <= now) delete store[key];
  });
  store[sid] = { userId, expiresAt: now + SESSION_MAX_AGE_SEC * 1000 };
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
}

function removeSession(sid) {
  if (!sid) return;
  sessions.delete(sid);
  if (!fs.existsSync(SESSIONS_FILE)) return;
  try {
    const store = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    if (store[sid]) {
      delete store[sid];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
    }
  } catch {
    // ignore
  }
}

loadSessionsFromDisk();
const limitLogin = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const limitRegister = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const limitAnalytics = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
const limitContactLead = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 });
const limitRememberModel = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60 });
const REGISTRATION_ENABLED = process.env.REGISTRATION_ENABLED === '1';
const MAX_AUTH_BODY = 64 * 1024;
const MAX_API_BODY = 1024 * 1024;
const ITEM_PATCH_FIELDS = new Set([
  'model', 'description', 'price', 'currency', 'qty', 'status',
  'ownerType', 'supplierId', 'imageUrl', 'approved',
]);

const ITEM_SUPPLIER_FIELDS = ['supplierPhone', 'supplierCountryCode', 'supplierWa', 'supplierId'];

function sanitizePublicItem(item, viewer) {
  if (viewer?.role === 'admin') return item;
  const copy = { ...item };
  for (const key of ITEM_SUPPLIER_FIELDS) delete copy[key];
  return copy;
}

function sessionCookie(sid, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === '1';
  const parts = [`sid=${sid}`, 'HttpOnly', 'Path=/', 'SameSite=Lax'];
  if (maxAgeSec !== undefined) parts.push(`Max-Age=${maxAgeSec}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function requireAdmin(req, res) {
  const u = authUser(req);
  if (!u || u.role !== 'admin') {
    json(res, 401, { error: 'Admin authentication required' });
    return false;
  }
  return true;
}

const halfCut = createHalfCutApi(ROOT, {
  auth: {
    requireAdmin: (req, res) => requireAdmin(req, res),
    allowUpload: (req) => {
      const u = authUser(req);
      return !!(u && (u.role === 'admin' || u.role === 'supplier'));
    },
  },
});
halfCut.ensureDirs();

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(cookieHeader.split(';').map(v => v.trim()).filter(Boolean).map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));
}
function json(res, code, payload) {
  applySecurityHeaders(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
function readBody(req, maxBytes = MAX_AUTH_BODY) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serverError(res, err) {
  if (isProduction()) {
    console.error('[server]', err);
    return json(res, 500, { error: 'Internal server error' });
  }
  return json(res, 500, { error: err.message || 'Internal server error' });
}
function authUser(req) {
  const sid = parseCookies(req.headers.cookie).sid;
  if (!sid || !sessions.has(sid)) return null;
  const userId = sessions.get(sid);
  return users.find(u => u.id === userId) || null;
}
function requireAuth(req, res) {
  const u = authUser(req);
  if (!u) { json(res, 401, { error: 'Unauthorized' }); return null; }
  return u;
}
function id(prefix) { return `${prefix}-${crypto.randomBytes(6).toString('hex')}`; }
function waNumber(countryCode = '', phone = '') {
  const cc = String(countryCode).replace(/[^\d]/g, '');
  const p = String(phone).replace(/[^\d]/g, '').replace(/^0+/, '');
  return `${cc}${p}`;
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
  if (accept.includes('application/json')) {
    return json(res, 404, { error: 'Not found' });
  }
  res.writeHead(404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 | AsiaPower</title></head><body><h1>Page not found</h1><p><a href="/">Return to AsiaPower</a></p></body></html>');
}

function streamUploadFile(req, res, filePath, uploadObject = null, privateCache = false) {
  const mime = uploadObject?.mime || halfCut.getUploadMime(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': privateCache ? 'private, max-age=3600' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  if (uploadObject?.buffer) {
    return res.end(uploadObject.buffer);
  }
  fs.createReadStream(filePath).pipe(res);
}

async function serveStatic(req, res, pathname, search = '') {
  if (isBlockedStaticPath(pathname)) return sendNotFound(req, res);

  if (halfCut.isUploadPath(pathname)) {
    const u = authUser(req);
    const isAdmin = u?.role === 'admin';
    const isPendingUpload = String(pathname || '').startsWith('/uploads/pending/');
    if (!halfCut.canServeUpload(req, pathname, isAdmin)) {
      return sendNotFound(req, res);
    }
    const filePath = halfCut.resolveUploadFile(pathname);
    if (!filePath) {
      try {
        const uploadObject = await halfCut.readUploadObject?.(pathname);
        if (uploadObject?.buffer) return streamUploadFile(req, res, null, uploadObject, isPendingUpload);
      } catch (err) {
        console.warn('[uploads] failed to read upload object:', err.message);
      }
      return sendNotFound(req, res);
    }
    return streamUploadFile(req, res, filePath, null, isPendingUpload);
  }

  const redirectMap = {
    '/engines.html': '/engines/',
    '/gearboxes.html': '/gearboxes/',
    '/chassis-parts.html': '/chassis-parts/',
    '/half-cuts.html': '/half-cuts/',
  };
  if (redirectMap[pathname]) return redirect(res, redirectMap[pathname]);
  if (pathname === '/index.html') return redirect(res, '/');
  const indexMatch = pathname.match(/^(.+)\/index\.html$/);
  if (indexMatch) return redirect(res, `${indexMatch[1]}/`);

  let cleanPath;
  try {
    cleanPath = decodeURIComponent(pathname);
  } catch {
    return sendNotFound(req, res);
  }
  if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
  if (cleanPath.includes('\0')) return sendNotFound(req, res);

  if (cleanPath !== '/' && !path.extname(cleanPath.replace(/\/$/, ''))) {
    const basePath = cleanPath.replace(/\/$/, '') || '';
    const relBase = basePath.replace(/^\//, '');
    const dirIndex = path.join(PUBLIC_DIR, relBase, 'index.html');
    const htmlFile = path.join(PUBLIC_DIR, `${relBase}.html`);

    if (!cleanPath.endsWith('/') && dirIndex.startsWith(PUBLIC_DIR) && fs.existsSync(dirIndex)) {
      return redirect(res, `${pathname}/`);
    }
    if (htmlFile.startsWith(PUBLIC_DIR) && fs.existsSync(htmlFile) && !(dirIndex.startsWith(PUBLIC_DIR) && fs.existsSync(dirIndex))) {
      return redirect(res, `${pathname}.html`);
    }
    if (cleanPath.endsWith('/') && dirIndex.startsWith(PUBLIC_DIR) && fs.existsSync(dirIndex)) {
      cleanPath = `${basePath}/index.html`;
    }
  }

  cleanPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const candidates = [
    path.join(PUBLIC_DIR, cleanPath),
    !path.extname(cleanPath) ? path.join(PUBLIC_DIR, cleanPath, 'index.html') : null
  ].filter(Boolean);
  const finalPath = candidates.find(candidate => candidate.startsWith(PUBLIC_DIR) && fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory());
  if (!finalPath) return sendNotFound(req, res);
  const ext = path.extname(finalPath).toLowerCase();
  const mimeMap = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const isText = mime.startsWith('text/') || mime === 'application/javascript' || mime === 'application/json' || mime === 'image/svg+xml';
  const isAsset = !['.html', '.xml', '.txt', '.json'].includes(ext);
  if (ext === '.html') {
    siteAnalytics.recordPageView(req, `${pathname}${search || ''}`);
  }
  applySecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': isText ? `${mime}; charset=utf-8` : mime,
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(finalPath).pipe(res);
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
      if (req.method === 'POST' && p === '/api/leads/contact') {
        if (!limitContactLead(req)) return json(res, 429, { error: 'Too many enquiries from this connection. Please wait an hour or contact us on WhatsApp.' });
        const body = await readBody(req, MAX_AUTH_BODY);
        const spamReason = contactSpamReason(body);
        if (spamReason) return json(res, 400, { error: spamReason });
        try {
          const geo = await resolveClientGeo(req);
          const lead = contactLeads.appendContactLead(body, {
            page: body.page,
            ...geo,
          });
          notifyContactLead(lead);
          return json(res, 201, {
            ok: true,
            id: lead.id,
            email: lead.email,
            phone: lead.phone || '',
            replyChannel: lead.replyChannel,
          });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Invalid enquiry' });
        }
      }

      if (req.method === 'POST' && p === '/api/leads/half-cut') {
        if (!limitContactLead(req)) return json(res, 429, { error: 'Too many enquiries from this connection. Please wait an hour or contact us on WhatsApp.' });
        const body = await readBody(req, MAX_AUTH_BODY);
        const spamReason = halfCutSpamReason(body);
        if (spamReason) return json(res, 400, { error: spamReason });
        try {
          const geo = await resolveClientGeo(req);
          const lead = contactLeads.appendHalfCutLead(body, {
            page: body.page,
            ...geo,
          });
          notifyHalfCutLead(lead);
          return json(res, 201, { ok: true, id: lead.id, email: lead.email || '', phone: lead.phone || '' });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Invalid enquiry' });
        }
      }

      if (req.method === 'POST' && p === '/api/leads/product') {
        if (!limitContactLead(req)) return json(res, 429, { error: 'Too many enquiries from this connection. Please wait an hour or contact us on WhatsApp.' });
        const body = await readBody(req, MAX_AUTH_BODY);
        const spamReason = productSpamReason(body);
        if (spamReason) return json(res, 400, { error: spamReason });
        try {
          const geo = await resolveClientGeo(req);
          const lead = contactLeads.appendProductLead(body, {
            page: body.page,
            ...geo,
          });
          notifyProductLead(lead);
          return json(res, 201, { ok: true, id: lead.id, email: lead.email || '', phone: lead.phone || '' });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Invalid enquiry' });
        }
      }

      if (req.method === 'POST' && p === '/api/leads/whatsapp') {
        if (!limitContactLead(req)) return json(res, 429, { error: 'Too many enquiries from this connection. Please wait an hour or contact us on WhatsApp.' });
        const body = await readBody(req, MAX_AUTH_BODY);
        const spamReason = contactSpamReason(body);
        if (spamReason) return json(res, 400, { error: spamReason });
        try {
          const geo = await resolveClientGeo(req);
          const lead = contactLeads.appendGeneralWhatsappLead(body, {
            page: body.page,
            ...geo,
          });
          notifyContactLead(lead);
          return json(res, 201, { ok: true, id: lead.id, email: lead.email || '', phone: lead.phone || '' });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Invalid enquiry' });
        }
      }

      if (req.method === 'GET' && p === '/api/leads') {
        if (!requireAdmin(req, res)) return;
        return json(res, 200, { leads: contactLeads.listLeads() });
      }

      if (req.method === 'PATCH' && p.startsWith('/api/leads/')) {
        if (!requireAdmin(req, res)) return;
        const leadId = decodeURIComponent(p.slice('/api/leads/'.length));
        const body = await readBody(req, MAX_AUTH_BODY);
        try {
          const lead = contactLeads.updateLead(leadId, body);
          return json(res, 200, { ok: true, lead });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Update failed' });
        }
      }

      if (req.method === 'DELETE' && p.startsWith('/api/leads/')) {
        if (!requireAdmin(req, res)) return;
        const leadId = decodeURIComponent(p.slice('/api/leads/'.length));
        try {
          contactLeads.deleteLead(leadId);
          return json(res, 200, { ok: true });
        } catch (err) {
          const code = err.statusCode || 404;
          return json(res, code, { error: err.message || 'Delete failed' });
        }
      }

      if (req.method === 'POST' && p === '/api/analytics/event') {
        if (!limitAnalytics(req)) return json(res, 429, { error: 'Too many requests' });
        const body = await readBody(req);
        const eventType = String(body.eventType || '').trim();
        if (eventType === 'whatsapp_click') {
          siteAnalytics.recordEvent(req, eventType, body);
          notifyWhatsappClick(body);
          return json(res, 200, { ok: true });
        }
        return json(res, 400, { error: 'unsupported eventType' });
      }

      if (req.method === 'GET' && p === '/api/analytics/summary') {
        if (!requireAdmin(req, res)) return;
        const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 7)));
        const day = url.searchParams.get('day');
        if (day) return json(res, 200, siteAnalytics.getSummary({ day }));
        return json(res, 200, siteAnalytics.getSummary({ days }));
      }

      if (req.method === 'GET' && p === '/api/vehicle-catalog/learned-models') {
        return json(res, 200, { models: halfCut.modelMemory.getAll() });
      }

      if (req.method === 'GET' && p === '/api/vehicle-catalog/learned-powertrain') {
        return json(res, 200, halfCut.powertrainMemory.getAll());
      }

      if (req.method === 'POST' && p === '/api/vehicle-catalog/remember-model') {
        if (!limitRememberModel(req)) return json(res, 429, { error: 'Too many requests' });
        const body = await readBody(req, MAX_AUTH_BODY);
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
        try {
          await halfCut.handleRequest(req, res, p, json);
        } catch (err) {
          json(res, 400, { error: err.message || 'Request failed' });
        }
        return;
      }

      if (req.method === 'POST' && p === '/api/register') {
        if (!REGISTRATION_ENABLED) return json(res, 403, { error: 'Registration disabled' });
        if (!limitRegister(req)) return json(res, 429, { error: 'Too many requests' });
        const body = await readBody(req);
        const { username, password, supplierName, countryCode, phone } = body;
        if (!username || !password || !countryCode || !phone) return json(res, 400, { error: 'username/password/countryCode/phone required' });
        if (users.some(u => u.username === username)) return json(res, 409, { error: 'username exists' });
        const { salt, hash } = hashPassword(password);
        const user = {
          id: id('sup'),
          username,
          role: 'supplier',
          supplierName: supplierName || username,
          countryCode: String(countryCode).trim(),
          phone: String(phone).trim(),
          salt,
          hash
        };
        users.push(user);
        saveJson(USERS_FILE, users);
        return json(res, 201, { ok: true });
      }

      if (req.method === 'POST' && p === '/api/login') {
        if (!limitLogin(req)) return json(res, 429, { error: 'Too many requests' });
        const { username, password } = await readBody(req);
        const u = users.find(x => x.username === username);
        if (!u) return json(res, 401, { error: 'invalid credentials' });
        const test = hashPassword(password, u.salt);
        if (test.hash !== u.hash) return json(res, 401, { error: 'invalid credentials' });
        const sid = id('sess');
        addSession(sid, u.id);
        res.writeHead(200, { 'Set-Cookie': sessionCookie(sid, 604800), 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, role: u.role, supplierName: u.supplierName }));
      }

      if (req.method === 'POST' && p === '/api/logout') {
        const sid = parseCookies(req.headers.cookie).sid;
        if (sid) removeSession(sid);
        res.writeHead(200, { 'Set-Cookie': sessionCookie('', 0), 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true }));
      }

      if (req.method === 'GET' && p === '/api/me') {
        const u = authUser(req);
        return json(res, 200, { user: u ? { id: u.id, role: u.role, supplierName: u.supplierName, username: u.username } : null });
      }

      if (req.method === 'GET' && p === '/api/items') {
        const status = url.searchParams.get('status');
        const includePending = url.searchParams.get('includePending') === '1';
        const u = authUser(req);
        let out = items.slice();
        if (status) out = out.filter(i => i.status === status);
        if (includePending) {
          if (!u || u.role !== 'admin') return json(res, 403, { error: 'admin only' });
        } else {
          out = out.filter(i => i.approved);
        }
        if (u?.role === 'supplier') out = out.filter(i => i.approved || i.supplierId === u.id);
        out = out.map(i => sanitizePublicItem({
          ...i,
          originalPrice: i.price,
          originalCurrency: i.currency,
          priceUsd: Number(toUSD(i.price, i.currency).toFixed(2)),
          currency: 'USD'
        }, u));
        return json(res, 200, { items: out, fxBase: 'USD' });
      }

      if (req.method === 'GET' && p === '/api/inbound-intake') {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin') return json(res, 403, { error: 'admin only' });
        const inbound = loadJson(INBOUND_FILE, { meta: {}, rows: [] });
        return json(res, 200, inbound);
      }

      if (req.method === 'GET' && p === '/api/posts') {
        const out = posts
          .filter(post => post.published !== false)
          .slice()
          .sort((a, b) => String(b.publishedAt || b.createdAt || '').localeCompare(String(a.publishedAt || a.createdAt || '')));
        return json(res, 200, { posts: out });
      }

      if (req.method === 'POST' && p === '/api/posts') {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin') return json(res, 403, { error: 'admin only' });
        const b = await readBody(req, MAX_API_BODY);
        const title = String(b.title || '').trim();
        const excerpt = String(b.excerpt || '').trim();
        const content = String(b.content || '').trim();
        const language = String(b.language || 'zh').toLowerCase() === 'en' ? 'en' : 'zh';
        if (!title || !content) return json(res, 400, { error: 'title/content required' });
        const now = new Date().toISOString();
        const post = {
          id: id('post'),
          title,
          excerpt: excerpt || content.slice(0, 140),
          content,
          language,
          coverImageUrl: b.coverImageUrl ? String(b.coverImageUrl) : '',
          tags: Array.isArray(b.tags) ? b.tags.map(v => String(v).trim()).filter(Boolean) : [],
          author: u.supplierName || u.username || 'admin',
          published: true,
          createdAt: now,
          publishedAt: now
        };
        posts.unshift(post);
        saveJson(POSTS_FILE, posts);
        return json(res, 201, { ok: true, post });
      }

      if (req.method === 'POST' && p === '/api/items') {
        const u = requireAuth(req, res); if (!u) return;
        const b = await readBody(req, MAX_API_BODY);
        const required = ['model', 'description', 'price', 'currency', 'qty', 'status'];
        for (const k of required) if (b[k] === undefined || b[k] === '') return json(res, 400, { error: `${k} required` });
        const item = {
          id: id('item'),
          model: String(b.model),
          description: String(b.description),
          price: Number(b.price),
          currency: String(b.currency || 'USD').toUpperCase(),
          qty: Number(b.qty),
          status: b.status === 'transit' ? 'transit' : 'stock',
          ownerType: b.ownerType || (u.role === 'supplier' ? 'supplier' : 'self'),
          supplierId: u.role === 'supplier' ? u.id : (b.supplierId || null),
          supplierPhone: u.role === 'supplier' ? (u.phone || '') : '',
          supplierCountryCode: u.role === 'supplier' ? (u.countryCode || '') : '',
          supplierWa: u.role === 'supplier' ? waNumber(u.countryCode, u.phone) : '',
          imageUrl: b.imageUrl ? String(b.imageUrl) : '',
          createdAt: new Date().toISOString(),
          approved: u.role === 'admin'
        };
        items.unshift(item);
        saveJson(ITEMS_FILE, items);
        return json(res, 201, { ok: true, item });
      }

      if (req.method === 'PATCH' && p.startsWith('/api/items/')) {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin') return json(res, 403, { error: 'admin only' });
        const itemId = p.split('/').pop();
        const b = await readBody(req, MAX_API_BODY);
        const idx = items.findIndex(i => i.id === itemId);
        if (idx < 0) return json(res, 404, { error: 'not found' });
        const patch = {};
        Object.entries(b || {}).forEach(([key, value]) => {
          if (ITEM_PATCH_FIELDS.has(key)) patch[key] = value;
        });
        items[idx] = { ...items[idx], ...patch };
        saveJson(ITEMS_FILE, items);
        return json(res, 200, { ok: true, item: items[idx] });
      }

      if (req.method === 'GET' && p === '/api/pending') {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin') return json(res, 403, { error: 'admin only' });
        const out = items.filter(i => !i.approved).map(i => {
          if (i.supplierWa) return i;
          const su = users.find(x => x.id === i.supplierId);
          if (!su) return i;
          return {
            ...i,
            supplierPhone: su.phone || '',
            supplierCountryCode: su.countryCode || '',
            supplierWa: waNumber(su.countryCode, su.phone)
          };
        });
        return json(res, 200, { items: out });
      }

      if (req.method === 'POST' && p.startsWith('/api/pending/') && p.endsWith('/approve')) {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin') return json(res, 403, { error: 'admin only' });
        const idv = p.split('/')[3];
        const it = items.find(i => i.id === idv);
        if (!it) return json(res, 404, { error: 'not found' });
        it.approved = true;
        saveJson(ITEMS_FILE, items);
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: 'api not found' });
    } catch (e) {
      if (e.message === 'Request body too large') return json(res, 413, { error: e.message });
      return serverError(res, e);
    }
  }

  if (req.method === 'GET' && p === '/half-cuts/detail.html') {
    const slug = url.searchParams.get('slug');
    if (slug) {
      try {
        const catalog = await halfCut.getPublicCatalog();
        const siteUrl = process.env.SITE_URL || 'https://asia-power.com';
        const rendered = renderHalfCutDetailPage({
          publicDir: PUBLIC_DIR,
          slug,
          catalog,
          siteUrl,
        });
        if (rendered?.html) {
          siteAnalytics.recordPageView(req, `${p}${url.search || ''}`);
          return sendPrerenderedHtml(res, rendered.html, rendered.redirectSlug);
        }
      } catch (err) {
        console.error('[prerender]', err);
      }
    }
  }

  if (req.method === 'GET' && p === '/sitemap.xml') {
    try {
      const catalog = await halfCut.getPublicCatalog();
      const xml = buildSitemapXml({
        siteUrl: process.env.SITE_URL || 'https://asia-power.com',
        publicDir: PUBLIC_DIR,
        approved: catalog.approved || [],
      });
      return sendSitemap(res, xml);
    } catch (err) {
      return serverError(res, err);
    }
  }

  return await serveStatic(req, res, p, url.search || '');
});

server.listen(PORT, BIND_HOST, () => {
  console.log(`Inventory site running on http://${BIND_HOST}:${PORT}`);
  console.log(`Half-cut uploads: ${halfCut.UPLOADS_DIR}`);
  console.log(`Half-cut state: ${halfCut.DATA_DIR}`);
});
