'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizePhone, phonesMatch } = require('./phone-normalize');
const {
  assertRequiredProfile,
  applyProfileToUser,
  publicSupplierProfile,
  isProfileComplete,
  sanitizeProfileInput,
} = require('./supplier-profile');
const { createBuyerStore } = require('./buyer-store');
const { hashPassword } = require('./http-auth');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 55 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MIN_PASSWORD_LEN = 8;

function createPhoneOtpAuth({
  dataDir,
  json: jsonFn,
  sessionCookie,
  addSession,
  getUsers,
  setUsers,
  saveUsers,
  id,
  limitSend,
  limitVerify,
}) {
  const json = jsonFn;
  const buyerStore = createBuyerStore(dataDir);
  const otpFile = path.join(dataDir, 'phone-otp-challenges.json');
  const requireSmsOtp = String(process.env.AUTH_REQUIRE_SMS_OTP || '').trim() === '1';
  /** @type {Map<string, { code: string, expiresAt: number, attempts: number, role: string, supplierName?: string }>} */
  const challenges = new Map();

  function loadChallenges() {
    try {
      if (!fs.existsSync(otpFile)) return;
      const raw = JSON.parse(fs.readFileSync(otpFile, 'utf8'));
      const now = Date.now();
      for (const [key, value] of Object.entries(raw || {})) {
        if (value && value.expiresAt > now) challenges.set(key, value);
      }
    } catch (err) {
      console.warn('[otp] failed to load challenges:', err.message);
    }
  }

  function persistChallenges() {
    const out = {};
    const now = Date.now();
    for (const [key, value] of challenges.entries()) {
      if (value.expiresAt > now) out[key] = value;
    }
    fs.mkdirSync(path.dirname(otpFile), { recursive: true });
    fs.writeFileSync(otpFile, JSON.stringify(out, null, 2));
  }

  loadChallenges();

  function demoMode() {
    return process.env.PHONE_OTP_DEMO === '1'
      || process.env.NODE_ENV !== 'production'
      || !process.env.SMS_PROVIDER;
  }

  function demoCodeForRole(role) {
    if (role === 'buyer') return process.env.PHONE_OTP_DEMO_BUYER || '123456';
    return process.env.PHONE_OTP_DEMO_SUPPLIER || '888888';
  }

  async function sendSms(phoneNorm, code) {
    const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
    if (!provider || provider === 'demo') {
      console.log(`[otp] demo SMS to +${phoneNorm}: ${code}`);
      return { ok: true, demo: true };
    }
    // Provider hooks (credentials via env only). Real send is opt-in.
    if (provider === 'log') {
      console.log(`[otp] log SMS to +${phoneNorm}: ${code}`);
      return { ok: true, demo: true };
    }
    throw new Error(`SMS provider "${provider}" not configured — set PHONE_OTP_DEMO=1 or implement provider`);
  }

  function findUserByPhone(phoneNorm, role) {
    const users = getUsers();
    return users.find((u) => {
      if (role && u.role !== role && u.role !== 'admin') return false;
      const norm = normalizePhone(u.phone, u.countryCode);
      return norm && phonesMatch(norm, phoneNorm);
    }) || null;
  }

  function ensureSupplierUser({ phoneNorm, countryCode, supplierName, profile, requireComplete = false }) {
    let user = findUserByPhone(phoneNorm, 'supplier');
    if (user) {
      if (profile) {
        const users = getUsers().slice();
        const idx = users.findIndex((u) => u.id === user.id);
        const next = applyProfileToUser(user, profile);
        users[idx] = next;
        setUsers(users);
        saveUsers();
        return next;
      }
      return user;
    }
    if (requireComplete) {
      const completeProfile = assertRequiredProfile(profile || { supplierName });
      const users = getUsers().slice();
      const local = phoneNorm.startsWith('86') ? phoneNorm.slice(2) : phoneNorm;
      user = applyProfileToUser({
        id: id('sup'),
        username: `p${phoneNorm}`,
        role: 'supplier',
        countryCode: countryCode || (phoneNorm.startsWith('86') ? '+86' : ''),
        phone: local,
        phoneNormalized: phoneNorm,
        salt: crypto.randomBytes(8).toString('hex'),
        hash: crypto.randomBytes(16).toString('hex'),
        createdAt: new Date().toISOString(),
        authMethod: 'phone-otp',
      }, completeProfile);
      users.push(user);
      setUsers(users);
      saveUsers();
      return user;
    }
    // Legacy / incomplete stub — must complete profile before dashboard
    const users = getUsers().slice();
    const local = phoneNorm.startsWith('86') ? phoneNorm.slice(2) : phoneNorm;
    user = {
      id: id('sup'),
      username: `p${phoneNorm}`,
      role: 'supplier',
      supplierName: supplierName || '',
      countryCode: countryCode || (phoneNorm.startsWith('86') ? '+86' : ''),
      phone: local,
      phoneNormalized: phoneNorm,
      salt: crypto.randomBytes(8).toString('hex'),
      hash: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
      authMethod: 'phone-otp',
      profileComplete: false,
    };
    users.push(user);
    setUsers(users);
    saveUsers();
    return user;
  }

  function consumeOtpChallenge(phoneNorm, code, role) {
    const challenge = challenges.get(phoneNorm);
    if (!challenge || challenge.expiresAt < Date.now()) {
      const err = new Error('Code expired — request a new one');
      err.statusCode = 401;
      throw err;
    }
    if (challenge.role && challenge.role !== role) {
      const err = new Error('Role mismatch');
      err.statusCode = 401;
      throw err;
    }
    challenge.attempts = (challenge.attempts || 0) + 1;
    if (challenge.attempts > MAX_VERIFY_ATTEMPTS) {
      challenges.delete(phoneNorm);
      persistChallenges();
      const err = new Error('Too many attempts');
      err.statusCode = 401;
      throw err;
    }
    if (challenge.code !== code) {
      persistChallenges();
      const err = new Error('Invalid code');
      err.statusCode = 401;
      throw err;
    }
    challenges.delete(phoneNorm);
    persistChallenges();
    return challenge;
  }

  function issueSession(res, user) {
    const sid = id('sess');
    addSession(sid, user.id);
    const profile = user.role === 'supplier'
      ? publicSupplierProfile(user)
      : user.role === 'buyer'
        ? buyerStore.publicBuyer(user)
        : {
          id: user.id,
          role: user.role,
          supplierName: user.supplierName,
          phone: user.phone,
          phoneNormalized: user.phoneNormalized || '',
          email: user.email || '',
          profileComplete: true,
          missingFields: [],
        };
    res.writeHead(200, {
      'Set-Cookie': sessionCookie(sid, 604800),
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify({
      ok: true,
      role: user.role,
      profileComplete: profile.profileComplete !== false,
      needsProfile: user.role === 'supplier' && !isProfileComplete(user),
      user: profile,
    }));
  }

  function updateSupplierProfile(userId, body) {
    const users = getUsers().slice();
    const idx = users.findIndex((u) => u.id === userId && u.role === 'supplier');
    if (idx < 0) {
      const err = new Error('Supplier not found');
      err.statusCode = 404;
      throw err;
    }
    const profile = assertRequiredProfile({ ...users[idx], ...sanitizeProfileInput(body), ...body });
    const next = applyProfileToUser(users[idx], profile);
    users[idx] = next;
    setUsers(users);
    saveUsers();
    return next;
  }

  function ensureBuyerUser({ phoneNorm, countryCode, email, name, company, country }) {
    let user = findUserByPhone(phoneNorm, 'buyer');
    if (!user && email) {
      user = getUsers().find((u) => u.role === 'buyer' && String(u.email || '').toLowerCase() === String(email).toLowerCase()) || null;
    }
    const users = getUsers().slice();
    if (user) {
      const idx = users.findIndex((u) => u.id === user.id);
      let next = { ...user };
      if (email) next.email = email;
      if (name) next.supplierName = name;
      if (company) next.company = company;
      if (country) next.country = country;
      if (phoneNorm) {
        next.phoneNormalized = phoneNorm;
        next.phone = phoneNorm.startsWith('86') ? phoneNorm.slice(2) : phoneNorm;
        next.countryCode = countryCode || next.countryCode || '';
      }
      next = buyerStore.touchLogin(next, { email, name, company, country, source: 'phone-otp' });
      users[idx] = next;
      setUsers(users);
      saveUsers();
      return next;
    }
    const local = phoneNorm ? (phoneNorm.startsWith('86') ? phoneNorm.slice(2) : phoneNorm) : '';
    let created = {
      id: id('buy'),
      username: email || `b${phoneNorm || crypto.randomBytes(4).toString('hex')}`,
      role: 'buyer',
      supplierName: name || company || email || `Buyer ${local}`,
      company: company || name || '',
      email: email || '',
      countryCode: countryCode || (phoneNorm && phoneNorm.startsWith('86') ? '+86' : ''),
      country: country || '',
      phone: local,
      phoneNormalized: phoneNorm || '',
      salt: crypto.randomBytes(8).toString('hex'),
      hash: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString(),
      authMethod: 'phone-otp',
      loginCount: 0,
    };
    created = buyerStore.touchLogin(created, { email, name, company, country, source: 'phone-otp-register' });
    users.push(created);
    setUsers(users);
    saveUsers();
    return created;
  }

  async function handleOtpRoutes(req, res, pathname, readBody) {
    if (req.method === 'POST' && pathname === '/api/auth/phone/send') {
      if (limitSend && !limitSend(req)) {
        json(res, 429, { error: 'Too many OTP requests' });
        return true;
      }
      const body = await readBody(req);
      const role = body.role === 'buyer' ? 'buyer' : 'supplier';
      const countryCode = String(body.countryCode || '+86').trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      if (!phoneNorm || phoneNorm.length < 8) {
        json(res, 400, { error: 'Valid phone required' });
        return true;
      }

      const existing = challenges.get(phoneNorm);
      if (existing && existing.sentAt && Date.now() - existing.sentAt < OTP_COOLDOWN_MS) {
        // Demo: re-surface the same code instead of blocking the buyer UI
        if (demoMode() && existing.code && existing.expiresAt > Date.now()) {
          existing.role = role;
          existing.countryCode = countryCode;
          challenges.set(phoneNorm, existing);
          persistChallenges();
          json(res, 200, {
            ok: true,
            demo: true,
            reused: true,
            expiresInSec: Math.max(1, Math.round((existing.expiresAt - Date.now()) / 1000)),
            demoCode: existing.code,
          });
          return true;
        }
        json(res, 429, { error: 'Wait before requesting another code' });
        return true;
      }

      const code = demoMode()
        ? demoCodeForRole(role)
        : String(crypto.randomInt(100000, 999999));

      challenges.set(phoneNorm, {
        code,
        role,
        supplierName: body.supplierName ? String(body.supplierName).trim() : '',
        email: body.email ? String(body.email).trim() : '',
        name: body.name ? String(body.name).trim() : '',
        countryCode,
        expiresAt: Date.now() + OTP_TTL_MS,
        sentAt: Date.now(),
        attempts: 0,
      });
      persistChallenges();

      try {
        const sent = await sendSms(phoneNorm, code);
        json(res, 200, {
          ok: true,
          demo: Boolean(sent.demo),
          expiresInSec: Math.round(OTP_TTL_MS / 1000),
          ...(sent.demo ? { demoCode: code } : {}),
        });
      } catch (err) {
        json(res, 503, { error: err.message || 'SMS send failed' });
      }
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/auth/phone/verify') {
      if (limitVerify && !limitVerify(req)) {
        json(res, 429, { error: 'Too many verify attempts' });
        return true;
      }
      const body = await readBody(req);
      const role = body.role === 'buyer' ? 'buyer' : 'supplier';
      const countryCode = String(body.countryCode || '+86').trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      const code = String(body.code || body.otp || '').trim();
      if (!phoneNorm || !code) {
        json(res, 400, { error: 'phone and code required' });
        return true;
      }

      try {
        const challenge = consumeOtpChallenge(phoneNorm, code, role);
        let user;
        if (role === 'buyer') {
          user = ensureBuyerUser({
            phoneNorm,
            countryCode: challenge.countryCode || countryCode,
            email: body.email || challenge.email,
            name: body.name || challenge.name,
            company: body.company || body.supplierName || '',
            country: body.country || '',
          });
        } else {
          const existing = findUserByPhone(phoneNorm, 'supplier');
          if (!existing) {
            // New suppliers must register with full profile (not bare phone login)
            json(res, 404, {
              error: '账号不存在，请先注册并填写供应商资料',
              needsRegistration: true,
              phoneNormalized: phoneNorm,
            });
            return true;
          }
          user = existing;
        }
        issueSession(res, user);
      } catch (err) {
        json(res, err.statusCode || 401, { error: err.message || 'Verify failed' });
      }
      return true;
    }

    // New supplier: profile (+ optional password). SMS OTP only when AUTH_REQUIRE_SMS_OTP=1.
    if (req.method === 'POST' && pathname === '/api/supplier/register') {
      if (limitVerify && !limitVerify(req)) {
        json(res, 429, { error: 'Too many requests' });
        return true;
      }
      const body = await readBody(req);
      const countryCode = String(body.countryCode || '+86').trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      const code = String(body.code || body.otp || '').trim();
      const password = String(body.password || '');
      const passwordConfirm = body.passwordConfirm != null ? String(body.passwordConfirm) : password;
      if (!phoneNorm) {
        json(res, 400, { error: 'phone required' });
        return true;
      }
      if (requireSmsOtp && !code) {
        json(res, 400, { error: 'phone and code required' });
        return true;
      }
      try {
        if (requireSmsOtp) consumeOtpChallenge(phoneNorm, code, 'supplier');
        if (findUserByPhone(phoneNorm, 'supplier')) {
          json(res, 409, { error: '该手机号已注册，请直接登录后补全资料' });
          return true;
        }
        if (password) {
          if (password.length < MIN_PASSWORD_LEN) {
            json(res, 400, { error: `密码至少 ${MIN_PASSWORD_LEN} 位` });
            return true;
          }
          if (passwordConfirm !== password) {
            json(res, 400, { error: '两次密码不一致' });
            return true;
          }
        } else if (!requireSmsOtp) {
          // Without SMS, password is required so the account can log in later
          json(res, 400, { error: '请设置密码（至少 8 位）' });
          return true;
        }
        const profile = assertRequiredProfile(body);
        let user = ensureSupplierUser({
          phoneNorm,
          countryCode,
          profile,
          requireComplete: true,
        });
        if (password) {
          const { salt, hash } = hashPassword(password);
          const users = getUsers().slice();
          const idx = users.findIndex((u) => u.id === user.id);
          const next = {
            ...user,
            salt,
            hash,
            passwordSet: true,
            passwordUpdatedAt: new Date().toISOString(),
            authMethod: 'phone-password',
          };
          users[idx] = next;
          setUsers(users);
          saveUsers();
          user = next;
          console.log(`[auth] supplier register+password phone=${phoneNorm.slice(0, 3)}****${phoneNorm.slice(-4)}`);
        }
        issueSession(res, user);
      } catch (err) {
        json(res, err.statusCode || 400, {
          error: err.message || 'Registration failed',
          missingFields: err.missingFields || undefined,
        });
      }
      return true;
    }

    return false;
  }

  return {
    handleOtpRoutes,
    normalizePhone,
    phonesMatch,
    findUserByPhone,
    ensureSupplierUser,
    ensureBuyerUser,
    updateSupplierProfile,
    publicSupplierProfile,
    isProfileComplete,
    consumeOtpChallenge,
    issueSession,
    buyerStore,
    demoMode,
  };
}

module.exports = {
  createPhoneOtpAuth,
  normalizePhone,
  phonesMatch,
};
