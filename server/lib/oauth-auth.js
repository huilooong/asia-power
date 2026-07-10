'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizePhone } = require('./phone-normalize');
const { createBuyerStore } = require('./buyer-store');
const { isAdminEmail, parseAdminEmailAllowlist } = require('./admin-allowlist');

/**
 * Buyer OAuth (Google; Facebook entry retired).
 * When client IDs are missing, demo mode issues a local buyer session for UI testing.
 *
 * Facebook login UI/start is disabled by default (CEO 2026-07-10).
 * Set FACEBOOK_LOGIN_ENABLED=1 only if re-enabling later; keep Google untouched.
 *
 * Admin: emails in ADMIN_EMAIL_ALLOWLIST get role=admin on Google OAuth
 * (CEO account). Everyone else stays buyer. Never promote unrelated emails.
 */

function googleConfigured() {
  return Boolean(String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim()
    && String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim());
}

function facebookConfigured() {
  return Boolean(String(process.env.FACEBOOK_APP_ID || '').trim()
    && String(process.env.FACEBOOK_APP_SECRET || '').trim());
}

/** Public Facebook login entry — off unless explicitly re-enabled. */
function facebookLoginEnabled() {
  return String(process.env.FACEBOOK_LOGIN_ENABLED || '').trim() === '1';
}

/**
 * Facebook Login scopes for consumer web login.
 * Default is public_profile only — email must be enabled in Meta App Use Cases
 * (or switch off "Facebook Login for Business") before requesting email,
 * otherwise developers see "Invalid Scopes: email".
 * After Meta enables email, set FACEBOOK_OAUTH_SCOPE=public_profile,email
 */
function facebookOauthScope() {
  const raw = String(process.env.FACEBOOK_OAUTH_SCOPE || 'public_profile').trim();
  return raw || 'public_profile';
}

function facebookSyntheticEmail(providerId) {
  const id = String(providerId || '').trim();
  return id ? `fb-${id}@facebook.oauth.local` : '';
}

function oauthDemoMode() {
  // Explicit demo flag, or Google not configured (Facebook entry is retired).
  // Per-provider demo is decided in startUrl(); this is the global flag for UI.
  if (process.env.OAUTH_DEMO === '1') return true;
  if (process.env.OAUTH_DEMO === '0') return !googleConfigured();
  return !googleConfigured();
}

function publicBase() {
  return String(process.env.PUBLIC_BASE_URL || 'https://asia-power.com').replace(/\/$/, '');
}

