const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 8080;
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
const halfCutNotificationsPath = [
  path.join(__dirname, 'lib', 'half-cut-notifications.js'),
  path.join(__dirname, '..', 'server', 'lib', 'half-cut-notifications.js'),
].find((candidate) => fs.existsSync(candidate));
const { notifyWhatsappClick } = halfCutNotificationsPath
  ? require(halfCutNotificationsPath)
  : { notifyWhatsappClick: () => {} };
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const halfCut = createHalfCutApi(ROOT);
halfCut.ensureDirs();
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const INBOUND_FILE = path.join(DATA_DIR, 'inbound-intake.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

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
  const defaultPass = process.env.ADMIN_PASSWORD || 'admin1234';
  const { salt, hash } = hashPassword(defaultPass);
  users[0].salt = salt;
  users[0].hash = hash;
  saveJson(USERS_FILE, users);
  console.log(`[init] admin login: admin / ${defaultPass}`);
}

let items = loadJson(ITEMS_FILE, [
  { id: 'i1', model: '1ZR', description: 'In transit batch A', price: 21000, currency: 'GHS', qty: 4, status: 'transit', ownerType: 'self', supplierId: null, approved: true },
  { id: 'i2', model: '2AZ 4-speed', description: 'Consignment (Wu)', price: 15716.025, currency: 'USD', qty: 3, status: 'stock', ownerType: 'consignment', supplierId: null, approved: true },
  { id: 'i3', model: 'G4KE', description: 'Consignment (Wu)', price: 25061.4, currency: 'USD', qty: 2, status: 'stock', ownerType: 'consignment', supplierId: null, approved: true }
]);
let posts = loadJson(POSTS_FILE, []);

const sessions = new Map();

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(cookieHeader.split(';').map(v => v.trim()).filter(Boolean).map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));
}
function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
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

function streamUploadFile(req, res, filePath) {
  const mime = halfCut.getUploadMime(filePath);
  const isAsset = true;
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': isAsset ? 'public, max-age=86400' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(req, res, pathname) {
  if (halfCut.isUploadPath(pathname)) {
    const filePath = halfCut.resolveUploadFile(pathname);
    if (!filePath) return sendNotFound(req, res);
    return streamUploadFile(req, res, filePath);
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
    try {
      if (req.method === 'POST' && p === '/api/analytics/event') {
        const body = await readBody(req);
        const eventType = String(body.eventType || '').trim();
        if (eventType === 'whatsapp_click') {
          notifyWhatsappClick(body);
          return json(res, 200, { ok: true });
        }
        return json(res, 400, { error: 'unsupported eventType' });
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
        const { username, password } = await readBody(req);
        const u = users.find(x => x.username === username);
        if (!u) return json(res, 401, { error: 'invalid credentials' });
        const test = hashPassword(password, u.salt);
        if (test.hash !== u.hash) return json(res, 401, { error: 'invalid credentials' });
        const sid = id('sess');
        sessions.set(sid, u.id);
        res.writeHead(200, { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; Max-Age=604800`, 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, role: u.role, supplierName: u.supplierName }));
      }

      if (req.method === 'POST' && p === '/api/logout') {
        const sid = parseCookies(req.headers.cookie).sid;
        if (sid) sessions.delete(sid);
        res.writeHead(200, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0', 'Content-Type': 'application/json; charset=utf-8' });
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
        if (!includePending) out = out.filter(i => i.approved);
        if (u?.role === 'supplier') out = out.filter(i => i.approved || i.supplierId === u.id);
        out = out.map(i => ({
          ...i,
          originalPrice: i.price,
          originalCurrency: i.currency,
          priceUsd: Number(toUSD(i.price, i.currency).toFixed(2)),
          currency: 'USD'
        }));
        return json(res, 200, { items: out, fxBase: 'USD' });
      }

      if (req.method === 'GET' && p === '/api/inbound-intake') {
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
        const b = await readBody(req);
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
        const b = await readBody(req);
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
        const b = await readBody(req);
        const idx = items.findIndex(i => i.id === itemId);
        if (idx < 0) return json(res, 404, { error: 'not found' });
        items[idx] = { ...items[idx], ...b };
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
      return json(res, 500, { error: e.message });
    }
  }

  return serveStatic(req, res, p);
});

server.listen(PORT, () => {
  console.log(`Inventory site running on http://localhost:${PORT}`);
  console.log(`Half-cut uploads: ${halfCut.UPLOADS_DIR}`);
  console.log(`Half-cut state: ${halfCut.DATA_DIR}`);
});
