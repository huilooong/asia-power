'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map((v) => v.trim()).filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    })
  );
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function sessionCookie(sid, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === '1';
  const parts = [`sid=${sid}`, 'HttpOnly', 'Path=/', 'SameSite=Lax'];
  if (maxAgeSec !== undefined) parts.push(`Max-Age=${maxAgeSec}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function createSessionAuth({ usersFile, json, limitLogin }) {
  const sessions = new Map();
  let users = [];

  function loadUsers() {
    if (!fs.existsSync(usersFile)) {
      users = [{
        id: 'admin-1',
        username: 'admin',
        role: 'admin',
        supplierName: 'Platform Admin',
        salt: 'seed',
        hash: 'seed-change-me',
      }];
      fs.mkdirSync(path.dirname(usersFile), { recursive: true });
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    } else {
      users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }

    if (users[0]?.hash === 'seed-change-me') {
      if (!process.env.ADMIN_PASSWORD) {
        throw new Error('ADMIN_PASSWORD environment variable is required for initial admin setup');
      }
      const { salt, hash } = hashPassword(process.env.ADMIN_PASSWORD);
      users[0].salt = salt;
      users[0].hash = hash;
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
      console.log('[auth] Admin password initialized from ADMIN_PASSWORD');
    }
  }

  loadUsers();

  function authUser(req) {
    const sid = parseCookies(req.headers.cookie).sid;
    if (!sid || !sessions.has(sid)) return null;
    const userId = sessions.get(sid);
    return users.find((u) => u.id === userId) || null;
  }

  function requireAuth(req, res) {
    const u = authUser(req);
    if (!u) {
      json(res, 401, { error: 'Unauthorized' });
      return null;
    }
    return u;
  }

  function requireAdmin(req, res) {
    const u = authUser(req);
    if (!u || u.role !== 'admin') {
      json(res, 401, { error: 'Admin authentication required' });
      return false;
    }
    return true;
  }

  function allowUpload(req) {
    const u = authUser(req);
    return !!(u && (u.role === 'admin' || u.role === 'supplier'));
  }

  function id(prefix) {
    return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
  }

  function createSession(userId) {
    const sid = id('sess');
    sessions.set(sid, userId);
    return sid;
  }

  function addSession(sid, userId) {
    sessions.set(sid, userId);
  }

  async function handleAuthRoutes(req, res, pathname, readBody) {
    if (req.method === 'POST' && pathname === '/api/login') {
      if (limitLogin && !limitLogin(req)) {
        json(res, 429, { error: 'Too many login attempts' });
        return true;
      }
      const { username, password } = await readBody(req);
      const u = users.find((x) => x.username === username);
      if (!u) return json(res, 401, { error: 'invalid credentials' }), true;
      const test = hashPassword(password, u.salt);
      if (test.hash !== u.hash) return json(res, 401, { error: 'invalid credentials' }), true;
      const sid = createSession(u.id);
      res.writeHead(200, {
        'Set-Cookie': sessionCookie(sid, 604800),
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(JSON.stringify({ ok: true, role: u.role, supplierName: u.supplierName }));
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
      const sid = parseCookies(req.headers.cookie).sid;
      if (sid) sessions.delete(sid);
      res.writeHead(200, {
        'Set-Cookie': sessionCookie('', 0),
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(JSON.stringify({ ok: true }));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const u = authUser(req);
      return json(res, 200, {
        user: u ? {
          id: u.id,
          role: u.role,
          supplierName: u.supplierName,
          username: u.username,
          phone: u.phone || '',
          phoneNormalized: u.phoneNormalized || '',
          email: u.email || '',
        } : null,
      }), true;
    }

    return false;
  }

  return {
    authUser,
    requireAuth,
    requireAdmin,
    allowUpload,
    handleAuthRoutes,
    hashPassword,
    sessionCookie,
    addSession,
    createSession,
    getUsers: () => users,
    setUsers: (next) => { users = next; },
    saveUsers: () => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)),
  };
}

module.exports = {
  parseCookies,
  hashPassword,
  sessionCookie,
  createSessionAuth,
};
