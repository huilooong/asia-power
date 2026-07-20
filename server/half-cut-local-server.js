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
const { createVinDecodeHandler } = require('./lib/vin/decode-route');
const { loadEnv } = require('./lib/load-env');
const { createWhatsAppCloudWebhook } = require('./lib/whatsapp-cloud-webhook');
const { createTelegramQuoteWebhook } = require('./lib/whatsapp-cloud-telegram-quote');
const { buildSitemapXml, sendSitemap } = require('./lib/sitemap');

const ROOT = path.join(__dirname, '..');
loadEnv(ROOT);
const PUBLIC_DIR = ROOT;
const PORT = Number(process.env.PORT) || 8787;
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

const limitLogin = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const limitContactLead = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 });
const limitRememberModel = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60 });
const contactLeads = createContactLeadStore(path.join(ROOT, 'data', 'contact-leads.json'));
const handleVinDecode = createVinDecodeHandler(ROOT);
const handleWhatsAppCloudWebhook = createWhatsAppCloudWebhook(ROOT);
const handleTelegramQuoteWebhook = createTelegramQuoteWebhook(ROOT);

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
    authUser: (req) => auth.authUser(req),
  },
});
halfCut.ensureDirs();

const { createPhoneOtpAuth } = require('./lib/phone-otp-auth');
const { createPhonePasswordAuth } = require('./lib/phone-password-auth');
const { createOrderStore } = require('./lib/buyer-orders');
const { createStripeDeposit } = require('./lib/stripe-deposit');
const { createOAuthAuth } = require('./lib/oauth-auth');
const crypto = require('crypto');

const DATA_DIR = path.join(ROOT, 'data');
const orderStore = createOrderStore(DATA_DIR);
const limitOtpSend = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });
const limitOtpVerify = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 });
const limitPasswordAuth = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const limitPasswordRegister = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 15 });

function localId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

const phoneOtp = createPhoneOtpAuth({
  dataDir: DATA_DIR,
  json,
  sessionCookie: auth.sessionCookie,
  addSession: auth.addSession,
  getUsers: () => auth.getUsers(),
  setUsers: (next) => auth.setUsers(next),
  saveUsers: () => auth.saveUsers(),
  id: localId,
  limitSend: (req) => limitOtpSend(req),
  limitVerify: (req) => limitOtpVerify(req),
});

const phonePassword = createPhonePasswordAuth({
  dataDir: DATA_DIR,
  json,
  sessionCookie: auth.sessionCookie,
  addSession: auth.addSession,
  getUsers: () => auth.getUsers(),
  setUsers: (next) => auth.setUsers(next),
  saveUsers: () => auth.saveUsers(),
  id: localId,
  findUserByPhone: (phoneNorm, role) => phoneOtp.findUserByPhone(phoneNorm, role),
  consumeOtpChallenge: (phoneNorm, code, role) => phoneOtp.consumeOtpChallenge(phoneNorm, code, role),
  issueSession: (res, user) => phoneOtp.issueSession(res, user),
  ensureBuyerUser: (opts) => phoneOtp.ensureBuyerUser(opts),
  ensureSupplierUser: (opts) => phoneOtp.ensureSupplierUser(opts),
  buyerStore: phoneOtp.buyerStore,
  limitLogin: (req) => limitPasswordAuth(req),
  limitRegister: (req) => limitPasswordRegister(req),
});

