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
const whatsappCloudWebhookPath = [
  path.join(__dirname, 'lib', 'whatsapp-cloud-webhook.js'),
  path.join(__dirname, '..', 'server', 'lib', 'whatsapp-cloud-webhook.js'),
].find((candidate) => fs.existsSync(candidate));
const { createWhatsAppCloudWebhook } = whatsappCloudWebhookPath
  ? require(whatsappCloudWebhookPath)
  : { createWhatsAppCloudWebhook: () => null };

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
const emailProxyPath = [
  path.join(__dirname, 'lib', 'email-proxy.js'),
  path.join(__dirname, '..', 'server', 'lib', 'email-proxy.js'),
].find((candidate) => fs.existsSync(candidate));
const { createEmailProxyStore } = emailProxyPath
  ? require(emailProxyPath)
  : { createEmailProxyStore: () => null };
const emailOutboundPath = [
  path.join(__dirname, 'lib', 'email-outbound.js'),
  path.join(__dirname, '..', 'server', 'lib', 'email-outbound.js'),
].find((candidate) => fs.existsSync(candidate));
const { createEmailOutbound } = emailOutboundPath
  ? require(emailOutboundPath)
  : { createEmailOutbound: () => null };
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
const cifShippingPath = [
  path.join(__dirname, 'lib', 'cif-shipping.js'),
  path.join(__dirname, '..', 'server', 'lib', 'cif-shipping.js'),
].find((candidate) => fs.existsSync(candidate));
const cifShipping = require(cifShippingPath || path.join(__dirname, '..', 'server', 'lib', 'cif-shipping.js'));
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
const halfCutListPrerenderPath = [
  path.join(__dirname, 'lib', 'half-cut-list-prerender.js'),
  path.join(__dirname, '..', 'server', 'lib', 'half-cut-list-prerender.js'),
].find((candidate) => fs.existsSync(candidate));
const { renderHalfCutListPage, renderCatalogListPage, sendListPrerenderHtml } = require(
  halfCutListPrerenderPath || path.join(__dirname, '..', 'server', 'lib', 'half-cut-list-prerender.js')
);
const CATALOG_LIST_ROUTES = {
  '/half-cuts/': 'halfcuts',
  '/half-cuts/index.html': 'halfcuts',
  '/trucks/': 'trucks',
  '/trucks/index.html': 'trucks',
  '/machinery/': 'machinery',
  '/machinery/index.html': 'machinery',
  '/engines/': 'engines',
  '/engines/index.html': 'engines',
  '/gearboxes/': 'gearboxes',
  '/gearboxes/index.html': 'gearboxes',
};
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const INBOUND_FILE = path.join(DATA_DIR, 'inbound-intake.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const CONTACT_LEADS_FILE = path.join(DATA_DIR, 'contact-leads.json');
const contactLeads = createContactLeadStore(CONTACT_LEADS_FILE);
const emailProxy = createEmailProxyStore
  ? createEmailProxyStore({ root: ROOT, dataDir: DATA_DIR })
  : null;
const emailOutbound = emailProxy && createEmailOutbound
  ? createEmailOutbound(emailProxy)
  : null;
const siteAnalytics = createSiteAnalytics(DATA_DIR);
const handleWhatsAppCloudWebhook = createWhatsAppCloudWebhook
  ? createWhatsAppCloudWebhook(ROOT)
  : null;

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

function requireAdminOrZijingLiveToken(req, res, url) {
  const u = authUser(req);
  if (u && u.role === 'admin') return true;
  const token = String(url.searchParams.get('token') || '').trim();
  const expected = String(process.env.APSALES_ZIJING_LIVE_TOKEN || '').trim();
  if (expected && token && token === expected) return true;
  json(res, 401, { error: 'Admin authentication or valid APSALES_ZIJING_LIVE_TOKEN required' });
  return false;
}

const halfCut = createHalfCutApi(ROOT, {
  auth: {
    requireAdmin: (req, res) => requireAdmin(req, res),
    allowUpload: (req) => {
      const u = authUser(req);
      return !!(u && (u.role === 'admin' || u.role === 'supplier'));
    },
    authUser: (req) => authUser(req),
  },
});
halfCut.ensureDirs();

const { createPhoneOtpAuth } = require(
  [path.join(__dirname, 'lib', 'phone-otp-auth.js'), path.join(__dirname, '..', 'server', 'lib', 'phone-otp-auth.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'phone-otp-auth.js')
);
const { createOrderStore } = require(
  [path.join(__dirname, 'lib', 'buyer-orders.js'), path.join(__dirname, '..', 'server', 'lib', 'buyer-orders.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'buyer-orders.js')
);
const { createStripeDeposit } = require(
  [path.join(__dirname, 'lib', 'stripe-deposit.js'), path.join(__dirname, '..', 'server', 'lib', 'stripe-deposit.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'stripe-deposit.js')
);
const { createOAuthAuth } = require(
  [path.join(__dirname, 'lib', 'oauth-auth.js'), path.join(__dirname, '..', 'server', 'lib', 'oauth-auth.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'oauth-auth.js')
);
const { createPhonePasswordAuth } = require(
  [path.join(__dirname, 'lib', 'phone-password-auth.js'), path.join(__dirname, '..', 'server', 'lib', 'phone-password-auth.js')]
    .find((candidate) => fs.existsSync(candidate)) || path.join(__dirname, '..', 'server', 'lib', 'phone-password-auth.js')
);

const orderStore = createOrderStore(DATA_DIR);
const limitOtpSend = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 });
const limitOtpVerify = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const limitPasswordAuth = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 25 });
const limitPasswordRegister = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 });

const phoneOtp = createPhoneOtpAuth({
  dataDir: DATA_DIR,
  json: (res, code, payload) => json(res, code, payload),
  sessionCookie,
  addSession,
  getUsers: () => users,
  setUsers: (next) => { users = next; },
  saveUsers: () => saveJson(USERS_FILE, users),
  id,
  limitSend: (req) => limitOtpSend(req),
  limitVerify: (req) => limitOtpVerify(req),
});

const phonePassword = createPhonePasswordAuth({
  dataDir: DATA_DIR,
  json: (res, code, payload) => json(res, code, payload),
  sessionCookie,
  addSession,
  getUsers: () => users,
  setUsers: (next) => { users = next; },
  saveUsers: () => saveJson(USERS_FILE, users),
  id,
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
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://asia-power.com',
  orderStore,
  onDepositPaid: async (order) => {
    try {
      halfCut.reserveApprovedStock(order.stockId, {
        orderId: order.id,
        reason: 'stripe_deposit',
      });
      console.log('[deposit] reserved stock', order.stockId, 'for', order.id);
    } catch (err) {
      console.error('[deposit] reserve failed:', err.message);
    }
  },
});

const oauthAuth = createOAuthAuth({
  dataDir: DATA_DIR,
  json: (res, code, payload) => json(res, code, payload),
  sessionCookie,
  addSession,
  getUsers: () => users,
  setUsers: (next) => { users = next; },
  saveUsers: () => saveJson(USERS_FILE, users),
  id,
});

const vinDecodeRoutePath = [
  path.join(__dirname, 'lib', 'vin', 'decode-route.js'),
  path.join(__dirname, '..', 'server', 'lib', 'vin', 'decode-route.js'),
].find((candidate) => fs.existsSync(candidate));
const handleVinDecode = vinDecodeRoutePath
  ? require(vinDecodeRoutePath).createVinDecodeHandler(ROOT)
  : null;

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

const APSALES_ACTION_LABELS = {
  group_join: '加入小组',
  post_published: '发布帖文',
  post_pending: '社媒受阻（无账号）',
  post_blocked: '社媒受阻（无账号）',
  reply_found: '客户回复',
  followup_drafted: '跟进草稿',
  scan_done: '回复扫描',
  email_received: '收到邮件',
  email_sent: '邮件已发送',
};

const APSALES_SOCIAL_BLOCKED = new Set([
  'blocked_no_account',
  'pending_ceo_manual',
  'approved_pending_publish',
]);

function apsalesIsSocialBlocked(status) {
  return APSALES_SOCIAL_BLOCKED.has(String(status || '').toLowerCase());
}

function apsalesSocialSessionStatus(asiaRoot) {
  const root = asiaRoot || process.env.ASIAPOWER_ROOT || path.join(ROOT, '..', 'AsiaPower');
  const sessionsDir = path.join(root, 'memory', 'customer_gateway', 'social_sessions');
  const platforms = ['facebook', 'instagram', 'x'];
  const labels = { facebook: 'Facebook', instagram: 'Instagram', x: 'X' };
  const apiReady = {
    facebook: Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ID),
    instagram: Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_IG_USER_ID),
    x: Boolean(process.env.X_API_BEARER_TOKEN),
  };
  const out = { updated_at: new Date().toISOString(), any_ready: false, platforms: {} };
  for (const key of platforms) {
    let connected = apiReady[key];
    let method = connected ? 'api' : '';
    let accountLabel = '';
    let loggedInAt = null;
    const stateFile = path.join(sessionsDir, key, 'session_state.json');
    const browserDir = path.join(sessionsDir, key, 'browser_data');
    if (!connected && fs.existsSync(stateFile)) {
      try {
        const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        connected = Boolean(st.connected) && fs.existsSync(browserDir);
        method = connected ? (st.method || 'browser') : '';
        accountLabel = st.account_label || '';
        loggedInAt = st.logged_in_at || null;
      } catch { /* ignore */ }
    }
    if (connected) out.any_ready = true;
    out.platforms[key] = {
      platform: key,
      label: labels[key],
      logged_in: connected,
      status: connected ? 'ready' : 'needs_login',
      status_label: connected ? '✅ 已登录' : '❌ 需子敬登录一次',
      method,
      account_label: accountLabel,
      logged_in_at: loggedInAt,
      api_configured: apiReady[key],
    };
  }
  return out;
}

function apsalesZijingActivityEnhance(asiaRoot, payload) {
  const root = asiaRoot || process.env.ASIAPOWER_ROOT || path.join(ROOT, '..', 'AsiaPower');
  const mem = path.join(root, 'memory', 'customer_gateway');
  const streamFile = path.join(mem, 'zijing_activity_stream.jsonl');
  const currentFile = path.join(mem, 'zijing_current_action.json');
  const out = { ...payload };

  const parseTs = (value) => {
    const text = String(value || '').trim().replace(' UTC', '').replace('Z', '');
    if (!text) return null;
    const iso = text.includes('T') ? `${text}Z` : `${text.replace(' ', 'T')}Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  };

  const actionLabels = {
    idle: '空闲',
    accept_friends: '通过好友请求',
    browse_feed: '浏览好友动态',
    friend_dm: '发送好友私信',
    timeline_post: '时间线发帖',
    autopilot: 'Autopilot 自动运行',
    engage: '互动队列执行',
    alternate_run: 'FB↔X 交替运行',
    scan_replies: '扫描回复',
    publish: '发布队列帖文',
    daily_run: 'Facebook 每日一体运行',
  };

  const formatLabel = (row) => {
    if (!row) return '空闲 · 等待下一趟任务';
    const label = actionLabels[row.action] || row.action || '—';
    const parts = [label];
    if (row.platform) {
      const tag = row.platform === 'fb+x' ? 'FB↔X' : row.platform;
      parts.push(`[${tag}]`);
    }
    if (row.detail) parts.push(row.detail);
    return parts.join(' · ');
  };

  let stream = [];
  if (fs.existsSync(streamFile)) {
    try {
      const lines = fs.readFileSync(streamFile, 'utf8').split('\n').filter((l) => l.trim());
      stream = lines.slice(-50).reverse().map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    } catch { /* ignore */ }
  }

  let current = null;
  const now = Date.now();
  if (fs.existsSync(currentFile)) {
    try {
      current = JSON.parse(fs.readFileSync(currentFile, 'utf8'));
    } catch { /* ignore */ }
  }
  if (!current) {
    current = stream.find((row) => {
      if (row.status !== 'running') return false;
      const ts = parseTs(row.ts);
      return ts != null && (now - ts) <= 5000;
    }) || null;
  }

  const cutoff = now - 60000;
  let epm = 0;
  for (const row of stream) {
    const ts = parseTs(row.ts);
    if (ts == null || ts < cutoff) break;
    if (row.action !== 'idle') epm += 1;
  }

  out.activity_stream = stream.length ? stream : (out.activity_stream || []);
  out.current_action = current ? {
    label: formatLabel(current),
    action: current.action || 'idle',
    detail: current.detail || '',
    platform: current.platform || '',
    status: current.status || 'idle',
    ts: current.ts || '',
  } : (() => {
    const latestIdle = stream.find((r) => r.action === 'idle');
    if (latestIdle) {
      return {
        label: formatLabel(latestIdle),
        action: 'idle',
        detail: latestIdle.detail || '',
        platform: '',
        status: 'idle',
        ts: latestIdle.ts || '',
      };
    }
    return out.current_action || { label: '空闲 · 等待下一趟任务', action: 'idle', status: 'idle' };
  })();
  out.events_per_minute = epm || out.events_per_minute || 0;
  return out;
}

function apsalesZijingLiveStatusFallback(asiaRoot) {
  const root = asiaRoot || process.env.ASIAPOWER_ROOT || path.join(ROOT, '..', 'AsiaPower');
  const mem = path.join(root, 'memory', 'customer_gateway');
  const readJson = (file, fallback) => {
    const fp = path.join(mem, file);
    if (!fs.existsSync(fp)) return fallback;
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return fallback; }
  };
  const sessions = apsalesSocialSessionStatus(root);
  const queue = readJson('apsales_social_engagement_queue.json', []);
  const totals = { pending: 0, completed: 0, failed: 0 };
  const byPlatform = {};
  for (const key of ['facebook', 'x', 'instagram']) {
    byPlatform[key] = { pending: 0, completed: 0, failed: 0 };
  }
  if (Array.isArray(queue)) {
    for (const item of queue) {
      if (!item || typeof item !== 'object') continue;
      const st = ['pending', 'completed', 'failed'].includes(item.status) ? item.status : 'pending';
      totals[st] += 1;
      const plat = String(item.platform || 'facebook').toLowerCase();
      if (!byPlatform[plat]) byPlatform[plat] = { pending: 0, completed: 0, failed: 0 };
      byPlatform[plat][st] += 1;
    }
  }
  const browseState = readJson('social_browse_state.json', {});
  let totalNotes = 0;
  const notesFile = path.join(mem, 'social_research_notes.jsonl');
  if (fs.existsSync(notesFile)) {
    try {
      totalNotes = fs.readFileSync(notesFile, 'utf8').split('\n').filter((l) => l.trim()).length;
    } catch { /* ignore */ }
  }
  const now = new Date();
  const minute = now.getUTCMinutes();
  let nextAutopilot;
  if (minute < 30) {
    nextAutopilot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 30, 0));
  } else {
    nextAutopilot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0));
  }
  const nextReply = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0));
  const fmt = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  const login = {};
  for (const key of ['facebook', 'x', 'instagram']) {
    const st = sessions.platforms[key] || {};
    login[key] = {
      label: st.label || key,
      logged_in: Boolean(st.logged_in),
      method: st.method || '',
      account_label: st.account_label || '',
    };
  }
  const progress = readJson('apsales_distribution_progress.json', {});
  const platformLimits = readJson('fb_platform_limits.json', {});
  const policyPath = path.join(root, 'config', 'apsales_social_engagement_policy.yaml');
  let platformProbeMode = false;
  let operatingMode = { mode: 'normal', mode_label: '正常 · FB+X' };
  try {
    if (fs.existsSync(policyPath)) {
      const polText = fs.readFileSync(policyPath, 'utf8');
      platformProbeMode = /stop_condition:\s*platform_block_only/.test(polText);
    }
  } catch { /* ignore */ }
  const pausedUntil = platformLimits.paused_until || {};
  const activePauses = {};
  const nowMs = Date.now();
  for (const [action, untilStr] of Object.entries(pausedUntil)) {
    const ms = Date.parse(String(untilStr).replace(' UTC', 'Z').replace(' ', 'T'));
    if (!Number.isNaN(ms) && ms > nowMs) activePauses[action] = untilStr;
  }
  if (Object.keys(activePauses).length) {
    operatingMode = {
      mode: 'limited',
      mode_label: '限流 · Maps+邮件',
      reason: `platform_block:${Object.keys(activePauses).sort().join(',')}`,
      active_pauses: activePauses,
      last_block: platformLimits.last_block || null,
    };
  }
  return {
    updated_at: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    dashboard_url: 'https://asia-power.com/admin/apsales-zijing-live.html',
    platform_probe_mode: platformProbeMode,
    operating_mode: operatingMode,
    platform_limits: {
      last_block: platformLimits.last_block || null,
      active_pauses: platformLimits.paused_until || {},
      updated_at: platformLimits.updated_at || null,
    },
    login,
    any_session_ready: Boolean(sessions.any_ready),
    queue: {
      date: now.toISOString().slice(0, 10),
      planned_at: '—',
      totals,
      by_platform: byPlatform,
      instagram_status: 'paused_today',
    },
    browse: {
      last_session_at: browseState.last_session_at ? String(browseState.last_session_at).slice(0, 16) : '—',
      last_duration_minutes: browseState.duration_minutes || null,
      last_notes_saved: browseState.notes_saved || 0,
      total_notes: totalNotes,
      enabled: null,
      in_browse_hours: null,
    },
    last_actions: [],
    active_hours: {
      start: '08:00',
      end: '20:00',
      timezone_note: 'UTC 工作时段',
      in_active_hours: null,
      label: '—',
    },
    cron: [
      { label: 'Autopilot（发帖+互动）', next: `${fmt(nextAutopilot)} · 每 30 分钟` },
      { label: '回复扫描提醒', next: `${fmt(nextReply)} · 每小时整点` },
    ],
    waiting_reasons: [],
    reply_watch: readJson('social_reply_watch_state.json', {}),
    progress: progress.updated_at ? {
      last_verified_action_at: String(progress.last_verified_action_at || '—').slice(0, 16),
      updated_at: String(progress.updated_at || '—').slice(0, 16),
    } : {},
    _source: 'js_fallback',
  };
}

function apsalesZijingLiveStatus(asiaRoot) {
  const root = asiaRoot || process.env.ASIAPOWER_ROOT || path.join(ROOT, '..', 'AsiaPower');
  const pyPath = path.join(root, '.venv/bin/python3');
  const scriptPath = path.join(root, 'scripts/apsales-zijing-watch.py');
  if (fs.existsSync(pyPath) && fs.existsSync(scriptPath)) {
    try {
      const { spawnSync } = require('child_process');
      const py = spawnSync(pyPath, [scriptPath, '--json'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 45000,
        env: process.env,
      });
      const raw = (py.stdout || '').trim();
      if (py.status === 0 && raw) {
        return JSON.parse(raw);
      }
    } catch { /* fallback below */ }
  }
  return apsalesZijingLiveStatusFallback(root);
}

function apsalesExecutableChannels(asiaRoot) {
  const sendEnabled = String(process.env.EMAIL_SEND_ENABLED || '').trim() === '1'
    && Boolean(String(process.env.RESEND_API_KEY || '').trim());
  const waSend = String(process.env.WHATSAPP_SEND_ENABLED || '').trim() === '1';
  const social = apsalesSocialSessionStatus(asiaRoot).platforms || {};
  function socialChannel(key, blockedDetail, blockedNext, readyDetail) {
    const st = social[key] || {};
    const ready = Boolean(st.logged_in);
    return {
      label: st.label || key,
      can_send_today: ready,
      status: ready ? 'ready' : 'blocked_no_account',
      status_label: st.status_label || (ready ? '✅ 已登录' : '❌ 需子敬登录一次'),
      detail: ready ? readyDetail : blockedDetail,
      next_step: ready ? 'Autopilot 自动发帖' : blockedNext,
      login_method: st.method || '',
      logged_in_at: st.logged_in_at || null,
    };
  }
  return {
    email: {
      label: '邮件',
      can_send_today: sendEnabled,
      status: sendEnabled ? 'ready' : 'blocked',
      detail: sendEnabled ? 'Resend · sales@asia-power.com' : '需 RESEND_API_KEY + EMAIL_SEND_ENABLED=1',
      next_step: '网站 Lead 跟进 / 进口商开发信（CEO 批准后发）',
    },
    whatsapp: {
      label: 'WhatsApp',
      can_send_today: waSend,
      status: waSend ? 'ready' : 'readonly',
      detail: waSend ? 'Business API 已连接' : '当前只读同步',
      next_step: '需 CEO 扫码 Business 或开通 Cloud API',
    },
    website: {
      label: '官网 SEO',
      can_send_today: true,
      status: 'live',
      detail: 'asia-power.com 在线',
      next_step: '持续更新库存与详情页',
    },
    facebook: socialChannel(
      'facebook',
      '无 Business Manager / 无 Page 登录',
      '子敬运行 scripts/apsales-social-login.py --platform facebook',
      'Meta Page · Autopilot 自动发帖',
    ),
    instagram: socialChannel(
      'instagram',
      '需绑定 FB Page + IG Business',
      '子敬运行 scripts/apsales-social-login.py --platform instagram',
      'IG Business · 建议 Meta Graph API',
    ),
    x: socialChannel(
      'x',
      '无 X 账号 / API',
      '子敬运行 scripts/apsales-social-login.py --platform x',
      'X 账号或 API · Autopilot 自动发帖',
    ),
  };
}

const APSALES_PLATFORM_LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  twitter: 'X',
  whatsapp: 'WhatsApp',
};

function apsalesPlatformLabel(platform) {
  const key = String(platform || '').trim().toLowerCase();
  return APSALES_PLATFORM_LABELS[key] || platform || '—';
}

function apsalesContentPreview(text, limit = 120) {
  const value = String(text || '').trim().replace(/\n/g, ' ');
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1)}…`;
}

function apsalesBuildLinks(record) {
  const links = [];
  const postUrl = String(record.post_url || '').trim();
  const groupUrl = String(record.group_url || record.url || '').trim();
  const listingUrl = String(record.listing_url || '').trim();
  if (postUrl) links.push({ label: '帖文', url: postUrl });
  if (groupUrl) links.push({ label: '小组', url: groupUrl });
  if (listingUrl) links.push({ label: '落地页', url: listingUrl });
  return links;
}

function apsalesNormalizeGroup(raw, wave) {
  const name = raw.group_name || raw.name || '未命名小组';
  const url = raw.group_url || raw.url || '';
  const platform = raw.platform || 'facebook';
  const market = raw.language_market || raw.market || '';
  const waveId = raw.wave_id || (wave && wave.wave_id) || '';
  return {
    ...raw,
    type: 'group_join',
    type_label: APSALES_ACTION_LABELS.group_join,
    group_name: name,
    group_url: url,
    platform,
    platform_label: apsalesPlatformLabel(platform),
    language_market: market,
    market,
    wave_id: waveId,
    wave_label: (wave && wave.label) || waveId,
    at: raw.joined_at || raw.at || '',
    content_preview: name,
    post_content: '',
    links: apsalesBuildLinks({ group_url: url }),
    example: Boolean(raw.example),
  };
}

function apsalesNormalizePost(raw, wave) {
  const content = raw.post_content || raw.content || '';
  const preview = raw.content_preview || apsalesContentPreview(content);
  const platform = raw.platform || 'facebook';
  const market = raw.language_market || raw.market || '';
  const waveId = raw.wave_id || (wave && wave.wave_id) || '';
  const status = raw.status || 'live';
  const blocked = apsalesIsSocialBlocked(status);
  return {
    ...raw,
    type: blocked ? 'post_blocked' : 'post_published',
    type_label: blocked ? APSALES_ACTION_LABELS.post_blocked : APSALES_ACTION_LABELS.post_published,
    status: blocked ? 'blocked_no_account' : status,
    block_reason: raw.block_reason || (blocked ? '无人持有 FB/IG/X 登录权限' : ''),
    platform,
    platform_label: apsalesPlatformLabel(platform),
    language_market: market,
    market,
    wave_id: waveId,
    wave_label: (wave && wave.label) || waveId,
    at: raw.posted_at || raw.at || '',
    post_content: content,
    content_preview: preview || `方案${raw.scheme_id || '—'}`,
    links: apsalesBuildLinks(raw),
    example: Boolean(raw.example),
  };
}

function apsalesNormalizeTimelineEvent(item) {
  const action = item.action || '';
  const details = item.details && typeof item.details === 'object' ? item.details : {};
  const platform = details.platform || item.platform || '';
  const market = details.language_market || details.market || item.language_market || item.market || '';
  const content = details.post_content || details.content || details.snippet || '';
  return {
    ...item,
    type: action,
    type_label: APSALES_ACTION_LABELS[action] || action,
    platform,
    platform_label: platform ? apsalesPlatformLabel(platform) : '—',
    language_market: market,
    market,
    at: item.at || '',
    content_preview: content ? apsalesContentPreview(content) : (item.summary || ''),
    post_content: content,
    links: apsalesBuildLinks(details),
    wave_id: item.wave_id || details.wave_id || '',
    example: Boolean(details.example || item.example),
  };
}

function apsalesBuildActionSections(data) {
  const groups = [];
  const posts = [];
  const followups = [];
  for (const wave of data.waves || []) {
    if (!wave || typeof wave !== 'object') continue;
    for (const raw of wave.groups_joined || []) {
      if (raw && typeof raw === 'object') groups.push(apsalesNormalizeGroup(raw, wave));
    }
    for (const raw of wave.posts_published || []) {
      if (raw && typeof raw === 'object') posts.push(apsalesNormalizePost(raw, wave));
    }
  }
  for (const item of data.timeline || []) {
    if (!item || typeof item !== 'object') continue;
    const action = item.action || '';
    if (['reply_found', 'followup_drafted', 'scan_done', 'email_received'].includes(action)) {
      followups.push(apsalesNormalizeTimelineEvent(item));
    }
  }
  groups.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  posts.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  followups.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const actionLog = [...groups, ...posts, ...followups].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return {
    groups,
    posts,
    followups,
    action_log: actionLog,
    has_records: groups.length > 0 || posts.length > 0 || followups.length > 0,
  };
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
  const isAsset = !['.html', '.xml', '.txt'].includes(ext);
  // APCONTACT incident: never mark site config / SW / chrome JS as year-long immutable.
  // Cloudflare was serving a Jul-3 /js/config.js HIT with +233 for ~10 days.
  const base = path.basename(pathname || '');
  const shortCacheJs = new Set([
    'config.js',
    'components.js',
    'whatsapp-crm.js',
    'quote-request-form.js',
    'home-v4-hybrid.js',
    'pwa-install.js',
    'pwa-app-shell.js',
    'sw.js',
  ]);
  // pwa-install / pwa-app-shell must not be year-immutable: CF can poison a new
  // ?v= query key if the first edge fetch races a deploy (seen 2026-07-16).
  let cacheControl = isAsset
    ? 'public, max-age=31536000, immutable'
    : 'no-cache, no-store, must-revalidate';
  if (shortCacheJs.has(base) || pathname === '/sw.js') {
    cacheControl = 'public, max-age=60, must-revalidate';
  }
  if (ext === '.html') {
    siteAnalytics.recordPageView(req, `${pathname}${search || ''}`);
  }
  applySecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': isText ? `${mime}; charset=utf-8` : mime,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(finalPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // Canonical Construction channel — MUST run before catalog-list prerender.
  // GET /half-cuts/ is prerendered and never reaches serveStatic(); HEAD alone is not enough to verify.
  if (
    (req.method === 'GET' || req.method === 'HEAD')
    && (p === '/half-cuts/' || p === '/half-cuts')
    && url.searchParams.get('cat') === 'machinery'
  ) {
    return redirect(res, '/machinery/');
  }

  if (p === '/manifest.json') {
    const manifestPath = path.join(PUBLIC_DIR, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      applySecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(manifestPath).pipe(res);
      return;
    }
  }

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
      if (handleWhatsAppCloudWebhook && p === '/api/whatsapp/webhook') {
        await handleWhatsAppCloudWebhook(req, res, url, json);
        return;
      }

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

      if (req.method === 'GET' && p === '/api/leads/health') {
        const leads = contactLeads.listLeads();
        const open = leads.filter((lead) => lead.replyStatus !== 'replied').length;
        const whatsappIntent = leads.filter((lead) => lead.source === 'whatsapp-intent').length;
        return json(res, 200, {
          ok: true,
          total: leads.length,
          open,
          whatsappIntent,
          inboxPage: '/admin/leads.html',
        });
      }

      if (emailProxy && req.method === 'POST' && p === '/api/email/inbound') {
        if (!emailProxy.verifySecret(req)) {
          return json(res, 403, { error: 'Invalid email webhook secret' });
        }
        const body = await readBody(req, 1024 * 1024);
        try {
          const result = await emailProxy.ingestInbound(body);
          const { thread, message: inbound, route } = result;
          const agent = route?.routeAgent || thread.routeAgent || 'apsales';
          let webhookResult = null;
          // CEO 审批 + 子敬自动起草
          if (process.env.ASIAPOWER_ROOT) {
            try {
              const { spawnSync } = require('child_process');
              const py = spawnSync(
                `${process.env.ASIAPOWER_ROOT}/.venv/bin/python3`,
                ['-m', 'customer_gateway.email_webhook_handler', thread.threadId],
                {
                  cwd: process.env.ASIAPOWER_ROOT,
                  encoding: 'utf8',
                  timeout: 120000,
                  env: { ...process.env, INVENTORY_SITE_ROOT: process.env.INVENTORY_SITE_ROOT || path.join(path.dirname(process.env.ASIAPOWER_ROOT || ''), 'inventory-site') },
                },
              );
              const raw = (py.stdout || '').trim();
              if (raw) {
                try { webhookResult = JSON.parse(raw.split('\n').pop()); } catch (_) { webhookResult = { kind: 'raw', message: raw.slice(0, 500) }; }
              }
              if (webhookResult?.kind === 'ceo_approval' && webhookResult.message && telegramNotifyPath) {
                const { notifyAsync } = require(telegramNotifyPath);
                notifyAsync(`✅ CEO 邮件审批\n${webhookResult.message}`);
              }
            } catch (_) { /* non-fatal */ }
          }
          if (telegramNotifyPath) {
            const { notifyAsync } = require(telegramNotifyPath);
            const preview = (route?.routeAgent === 'ceo' ? (inbound.text || '') : (inbound.textRedacted || inbound.text || '')).slice(0, 400);
            const headers = {
              apsales: '📧 新邮件（子敬）',
              apinventory: '📧 新供应商邮件（子龙）',
              ceo: '📬 weylon@ 新邮件',
            };
            const footer = webhookResult?.kind === 'draft'
              ? `✅ 子敬已自动起草: ${webhookResult.draft_id}\nCEO 审批邮件已发 weylonhui@gmail.com`
              : webhookResult?.kind === 'error'
                ? `⚠️ 子敬自动起草失败: ${webhookResult.message}`
                : {
                  apsales: '子敬自动起草已关闭或跳过 — 手动: .venv/bin/python3 main.py "/email process ' + thread.threadId + '"',
                  apinventory: `子龙: .venv/bin/python3 main.py "/email show ${thread.threadId}"`,
                  ceo: 'CEO 私人邮箱 · 仅收信通知',
                }[agent] || '';
            notifyAsync([
              headers[agent] || headers.apsales,
              `Mailbox: ${thread.mailbox || route?.mailbox || '?'}@${process.env.EMAIL_PROXY_DOMAIN || 'asia-power.com'}`,
              `Thread: ${thread.threadId}`,
              `Subject: ${thread.subject}`,
              `From: ${agent === 'ceo' ? inbound.from : emailProxy.redactContacts(inbound.from)}`,
              '',
              preview,
              '',
              footer,
            ].join('\n'));
          }
          return json(res, 201, {
            ok: true,
            threadId: thread.threadId,
            proxyReplyTo: thread.proxyReplyTo,
          });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Email ingest failed' });
        }
      }

      if (emailProxy && req.method === 'GET' && p === '/api/email/health') {
        const health = emailProxy.health();
        if (emailOutbound) Object.assign(health, { outbound: emailOutbound.health() });
        return json(res, 200, health);
      }

      if (emailOutbound && req.method === 'POST' && p === '/api/email/send') {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req, MAX_AUTH_BODY);
        try {
          const { threadId, text, subject, to, mailbox } = body || {};
          if (!threadId || !text) {
            return json(res, 400, { error: 'threadId and text required' });
          }
          const result = await emailOutbound.sendReply({ threadId, text, subject, to, mailbox });
          return json(res, 200, { ok: true, ...result });
        } catch (err) {
          const code = err.statusCode || 500;
          return json(res, code, { error: err.message || 'Send failed', details: err.details });
        }
      }

      if (emailProxy && req.method === 'GET' && p === '/api/email/threads') {
        if (!requireAdmin(req, res)) return;
        return json(res, 200, { threads: emailProxy.listThreads(100) });
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
        if (eventType === 'search_query') {
          siteAnalytics.recordSearchQuery(body.q || body.query);
          return json(res, 200, { ok: true });
        }
        return json(res, 400, { error: 'unsupported eventType' });
      }

      if (req.method === 'POST' && p === '/api/search/record') {
        if (!limitAnalytics(req)) return json(res, 429, { error: 'Too many requests' });
        const body = await readBody(req);
        siteAnalytics.recordSearchQuery(body.q || body.query);
        return json(res, 200, { ok: true });
      }

      if (req.method === 'GET' && p === '/api/search/trending') {
        const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') || 15)));
        return json(res, 200, { queries: siteAnalytics.getSearchTrending(limit) });
      }

      if (req.method === 'GET' && p === '/api/analytics/summary') {
        if (!requireAdmin(req, res)) return;
        const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 7)));
        const day = url.searchParams.get('day');
        const view = url.searchParams.get('view') === 'external' ? 'external' : 'all';
        if (day) return json(res, 200, siteAnalytics.getSummary({ day, view }));
        return json(res, 200, siteAnalytics.getSummary({ days, view }));
      }

      if (req.method === 'GET' && p === '/api/apsales/distribution-progress') {
        if (!requireAdminOrZijingLiveToken(req, res, url)) return;
        const asiaRoot = process.env.ASIAPOWER_ROOT || path.join(ROOT, '..', 'AsiaPower');
        const progressFile = path.join(asiaRoot, 'memory', 'customer_gateway', 'apsales_distribution_progress.json');
        if (!fs.existsSync(progressFile)) {
          return json(res, 200, {
            version: 1,
            waves: [],
            groups: [],
            posts: [],
            followups: [],
            action_log: [],
            has_records: false,
            overall_completion_pct: 0,
            is_stale: true,
            stale_warning: '无进展',
          });
        }
        try {
          const raw = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
          const waves = Array.isArray(raw.waves) ? raw.waves : [];
          let totalPct = 0;
          for (const wave of waves) {
            const tg = Math.max(1, Number(wave?.targets?.groups_joined) || 1);
            const tp = Math.max(1, Number(wave?.targets?.posts_published) || 1);
            const groups = Array.isArray(wave?.groups_joined) ? wave.groups_joined.length : 0;
            const posts = Array.isArray(wave?.posts_published) ? wave.posts_published.length : 0;
            const pct = Math.round(((Math.min(groups, tg) / tg + Math.min(posts, tp) / tp) / 2) * 100);
            wave.completion_pct = pct;
            totalPct += pct;
          }
          const last = raw.last_verified_action_at || '';
          let hoursSince = null;
          if (last) {
            const parsed = Date.parse(String(last).replace(' UTC', 'Z'));
            if (!Number.isNaN(parsed)) hoursSince = (Date.now() - parsed) / 3600000;
          }
          const staleHours = Number(process.env.APSALES_PROGRESS_STALE_HOURS || 24);
          const isStale = hoursSince == null || hoursSince >= staleHours;
          const sections = apsalesBuildActionSections({ ...raw, waves });
          return json(res, 200, {
            ...raw,
            waves,
            ...sections,
            overall_completion_pct: waves.length ? Math.round(totalPct / waves.length) : 0,
            is_stale: isStale,
            hours_since_last_action: hoursSince == null ? null : Math.round(hoursSince * 10) / 10,
            stale_warning: isStale ? '无进展' : '',
            dashboard_url: 'https://asia-power.com/admin/apsales-progress.html',
            executable_channels: apsalesExecutableChannels(asiaRoot),
            social_sessions: apsalesSocialSessionStatus(asiaRoot),
            updated_at: raw.updated_at || null,
          });
        } catch (err) {
          return json(res, 500, { error: err.message || 'Failed to read progress' });
        }
      }

      if (req.method === 'GET' && p === '/api/apsales/zijing-live-status') {
        if (!requireAdminOrZijingLiveToken(req, res, url)) return;
        const asiaRoot = process.env.ASIAPOWER_ROOT || path.join(ROOT, '..', 'AsiaPower');
        try {
          const live = apsalesZijingActivityEnhance(asiaRoot, apsalesZijingLiveStatus(asiaRoot));
          return json(res, 200, live);
        } catch (err) {
          return json(res, 500, { error: err.message || 'Failed to read zijing live status' });
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

      if (req.method === 'POST' && p === '/api/vin/decode') {
        if (!handleVinDecode) return json(res, 200, { ok: false, reason: 'qxb_unavailable' });
        try {
          await handleVinDecode(req, res, json);
        } catch (err) {
          json(res, 200, { ok: false, reason: 'qxb_unavailable', message: err.message });
        }
        return;
      }

      if (p.startsWith('/api/half-cuts/')) {
        try {
          await halfCut.handleRequest(req, res, p, json);
        } catch (err) {
          json(res, 400, { error: err.message || 'Request failed' });
        }
        return;
      }

      if (req.method === 'GET' && p === '/api/shipping/ports') {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const cargo = url.searchParams.get('cargo') || 'halfcut';
        return json(res, 200, { ok: true, ports: cifShipping.listPorts(cargo) });
      }

      if (req.method === 'GET' && p === '/api/shipping/geo-hint') {
        const geo = await resolveClientGeo(req);
        return json(res, 200, { ok: true, ...cifShipping.geoHintFromClient(geo) });
      }

      if (req.method === 'GET' && p === '/api/shipping/cif-estimate') {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        try {
          const estimate = cifShipping.estimateCif({
            portId: url.searchParams.get('portId'),
            cargo: url.searchParams.get('cargo'),
            exwUsd: url.searchParams.get('exwUsd'),
          });
          return json(res, 200, { ok: true, ...estimate });
        } catch (err) {
          const code = err.statusCode || 400;
          return json(res, code, { error: err.message || 'Estimate failed' });
        }
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
        if (!u) return json(res, 200, { user: null });
        if (u.role === 'supplier') {
          const fresh = users.find((x) => x.id === u.id) || u;
          return json(res, 200, {
            user: phoneOtp.publicSupplierProfile(fresh),
            needsProfile: !phoneOtp.isProfileComplete(fresh),
          });
        }
        if (u.role === 'buyer') {
          const fresh = users.find((x) => x.id === u.id) || u;
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

      if (await phoneOtp.handleOtpRoutes(req, res, p, (r) => readBody(r, MAX_AUTH_BODY))) return;
      if (await phonePassword.handlePasswordRoutes(req, res, p, (r) => readBody(r, MAX_AUTH_BODY))) return;
      if (await oauthAuth.handleOAuthRoutes(req, res, p, url, (r) => readBody(r, MAX_AUTH_BODY))) return;

      if (req.method === 'GET' && p === '/api/admin/buyers') {
        if (!requireAdmin(req, res)) return;
        return json(res, 200, {
          buyers: phoneOtp.buyerStore.listBuyers(users),
          recentLogins: phoneOtp.buyerStore.readRecentEvents(50),
        });
      }

      if (req.method === 'GET' && p === '/api/supplier/profile') {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'supplier' && u.role !== 'admin') return json(res, 403, { error: 'Supplier only' });
        return json(res, 200, {
          profile: phoneOtp.publicSupplierProfile(u),
          needsProfile: !phoneOtp.isProfileComplete(u),
        });
      }

      if (req.method === 'PUT' && p === '/api/supplier/profile') {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'supplier') return json(res, 403, { error: 'Supplier only' });
        try {
          const body = await readBody(req, MAX_API_BODY);
          const next = phoneOtp.updateSupplierProfile(u.id, body);
          // refresh in-memory users reference already via setUsers
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
        const u = requireAuth(req, res); if (!u) return;
        if (u.role === 'admin') return json(res, 200, { orders: orderStore.listAll() });
        if (u.role !== 'buyer') return json(res, 403, { error: 'Buyer authentication required' });
        return json(res, 200, { orders: orderStore.listForBuyer(u.id) });
      }

      if (req.method === 'POST' && p === '/api/buyer/orders') {
        const u = requireAuth(req, res); if (!u) return;
        if (u.role !== 'admin' && u.role !== 'buyer') return json(res, 403, { error: 'Forbidden' });
        try {
          const body = await readBody(req, MAX_API_BODY);
          const buyerId = u.role === 'admin' ? String(body.buyerId || u.id) : u.id;
          const order = orderStore.createOrder({ ...body, buyerId });
          return json(res, 201, { ok: true, order });
        } catch (err) {
          return json(res, 400, { error: err.message || 'Create order failed' });
        }
      }

      if (req.method === 'POST' && p === '/api/buyer/orders/deposit-session') {
        const u = requireAuth(req, res); if (!u) return;
        try {
          const body = await readBody(req, MAX_AUTH_BODY);
          const orderId = String(body.orderId || '').trim();
          const order = orderStore.getById(orderId);
          if (!order) return json(res, 404, { error: 'Order not found' });
          if (u.role !== 'admin' && order.buyerId !== u.id) return json(res, 403, { error: 'Forbidden' });
          if (body.termsAccepted) {
            orderStore.updateOrder(orderId, { termsAcceptedAt: new Date().toISOString() });
          }
          const session = await stripeDeposit.createCheckoutSession(order, {
            buyerEmail: u.email || body.email,
            successUrl: body.successUrl,
            cancelUrl: body.cancelUrl,
          });
          return json(res, 200, { ok: true, session });
        } catch (err) {
          return json(res, err.statusCode || 400, { error: err.message || 'Checkout failed' });
        }
      }

      if (req.method === 'POST' && p === '/api/buyer/orders/demo-complete') {
        if (process.env.NODE_ENV === 'production' && process.env.STRIPE_DEMO !== '1') {
          return json(res, 403, { error: 'Demo complete disabled in production' });
        }
        const u = requireAuth(req, res); if (!u) return;
        try {
          const body = await readBody(req, MAX_AUTH_BODY);
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
          console.error('[stripe webhook]', err.message);
          return json(res, 400, { error: err.message || 'Webhook failed' });
        }
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

  const catalogDetailPaths = new Set([
    '/half-cuts/detail.html',
    '/trucks/detail.html',
    '/machinery/detail.html',
  ]);

  if (req.method === 'GET' && catalogDetailPaths.has(p)) {
    const slug = url.searchParams.get('slug');
    if (slug) {
      try {
        // Detail pages must use the FULL public item (all photos).
        // getPublicCatalog() intentionally truncates photos for list payload size —
        // never feed that truncated catalog into detail prerender (photo-loss bug).
        const fullItem = await halfCut.getPublicItemBySlug(slug);
        const catalog = fullItem
          ? { approved: [fullItem] }
          : await halfCut.getPublicCatalog();
        const siteUrl = process.env.SITE_URL || 'https://asia-power.com';
        const rendered = renderHalfCutDetailPage({
          publicDir: PUBLIC_DIR,
          slug,
          catalog,
          siteUrl,
          detailPath: p,
        });
        if (rendered?.html) {
          siteAnalytics.recordPageView(req, `${p}${url.search || ''}`);
          return sendPrerenderedHtml(res, rendered.html, rendered.redirectSlug, p);
        }
      } catch (err) {
        console.error('[prerender]', err);
      }
    }
  }

  const catalogListKey = CATALOG_LIST_ROUTES[p];
  if (req.method === 'GET' && catalogListKey) {
    try {
      const catalog = await halfCut.getPublicCatalog();
      const siteUrl = process.env.SITE_URL || 'https://asia-power.com';
      const html = renderCatalogListPage({
        publicDir: PUBLIC_DIR,
        catalog,
        siteUrl,
        catalogKey: catalogListKey,
      });
      if (html) {
        siteAnalytics.recordPageView(req, p);
        return sendListPrerenderHtml(res, html, catalogListKey);
      }
    } catch (err) {
      console.error('[prerender-list]', catalogListKey, err);
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