function createOAuthAuth({
  dataDir,
  json,
  sessionCookie,
  addSession,
  getUsers,
  setUsers,
  saveUsers,
  id,
}) {
  const resolvedDataDir = dataDir || pathJoinSafe();
  const buyerStore = createBuyerStore(resolvedDataDir);
  const stateFile = path.join(resolvedDataDir, 'oauth-pending-states.json');
  /** @type {Map<string, { provider: string, createdAt: number, next: string }>} */
  const pendingStates = new Map();

  function pathJoinSafe() {
    try {
      return path.join(process.cwd(), 'data');
    } catch {
      return './data';
    }
  }

  function loadStates() {
    try {
      if (!fs.existsSync(stateFile)) return;
      const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const now = Date.now();
      for (const [key, value] of Object.entries(raw || {})) {
        if (value && value.createdAt > now - 15 * 60 * 1000) {
          pendingStates.set(key, value);
        }
      }
    } catch (err) {
      console.warn('[oauth] failed to load pending states:', err.message);
    }
  }

  function persistStates() {
    try {
      const out = {};
      const cutoff = Date.now() - 15 * 60 * 1000;
      for (const [key, value] of pendingStates.entries()) {
        if (value && value.createdAt >= cutoff) out[key] = value;
      }
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(out, null, 2));
    } catch (err) {
      console.warn('[oauth] failed to persist pending states:', err.message);
    }
  }

  function pruneStates() {
    const cutoff = Date.now() - 15 * 60 * 1000;
    let changed = false;
    for (const [key, value] of pendingStates.entries()) {
      if (!value || value.createdAt < cutoff) {
        pendingStates.delete(key);
        changed = true;
      }
    }
    if (changed) persistStates();
  }

  function putState(state, value) {
    pendingStates.set(state, value);
    persistStates();
  }

  function takeState(state) {
    const value = pendingStates.get(state);
    if (!value) return null;
    pendingStates.delete(state);
    persistStates();
    return value;
  }

  loadStates();

  function resolveOAuthRole(email) {
    return isAdminEmail(email) ? 'admin' : 'buyer';
  }

  function defaultRedirectForRole(role, pendingNext) {
    const next = String(pendingNext || '').trim();
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
    return role === 'admin' ? '/admin/inventory.html' : '/buyer-portal/';
  }

  function ensureBuyerFromOAuth({ provider, providerId, email, name, avatarUrl }) {
    const users = getUsers().slice();
    const emailNorm = String(email || '').trim().toLowerCase();
    const desiredRole = resolveOAuthRole(emailNorm);

    // Match existing account by OAuth id or email across roles (so CEO buyer→admin upgrade works).
    let user = users.find((u) => u.oauthProvider === provider && String(u.oauthId || '') === String(providerId));
    if (!user && emailNorm) {
      user = users.find((u) => String(u.email || '').toLowerCase() === emailNorm);
    }
    // Do not hijack the break-glass password admin (admin-1 / username admin) via OAuth email.
    if (user && user.id === 'admin-1' && desiredRole !== 'admin') {
      user = null;
    }

    if (user) {
      const idx = users.findIndex((u) => u.id === user.id);
      let next = {
        ...user,
        email: email || user.email || '',
        username: email || user.username || `${provider}-${providerId}`,
        supplierName: name || user.supplierName || email || (desiredRole === 'admin' ? 'CEO Admin' : 'Buyer'),
        company: user.company || name || '',
        oauthProvider: provider,
        oauthId: String(providerId),
        avatarUrl: avatarUrl || user.avatarUrl || '',
        authMethod: `oauth-${provider}`,
        role: desiredRole,
      };
      if (desiredRole === 'admin') {
        next.supplierName = name || user.supplierName || 'CEO Admin';
        next.loginCount = Number(user.loginCount || 0) + 1;
        next.lastLoginAt = new Date().toISOString();
      } else {
        next = buyerStore.touchLogin(next, {
          email,
          name,
          avatarUrl,
          authMethod: `oauth-${provider}`,
          source: `oauth-${provider}`,
        });
        // Allowlist is source of truth — never leave a non-allowlisted OAuth user as admin.
        next.role = 'buyer';
      }
      users[idx] = next;
      setUsers(users);
      saveUsers();
      return users[idx];
    }

    let created = {
      id: id(desiredRole === 'admin' ? 'admin' : 'buy'),
      username: email || `${provider}-${providerId}`,
      role: desiredRole,
      supplierName: name || email || (desiredRole === 'admin' ? 'CEO Admin' : 'Buyer'),
      company: name || '',
      email: email || '',
      countryCode: '',
      phone: '',
      phoneNormalized: '',
      oauthProvider: provider,
      oauthId: String(providerId),
      avatarUrl: avatarUrl || '',
      salt: crypto.randomBytes(8).toString('hex'),
      hash: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
      authMethod: `oauth-${provider}`,
      loginCount: 0,
    };
    if (desiredRole === 'admin') {
      created.loginCount = 1;
      created.lastLoginAt = new Date().toISOString();
    } else {
      created = buyerStore.touchLogin(created, {
        email,
        name,
        avatarUrl,
        authMethod: `oauth-${provider}`,
        source: `oauth-${provider}-register`,
      });
    }
    users.push(created);
    setUsers(users);
    saveUsers();
    return created;
  }

  function issueBuyerSession(res, user, { redirect } = {}) {
    const sid = id('sess');
    addSession(sid, user.id);
    const role = user.role === 'admin' ? 'admin' : 'buyer';
    const payload = {
      ok: true,
      role,
      user: role === 'admin'
        ? {
          id: user.id,
          role: 'admin',
          email: user.email || '',
          username: user.username || '',
          supplierName: user.supplierName || 'CEO Admin',
        }
        : buyerStore.publicBuyer(user),
    };
    if (redirect) {
      res.writeHead(302, {
        Location: redirect,
        'Set-Cookie': sessionCookie(sid, 604800),
      });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Set-Cookie': sessionCookie(sid, 604800),
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(payload));
  }

  function startUrl(provider, nextPath = '/buyer-portal/') {
    pruneStates();
    if (provider === 'facebook' && !facebookLoginEnabled()) {
      throw Object.assign(
        new Error('Facebook login is disabled. Please use Google or phone OTP.'),
        { statusCode: 410, code: 'facebook_login_disabled' },
      );
    }
    const state = crypto.randomBytes(16).toString('hex');
    putState(state, { provider, createdAt: Date.now(), next: nextPath });

    if (provider === 'google') {
      if (!googleConfigured()) {
        return {
          demo: true,
          url: `/api/auth/oauth/demo?provider=google&state=${state}`,
          provider,
        };
      }
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        redirect_uri: `${publicBase()}/api/auth/oauth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'online',
        prompt: 'select_account',
      });
      return { demo: false, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, provider };
    }

    if (provider === 'facebook') {
      if (!facebookConfigured()) {
        return {
          demo: true,
          url: `/api/auth/oauth/demo?provider=facebook&state=${state}`,
          provider,
        };
      }
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID,
        redirect_uri: `${publicBase()}/api/auth/oauth/facebook/callback`,
        state,
        scope: facebookOauthScope(),
      });
      return { demo: false, url: `https://www.facebook.com/v19.0/dialog/oauth?${params}`, provider };
    }

    throw Object.assign(new Error('Unsupported provider'), { statusCode: 400 });
  }

  async function exchangeGoogle(code) {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: `${publicBase()}/api/auth/oauth/google/callback`,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(token.error_description || 'Google token exchange failed');
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok) throw new Error('Google profile fetch failed');
    return {
      providerId: profile.sub,
      email: profile.email || '',
      name: profile.name || profile.email || 'Google Buyer',
      avatarUrl: profile.picture || '',
    };
  }

  async function exchangeFacebook(code) {
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri: `${publicBase()}/api/auth/oauth/facebook/callback`,
      code,
    });
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams}`);
    const token = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(token.error?.message || 'Facebook token exchange failed');
    const accessToken = encodeURIComponent(token.access_token);
    // Prefer email when Meta granted it; fall back to id/name only so login never hard-fails.
    let profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`);
    let profile = await profileRes.json();
    if (!profileRes.ok && /email/i.test(String(profile.error?.message || ''))) {
      profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,picture.type(large)&access_token=${accessToken}`);
      profile = await profileRes.json();
    }
    if (!profileRes.ok) throw new Error(profile.error?.message || 'Facebook profile fetch failed');
    const providerId = String(profile.id || '').trim();
    if (!providerId) throw new Error('Facebook profile missing id');
    const email = String(profile.email || '').trim() || facebookSyntheticEmail(providerId);
    return {
      providerId,
      email,
      name: profile.name || 'Facebook Buyer',
      avatarUrl: profile.picture?.data?.url || '',
    };
  }

  async function handleOAuthRoutes(req, res, pathname, url, readBody) {
    if (req.method === 'GET' && pathname === '/api/auth/oauth/providers') {
      const fbOn = facebookLoginEnabled();
      json(res, 200, {
        google: { enabled: true, configured: googleConfigured(), demo: !googleConfigured() },
        facebook: {
          enabled: fbOn,
          configured: fbOn && facebookConfigured(),
          demo: false,
          retired: !fbOn,
          message: fbOn ? undefined : 'Facebook login entry retired; use Google or phone OTP.',
        },
        demoMode: oauthDemoMode(),
        publicBase: publicBase(),
        callbacks: {
          google: `${publicBase()}/api/auth/oauth/google/callback`,
          facebook: `${publicBase()}/api/auth/oauth/facebook/callback`,
        },
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/auth/oauth/start') {
      try {
        const provider = String(url.searchParams.get('provider') || '').toLowerCase();
        const next = String(url.searchParams.get('next') || '/buyer-portal/');
        const started = startUrl(provider, next);
        return json(res, 200, { ok: true, ...started }), true;
      } catch (err) {
        return json(res, err.statusCode || 400, { error: err.message || 'OAuth start failed' }), true;
      }
    }

    if (req.method === 'GET' && pathname === '/api/auth/oauth/demo') {
      const provider = String(url.searchParams.get('provider') || 'google').toLowerCase();
      const state = String(url.searchParams.get('state') || '');
      const pending = takeState(state);
      if (!pending || pending.provider !== provider) {
        json(res, 400, { error: 'Invalid OAuth state' });
        return true;
      }
      if (provider === 'facebook' && !facebookLoginEnabled()) {
        json(res, 410, {
          error: 'Facebook login is disabled. Please use Google or phone OTP.',
          code: 'facebook_login_disabled',
        });
        return true;
      }
      // Allow demo only when that provider is not configured (or global OAUTH_DEMO=1)
      if (process.env.OAUTH_DEMO !== '1') {
        if (provider === 'google' && googleConfigured()) {
          json(res, 403, { error: 'Demo OAuth disabled when Google credentials are configured' });
          return true;
        }
        if (provider === 'facebook' && facebookConfigured()) {
          json(res, 403, { error: 'Demo OAuth disabled when Facebook credentials are configured' });
          return true;
        }
      }
      const user = ensureBuyerFromOAuth({
        provider,
        providerId: `demo-${provider}-user`,
        email: provider === 'google' ? 'buyer.google.demo@asiapower.local' : 'buyer.facebook.demo@asiapower.local',
        name: provider === 'google' ? 'Google Demo Buyer' : 'Facebook Demo Buyer',
        avatarUrl: '',
      });
      issueBuyerSession(res, user, { redirect: defaultRedirectForRole(user.role, pending.next) });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/auth/oauth/google/callback') {
      try {
        const code = String(url.searchParams.get('code') || '');
        const state = String(url.searchParams.get('state') || '');
        const pending = takeState(state);
        if (!pending || pending.provider !== 'google') throw new Error('Invalid OAuth state');
        const profile = await exchangeGoogle(code);
        const user = ensureBuyerFromOAuth({ provider: 'google', ...profile });
        issueBuyerSession(res, user, { redirect: defaultRedirectForRole(user.role, pending.next) });
      } catch (err) {
        res.writeHead(302, { Location: `/login/?role=buyer&error=${encodeURIComponent(err.message || 'Google login failed')}` });
        res.end();
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/auth/oauth/facebook/callback') {
      if (!facebookLoginEnabled()) {
        res.writeHead(302, {
          Location: `/login/?role=buyer&error=${encodeURIComponent('Facebook login is disabled. Please use Google or phone OTP.')}`,
        });
        res.end();
        return true;
      }
      try {
        const oauthErr = String(url.searchParams.get('error') || '');
        if (oauthErr) {
          const reason = String(url.searchParams.get('error_description') || oauthErr || 'Facebook login failed');
          res.writeHead(302, { Location: `/login/?role=buyer&error=${encodeURIComponent(reason)}` });
          res.end();
          return true;
        }
        const code = String(url.searchParams.get('code') || '');
        const state = String(url.searchParams.get('state') || '');
        const pending = takeState(state);
        if (!pending || pending.provider !== 'facebook') throw new Error('Invalid OAuth state');
        const profile = await exchangeFacebook(code);
        const user = ensureBuyerFromOAuth({ provider: 'facebook', ...profile });
        issueBuyerSession(res, user, { redirect: defaultRedirectForRole(user.role, pending.next) });
      } catch (err) {
        res.writeHead(302, { Location: `/login/?role=buyer&error=${encodeURIComponent(err.message || 'Facebook login failed')}` });
        res.end();
      }
      return true;
    }

    // Optional JSON demo complete (for SPA without redirect)
    if (req.method === 'POST' && pathname === '/api/auth/oauth/demo-login') {
      if (!oauthDemoMode() && process.env.OAUTH_DEMO !== '1') {
        json(res, 403, { error: 'Demo OAuth disabled' });
        return true;
      }
      const body = await readBody(req);
      const provider = body.provider === 'facebook' ? 'facebook' : 'google';
      if (provider === 'facebook' && !facebookLoginEnabled()) {
        json(res, 410, {
          error: 'Facebook login is disabled. Please use Google or phone OTP.',
          code: 'facebook_login_disabled',
        });
        return true;
      }
      const user = ensureBuyerFromOAuth({
        provider,
        providerId: `demo-${provider}-user`,
        email: body.email || `${provider}.demo@asiapower.local`,
        name: body.name || `${provider} Demo Buyer`,
        avatarUrl: '',
      });
      issueBuyerSession(res, user);
      return true;
    }

    return false;
  }

  return {
    handleOAuthRoutes,
    googleConfigured,
    facebookConfigured,
    oauthDemoMode,
    ensureBuyerFromOAuth,
    resolveOAuthRole,
    parseAdminEmailAllowlist,
    buyerStore,
    normalizePhone,
  };
}

module.exports = {
  createOAuthAuth,
  googleConfigured,
  facebookConfigured,
  facebookLoginEnabled,
  facebookOauthScope,
  oauthDemoMode,
};