const stripeDeposit = createStripeDeposit({
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`,
  orderStore,
  onDepositPaid: async (order) => {
    try {
      halfCut.reserveApprovedStock(order.stockId, {
        orderId: order.id,
        reason: 'stripe_deposit',
      });
    } catch (err) {
      console.error('[deposit] reserve failed:', err.message);
    }
  },
});

const oauthAuth = createOAuthAuth({
  dataDir: DATA_DIR,
  json,
  sessionCookie: auth.sessionCookie,
  addSession: auth.addSession,
  getUsers: () => auth.getUsers(),
  setUsers: (next) => auth.setUsers(next),
  saveUsers: () => auth.saveUsers(),
  id: localId,
});

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
    '.txt': 'text/plain',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
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
  if (pathname === '/half-cuts/' || pathname === '/half-cuts') {
    try {
      const cat = new URL(req.url || '', 'http://localhost').searchParams.get('cat');
      if (cat === 'machinery') return redirect(res, '/machinery/');
    } catch {
      // ignore
    }
  }

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
      if (req.method === 'GET' && p === '/api/me') {
        const u = auth.authUser(req);
        if (!u) return json(res, 200, { user: null });
        if (u.role === 'supplier') {
          const fresh = auth.getUsers().find((x) => x.id === u.id) || u;
          return json(res, 200, {
            user: phoneOtp.publicSupplierProfile(fresh),
            needsProfile: !phoneOtp.isProfileComplete(fresh),
          });
        }
        if (u.role === 'buyer') {
          const fresh = auth.getUsers().find((x) => x.id === u.id) || u;
          return json(res, 200, {
            user: phoneOtp.buyerStore.publicBuyer(fresh),
          });
        }
        return json(res, 200, {
          user: {
            id: u.id,
            role: u.role,
            supplierName: u.supplierName,
            username: u.username,
            phone: u.phone || '',
            phoneNormalized: u.phoneNormalized || '',
            email: u.email || '',
            profileComplete: true,
            missingFields: [],
          },
        });
      }

      if (await auth.handleAuthRoutes(req, res, p, readBody)) return;
      if (await phoneOtp.handleOtpRoutes(req, res, p, readBody)) return;
      if (await phonePassword.handlePasswordRoutes(req, res, p, readBody)) return;
      if (await oauthAuth.handleOAuthRoutes(req, res, p, url, readBody)) return;

      if (req.method === 'GET' && p === '/api/admin/buyers') {
        if (!auth.requireAdmin(req, res)) return;
        return json(res, 200, {
          buyers: phoneOtp.buyerStore.listBuyers(auth.getUsers()),
          recentLogins: phoneOtp.buyerStore.readRecentEvents(50),
        });
      }

      if (req.method === 'GET' && p === '/api/supplier/profile') {
        const u = auth.requireAuth(req, res); if (!u) return;
        if (u.role !== 'supplier' && u.role !== 'admin') return json(res, 403, { error: 'Supplier only' });
        return json(res, 200, {
          profile: phoneOtp.publicSupplierProfile(u),
          needsProfile: !phoneOtp.isProfileComplete(u),
        });
      }

      if (req.method === 'PUT' && p === '/api/supplier/profile') {
        const u = auth.requireAuth(req, res); if (!u) return;
        if (u.role !== 'supplier') return json(res, 403, { error: 'Supplier only' });
        try {
          const body = await readBody(req);
          const next = phoneOtp.updateSupplierProfile(u.id, body);
          return json(res, 200, {
            ok: true,
            profile: phoneOtp.publicSupplierProfile(next),
            needsProfile: !phoneOtp.isProfileComplete(next),
          });
        } catch (err) {
          return json(res, err.statusCode || 400, {
            error: err.message || 'Profile update failed',
            missingFields: err.missingFields || undefined,
          });
        }
      }

      if (req.method === 'GET' && p === '/api/buyer/orders') {
        const u = auth.requireAuth(req, res); if (!u) return;
        if (u.role === 'admin') return json(res, 200, { orders: orderStore.listAll() });
        if (u.role !== 'buyer') return json(res, 403, { error: 'Buyer authentication required' });
        return json(res, 200, { orders: orderStore.listForBuyer(u.id) });
      }
      if (req.method === 'POST' && p === '/api/buyer/orders') {
        const u = auth.requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin' && u.role !== 'buyer') return json(res, 403, { error: 'Forbidden' });
        try {
          const body = await readBody(req);
          const buyerId = u.role === 'admin' ? String(body.buyerId || u.id) : u.id;
          const order = orderStore.createOrder({ ...body, buyerId });
          return json(res, 201, { ok: true, order });
        } catch (err) {
          return json(res, 400, { error: err.message || 'Create order failed' });
        }
      }
      if (req.method === 'POST' && p === '/api/buyer/orders/deposit-session') {
        const u = auth.requireAuth(req, res); if (!u) return;
        try {
          const body = await readBody(req);
          const order = orderStore.getById(String(body.orderId || ''));
          if (!order) return json(res, 404, { error: 'Order not found' });
          if (u.role !== 'admin' && order.buyerId !== u.id) return json(res, 403, { error: 'Forbidden' });
          if (body.termsAccepted) {
            orderStore.updateOrder(order.id, { termsAcceptedAt: new Date().toISOString() });
          }
          const session = await stripeDeposit.createCheckoutSession(order, {
            buyerEmail: u.email || body.email,
          });
          return json(res, 200, { ok: true, session });
        } catch (err) {
          return json(res, 400, { error: err.message || 'Checkout failed' });
        }
      }
      if (req.method === 'POST' && p === '/api/buyer/orders/demo-complete') {
        const u = auth.requireAuth(req, res); if (!u) return;
        try {
          const body = await readBody(req);
          const order = orderStore.getById(String(body.orderId || ''));
          if (!order) return json(res, 404, { error: 'Order not found' });
          if (u.role !== 'admin' && order.buyerId !== u.id) return json(res, 403, { error: 'Forbidden' });
          const paid = await stripeDeposit.completeDemoPayment(order.id);
          return json(res, 200, { ok: true, order: paid });
        } catch (err) {
          return json(res, 400, { error: err.message || 'Demo complete failed' });
        }
      }
      if (req.method === 'POST' && p === '/api/stripe/webhook') {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8');
          const result = await stripeDeposit.handleWebhook(raw, req.headers['stripe-signature']);
          return json(res, 200, result);
        } catch (err) {
          return json(res, 400, { error: err.message || 'Webhook failed' });
        }
      }

      if (p === '/api/whatsapp/webhook') {
        await handleWhatsAppCloudWebhook(req, res, url, json);
        return;
      }
      if (p === '/api/telegram/whatsapp-quote') {
        await handleTelegramQuoteWebhook(req, res, url, json);
        return;
      }
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
      if (req.method === 'GET' && p === '/api/vehicle-catalog/learned-powertrain') {
        return json(res, 200, halfCut.powertrainMemory.getAll());
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
      if (req.method === 'POST' && p === '/api/vin/decode') {
        try {
          await handleVinDecode(req, res, json);
        } catch (err) {
          json(res, 200, { ok: false, reason: 'qxb_unavailable', message: err.message });
        }
        return;
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

  if ((req.method === 'GET' || req.method === 'HEAD') && p === '/sitemap.xml') {
    try {
      const catalog = await halfCut.getPublicCatalog();
      const xml = buildSitemapXml({
        siteUrl: process.env.SITE_URL || 'https://asia-power.com',
        publicDir: PUBLIC_DIR,
        approved: catalog.approved || [],
      });
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end();
      }
      return sendSitemap(res, xml);
    } catch (err) {
      return json(res, 500, { error: err.message || 'Sitemap generation failed' });
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
