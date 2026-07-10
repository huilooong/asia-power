'use strict';

/**
 * Buyer + Supplier phone + password auth.
 * - Buyer: register (phone + password; SMS OTP optional/hidden) / login (phone + password)
 * - Supplier: login (phone + password) / set-or-change password (phone match; SMS OTP optional/hidden)
 * Matching key for suppliers & inventory: phoneNormalized ↔ supplierPhone(Normalized)
 * Does NOT use company name for ownership.
 *
 * SMS OTP UI is temporarily hidden (CEO 2026-07-10). Set AUTH_REQUIRE_SMS_OTP=1 to
 * re-require OTP on register/set when domestic SMS channel is ready.
 */

const fs = require('fs');
const path = require('path');
const { normalizePhone, phonesMatch } = require('./phone-normalize');
const { hashPassword } = require('./http-auth');

const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

function maskPhone(phoneNorm) {
  const d = String(phoneNorm || '');
  if (d.length < 7) return '***';
  return `${d.slice(0, 3)}****${d.slice(-4)}`;
}

function hasRealPassword(user) {
  if (!user) return false;
  if (user.passwordSet === true) return true;
  // PBKDF2 hash is 128 hex chars; OTP placeholders are short random hex
  return Boolean(user.hash && String(user.hash).length === 128 && user.salt && String(user.salt).length >= 16);
}

function validatePassword(password, passwordConfirm) {
  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD_LEN) {
    const err = new Error(`密码至少 ${MIN_PASSWORD_LEN} 位`);
    err.statusCode = 400;
    throw err;
  }
  if (pw.length > MAX_PASSWORD_LEN) {
    const err = new Error('密码过长');
    err.statusCode = 400;
    throw err;
  }
  if (passwordConfirm !== undefined && passwordConfirm !== null && String(passwordConfirm) !== pw) {
    const err = new Error('两次密码不一致');
    err.statusCode = 400;
    throw err;
  }
  return pw;
}

