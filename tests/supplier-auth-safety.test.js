'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { hashPassword } = require('../server/lib/http-auth');
const { createPhonePasswordAuth } = require('../server/lib/phone-password-auth');
const { createPhoneOtpAuth } = require('../server/lib/phone-otp-auth');
const { createSupplierInviteStore } = require('../server/lib/supplier-invites');

function authHarness({ signedIn = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-auth-safety-'));
  const initial = hashPassword('OriginalPass123');
  let users = [{
    id: 'sup-1', role: 'supplier', phone: '16638801930', countryCode: '+86',
    phoneNormalized: '8616638801930', passwordSet: true, ...initial,
  }];
  let response = null;
  const auth = createPhonePasswordAuth({
    dataDir: path.join(root, 'data'),
    json: (_res, code, payload) => { response = { code, payload }; },
    getUsers: () => users,
    setUsers: (next) => { users = next; },
    saveUsers: () => {},
    id: () => 'id',
    findUserByPhone: (_phone, role) => users.find((user) => user.role === role) || null,
    consumeOtpChallenge: () => {},
    issueSession: () => { response = { code: 200, payload: { ok: true } }; },
    ensureBuyerUser: () => null,
    ensureSupplierUser: () => null,
    authUser: () => signedIn,
  });
  return { root, auth, users: () => users, response: () => response };
}

test('phone-only supplier password reset is rejected when SMS OTP is disabled', async (t) => {
  const previous = process.env.AUTH_REQUIRE_SMS_OTP;
  delete process.env.AUTH_REQUIRE_SMS_OTP;
  t.after(() => { if (previous === undefined) delete process.env.AUTH_REQUIRE_SMS_OTP; else process.env.AUTH_REQUIRE_SMS_OTP = previous; });
  const harness = authHarness();
  t.after(() => fs.rmSync(harness.root, { recursive: true, force: true }));
  const beforeHash = harness.users()[0].hash;
  await harness.auth.handlePasswordRoutes(
    { method: 'POST' }, {}, '/api/auth/phone/password/set',
    async () => ({ role: 'supplier', countryCode: '+86', phone: '16638801930', password: 'TakenOver123', passwordConfirm: 'TakenOver123' }),
  );
  assert.equal(harness.response().code, 403);
  assert.equal(harness.response().payload.needsManualRecovery, true);
  assert.equal(harness.users()[0].hash, beforeHash);
});

test('authenticated password change requires the current password', async (t) => {
  const previous = process.env.AUTH_REQUIRE_SMS_OTP;
  delete process.env.AUTH_REQUIRE_SMS_OTP;
  t.after(() => { if (previous === undefined) delete process.env.AUTH_REQUIRE_SMS_OTP; else process.env.AUTH_REQUIRE_SMS_OTP = previous; });
  const signedIn = { id: 'sup-1', role: 'supplier', phone: '16638801930', countryCode: '+86' };
  const harness = authHarness({ signedIn });
  t.after(() => fs.rmSync(harness.root, { recursive: true, force: true }));
  const beforeHash = harness.users()[0].hash;
  await harness.auth.handlePasswordRoutes(
    { method: 'POST' }, {}, '/api/auth/phone/password/set',
    async () => ({ role: 'supplier', countryCode: '+86', phone: '16638801930', currentPassword: 'WrongPassword', password: 'ChangedPass123', passwordConfirm: 'ChangedPass123' }),
  );
  assert.equal(harness.response().code, 401);
  assert.equal(harness.users()[0].hash, beforeHash);
});

test('supplier invitation is phone-bound and single-use', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-invite-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createSupplierInviteStore(root);
  const invite = store.create({ phone: '16638801930', countryCode: '+86', createdBy: 'admin-1' });
  assert.throws(() => store.validate({ code: invite.code, phone: '15500000000', countryCode: '+86' }), /不匹配/);
  const used = store.consume({ code: invite.code, phone: '16638801930', countryCode: '+86', supplierId: 'sup-1' });
  assert.equal(used.usedBySupplierId, 'sup-1');
  assert.throws(() => store.consume({ code: invite.code, phone: '16638801930', countryCode: '+86' }), /已使用/);
  assert.equal(fs.statSync(store.file).mode & 0o777, 0o600);
});

test('invited supplier registration creates a complete account and consumes the invitation', async (t) => {
  const previous = process.env.AUTH_REQUIRE_SMS_OTP;
  delete process.env.AUTH_REQUIRE_SMS_OTP;
  t.after(() => { if (previous === undefined) delete process.env.AUTH_REQUIRE_SMS_OTP; else process.env.AUTH_REQUIRE_SMS_OTP = previous; });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-register-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inviteStore = createSupplierInviteStore(path.join(root, 'data'));
  const invite = inviteStore.create({ phone: '16638801930', countryCode: '+86', createdBy: 'admin-1' });
  let users = [];
  let response = null;
  const auth = createPhoneOtpAuth({
    dataDir: path.join(root, 'data'),
    json: (_res, code, payload) => { response = { code, payload }; },
    sessionCookie: () => 'ap_session=test; Path=/; HttpOnly',
    addSession: () => {},
    getUsers: () => users,
    setUsers: (next) => { users = next; },
    saveUsers: () => {},
    id: (prefix) => `${prefix}-created`,
    limitSend: () => true,
    limitVerify: () => true,
    validateSupplierInvite: (payload) => inviteStore.validate(payload),
    consumeSupplierInvite: (payload) => inviteStore.consume(payload),
  });
  const res = {
    writeHead: (code) => { response = { code, payload: null }; },
    end: (body) => { response.payload = JSON.parse(body); },
  };
  const handled = await auth.handleOtpRoutes(
    { method: 'POST' },
    res,
    '/api/supplier/register',
    async () => ({
      countryCode: '+86', phone: '16638801930', inviteCode: invite.code,
      password: 'SupplierPass123', passwordConfirm: 'SupplierPass123',
      supplierName: 'Test Supplier', businessType: 'export-dealer', contactPerson: 'Li Wei',
      country: 'China', email: 'supplier@example.com', address: 'Guangzhou', specialization: 'full-vehicle',
    }),
  );

  assert.equal(handled, true);
  assert.equal(response.code, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(users.length, 1);
  assert.equal(users[0].profileComplete, true);
  assert.equal(users[0].passwordSet, true);
  const storedInvite = inviteStore.list().find((row) => row.id === invite.id);
  assert.ok(storedInvite.usedAt);
  assert.equal(storedInvite.usedBySupplierId, users[0].id);
});