function createPhonePasswordAuth({
  dataDir,
  json: jsonFn,
  sessionCookie,
  addSession,
  getUsers,
  setUsers,
  saveUsers,
  id,
  findUserByPhone,
  consumeOtpChallenge,
  issueSession,
  ensureBuyerUser,
  ensureSupplierUser,
  buyerStore,
  limitLogin,
  limitRegister,
}) {
  const json = jsonFn;
  const requireSmsOtp = String(process.env.AUTH_REQUIRE_SMS_OTP || '').trim() === '1';

  function readJsonArray(filePath) {
    try {
      if (!fs.existsSync(filePath)) return [];
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function countUploadsForPhone(phoneNorm) {
    if (!phoneNorm) return 0;
    const files = [
      path.join(dataDir, 'half-cut-submissions.json'),
      path.join(dataDir, 'half-cut-approved.json'),
    ];
    let count = 0;
    for (const file of files) {
      for (const rec of readJsonArray(file)) {
        const recPhone = normalizePhone(rec.supplierPhoneNormalized || rec.supplierPhone, '');
        if (recPhone && phonesMatch(recPhone, phoneNorm)) count += 1;
      }
    }
    return count;
  }

  function applyPassword(user, password) {
    const { salt, hash } = hashPassword(password);
    return {
      ...user,
      salt,
      hash,
      passwordSet: true,
      passwordUpdatedAt: new Date().toISOString(),
      authMethod: user.authMethod && String(user.authMethod).includes('password')
        ? user.authMethod
        : (user.authMethod ? `${user.authMethod}+password` : 'phone-password'),
    };
  }

  function verifyUserPassword(user, password) {
    if (!hasRealPassword(user)) return false;
    const test = hashPassword(String(password || ''), user.salt);
    return test.hash === user.hash;
  }

  function findOrLinkSupplier(phoneNorm, countryCode) {
    let user = findUserByPhone(phoneNorm, 'supplier');
    if (user) return { user, created: false, uploadCount: countUploadsForPhone(phoneNorm) };

    const uploadCount = countUploadsForPhone(phoneNorm);
    if (uploadCount <= 0) return { user: null, created: false, uploadCount: 0 };

    // Phone appears on historical uploads but no account yet → create stub so password can bind
    const local = phoneNorm.startsWith('86') ? phoneNorm.slice(2) : phoneNorm;
    const stub = {
      id: id('sup'),
      username: `p${phoneNorm}`,
      role: 'supplier',
      supplierName: '',
      countryCode: countryCode || (phoneNorm.startsWith('86') ? '+86' : ''),
      phone: local,
      phoneNormalized: phoneNorm,
      salt: '',
      hash: '',
      passwordSet: false,
      createdAt: new Date().toISOString(),
      authMethod: 'phone-password',
      profileComplete: false,
      source: 'password-link-from-uploads',
    };
    if (typeof ensureSupplierUser === 'function') {
      // Prefer shared factory when available (keeps shape consistent)
      try {
        user = ensureSupplierUser({
          phoneNorm,
          countryCode: stub.countryCode,
          supplierName: '',
          requireComplete: false,
        });
        return { user, created: true, uploadCount };
      } catch {
        // fall through to manual stub
      }
    }
    const users = getUsers().slice();
    users.push(stub);
    setUsers(users);
    saveUsers();
    return { user: stub, created: true, uploadCount };
  }

  async function handlePasswordRoutes(req, res, pathname, readBody) {
    // Lookup: does this phone have an account / password / upload history?
    if (req.method === 'POST' && pathname === '/api/auth/phone/password/lookup') {
      if (limitLogin && !limitLogin(req)) {
        json(res, 429, { error: 'Too many requests' });
        return true;
      }
      const body = await readBody(req);
      const role = body.role === 'supplier' ? 'supplier' : 'buyer';
      const countryCode = String(body.countryCode || (role === 'supplier' ? '+86' : '+234')).trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      if (!phoneNorm || phoneNorm.length < 8) {
        json(res, 400, { error: 'Valid phone required' });
        return true;
      }

      const user = findUserByPhone(phoneNorm, role);
      const uploadCount = role === 'supplier' ? countUploadsForPhone(phoneNorm) : 0;
      json(res, 200, {
        ok: true,
        role,
        exists: Boolean(user),
        passwordSet: hasRealPassword(user),
        maskedPhone: maskPhone(phoneNorm),
        uploadCount,
        canSetPassword: role === 'supplier'
          ? Boolean(user || uploadCount > 0)
          : Boolean(user) || true, // buyers can register fresh
        matchField: 'phoneNormalized ↔ supplierPhoneNormalized|supplierPhone',
      });
      return true;
    }

    // Buyer register: phone + password (+ OTP only when AUTH_REQUIRE_SMS_OTP=1)
    if (req.method === 'POST' && pathname === '/api/auth/phone/password/register') {
      if (limitRegister && !limitRegister(req)) {
        json(res, 429, { error: 'Too many registration attempts' });
        return true;
      }
      const body = await readBody(req);
      const countryCode = String(body.countryCode || '+234').trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      const code = String(body.code || body.otp || '').trim();
      if (!phoneNorm) {
        json(res, 400, { error: 'phone required' });
        return true;
      }
      if (requireSmsOtp && !code) {
        json(res, 400, { error: 'phone and code required' });
        return true;
      }

      let password;
      try {
        password = validatePassword(body.password, body.passwordConfirm);
        if (requireSmsOtp) consumeOtpChallenge(phoneNorm, code, 'buyer');
      } catch (err) {
        json(res, err.statusCode || 400, { error: err.message || 'Register failed' });
        return true;
      }

      const existing = findUserByPhone(phoneNorm, 'buyer');
      if (existing && hasRealPassword(existing)) {
        json(res, 409, { error: '该手机号已设置密码，请直接登录' });
        return true;
      }

      let user = ensureBuyerUser({
        phoneNorm,
        countryCode,
        email: body.email || '',
        name: body.name || '',
        company: body.company || body.name || '',
        country: body.country || '',
      });

      const users = getUsers().slice();
      const idx = users.findIndex((u) => u.id === user.id);
      let next = applyPassword(user, password);
      next.authMethod = 'phone-password';
      if (buyerStore) {
        next = buyerStore.touchLogin(next, {
          email: body.email,
          name: body.name,
          company: body.company,
          source: existing ? 'buyer-password-set' : 'buyer-password-register',
        });
      }
      users[idx] = next;
      setUsers(users);
      saveUsers();
      console.log(`[auth] buyer password ${existing ? 'set' : 'register'} phone=${maskPhone(phoneNorm)}`);
      issueSession(res, next);
      return true;
    }

    // Login: phone + password (buyer or supplier)
    if (req.method === 'POST' && pathname === '/api/auth/phone/password/login') {
      if (limitLogin && !limitLogin(req)) {
        json(res, 429, { error: 'Too many login attempts' });
        return true;
      }
      const body = await readBody(req);
      const role = body.role === 'supplier' ? 'supplier' : 'buyer';
      const countryCode = String(body.countryCode || (role === 'supplier' ? '+86' : '+234')).trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      const password = String(body.password || '');
      if (!phoneNorm || !password) {
        json(res, 400, { error: 'phone and password required' });
        return true;
      }

      let user = findUserByPhone(phoneNorm, role);
      if (!user && role === 'supplier') {
        const linked = findOrLinkSupplier(phoneNorm, countryCode);
        user = linked.user;
        if (user && !hasRealPassword(user)) {
          json(res, 401, {
            error: '该手机号尚未设置密码，请先设密',
            needsPasswordSetup: true,
            uploadCount: linked.uploadCount,
            maskedPhone: maskPhone(phoneNorm),
          });
          return true;
        }
      }

      if (!user) {
        json(res, 401, {
          error: role === 'buyer' ? '账号不存在或密码错误' : '账号不存在，请先注册或设密',
          needsPasswordSetup: role === 'supplier',
          needsRegistration: role === 'buyer',
        });
        return true;
      }

      if (!hasRealPassword(user)) {
        json(res, 401, {
          error: '该手机号尚未设置密码，请先设密',
          needsPasswordSetup: true,
          maskedPhone: maskPhone(phoneNorm),
          uploadCount: role === 'supplier' ? countUploadsForPhone(phoneNorm) : 0,
        });
        return true;
      }

      if (!verifyUserPassword(user, password)) {
        console.log(`[auth] password login failed role=${role} phone=${maskPhone(phoneNorm)}`);
        json(res, 401, { error: '手机号或密码错误' });
        return true;
      }

      const users = getUsers().slice();
      const idx = users.findIndex((u) => u.id === user.id);
      let next = { ...user };
      if (role === 'buyer' && buyerStore) {
        next = buyerStore.touchLogin(next, { source: 'buyer-password-login' });
      } else {
        next.lastLoginAt = new Date().toISOString();
        next.loginCount = Number(next.loginCount || 0) + 1;
      }
      users[idx] = next;
      setUsers(users);
      saveUsers();
      console.log(`[auth] password login ok role=${role} phone=${maskPhone(phoneNorm)}`);
      issueSession(res, next);
      return true;
    }

    // Set / change password — buyer or supplier
    // Default: no SMS (phone must match existing account or supplier uploads).
    // AUTH_REQUIRE_SMS_OTP=1 re-enables OTP check.
    if (req.method === 'POST' && pathname === '/api/auth/phone/password/set') {
      if (limitRegister && !limitRegister(req)) {
        json(res, 429, { error: 'Too many attempts' });
        return true;
      }
      const body = await readBody(req);
      const role = body.role === 'supplier' ? 'supplier' : 'buyer';
      const countryCode = String(body.countryCode || (role === 'supplier' ? '+86' : '+234')).trim();
      const phoneNorm = normalizePhone(body.phone, countryCode);
      const code = String(body.code || body.otp || '').trim();
      if (!phoneNorm) {
        json(res, 400, { error: 'phone required' });
        return true;
      }
      if (requireSmsOtp && !code) {
        json(res, 400, { error: 'phone and code required' });
        return true;
      }

      let password;
      try {
        password = validatePassword(body.password, body.passwordConfirm);
        if (requireSmsOtp) consumeOtpChallenge(phoneNorm, code, role);
      } catch (err) {
        json(res, err.statusCode || 400, { error: err.message || 'Set password failed' });
        return true;
      }

      let user;
      let uploadCount = 0;
      if (role === 'supplier') {
        const linked = findOrLinkSupplier(phoneNorm, countryCode);
        user = linked.user;
        uploadCount = linked.uploadCount;
        if (!user) {
          json(res, 404, {
            error: '未找到该手机号对应的供应商账号或历史上传，请先完成供应商注册',
            needsRegistration: true,
          });
          return true;
        }
      } else {
        user = findUserByPhone(phoneNorm, 'buyer');
        if (!user) {
          user = ensureBuyerUser({
            phoneNorm,
            countryCode,
            email: body.email || '',
            name: body.name || '',
            company: body.company || '',
          });
        }
      }

      const users = getUsers().slice();
      const idx = users.findIndex((u) => u.id === user.id);
      let next = applyPassword(user, password);
      if (role === 'buyer' && buyerStore) {
        next = buyerStore.touchLogin(next, { source: 'buyer-password-set' });
      } else {
        next.lastLoginAt = new Date().toISOString();
      }
      users[idx] = next;
      setUsers(users);
      saveUsers();
      console.log(`[auth] password set role=${role} phone=${maskPhone(phoneNorm)} uploads=${uploadCount}`);
      issueSession(res, next);
      return true;
    }

    return false;
  }

  return {
    handlePasswordRoutes,
    hasRealPassword,
    maskPhone,
    countUploadsForPhone,
    validatePassword,
  };
}

module.exports = {
  createPhonePasswordAuth,
  hasRealPassword,
  maskPhone,
  validatePassword,
  MIN_PASSWORD_LEN,
};
