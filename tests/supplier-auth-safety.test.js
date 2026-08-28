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
const { createSupplierReferralStore } = require('../server/lib/supplier-referrals');

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

test('supplier and admin referral codes are stable, reusable, and private on disk', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-referral-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createSupplierReferralStore(root);
  const users = [
    { id: 'sup-owner', role: 'supplier', supplierName: 'Owner Supplier' },
    { id: 'admin-owner', role: 'admin', supplierName: 'AsiaPower Admin' },
    { id: 'buy-owner', role: 'buyer', supplierName: 'Buyer' },
  ];

  const first = store.backfillUsers(users);
  const second = store.backfillUsers(users);
  assert.deepEqual(first, {
    eligible: 2,
    created: 2,
    existing: 0,
    createdOwnerUserIds: ['sup-owner', 'admin-owner'],
  });
  assert.equal(second.created, 0);
  assert.equal(store.loadCodes().length, 2);

  const supplierCode = store.publicForOwner(users[0]);
  assert.match(supplierCode.code, /^AP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(store.validate(supplierCode.code.toLowerCase().replaceAll('-', '')).ownerUserId, 'sup-owner');
  store.recordRegistration({
    source: 'supplier-referral', invitationId: supplierCode.id,
    inviterUserId: 'sup-owner', inviteeSupplierId: 'sup-new-1',
  });
  store.recordRegistration({
    source: 'supplier-referral', invitationId: supplierCode.id,
    inviterUserId: 'sup-owner', inviteeSupplierId: 'sup-new-2',
  });
  assert.equal(store.publicForOwner(users[0]).useCount, 2);
  assert.equal(store.loadEvents().length, 2);
  const summary = store.adminSummary([
    ...users,
    { id: 'sup-new-3', role: 'supplier', supplierName: 'Recovered Invitee', referredByUserId: 'sup-owner', invitationSource: 'supplier-referral' },
  ]);
  assert.equal(summary.events.find((event) => event.inviteeSupplierId === 'sup-new-3').recoveredFromUser, true);
  assert.equal(fs.statSync(store.codesFile).mode & 0o777, 0o600);
  assert.equal(fs.statSync(store.eventsFile).mode & 0o777, 0o600);
});

test('invited supplier registration creates a complete account and consumes the invitation', async (t) => {
  const previous = process.env.AUTH_REQUIRE_SMS_OTP;
  delete process.env.AUTH_REQUIRE_SMS_OTP;
  t.after(() => { if (previous === undefined) delete process.env.AUTH_REQUIRE_SMS_OTP; else process.env.AUTH_REQUIRE_SMS_OTP = previous; });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-register-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inviteStore = createSupplierInviteStore(path.join(root, 'data'));
  const referralStore = createSupplierReferralStore(path.join(root, 'data'));
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
    isSupplierReferralCode: (code) => referralStore.isReferralCode(code),
    validateSupplierReferral: (code) => referralStore.validate(code),
    recordSupplierReferral: (payload) => referralStore.recordRegistration(payload),
    ensureSupplierReferral: (user, options) => referralStore.ensureForUser(user, options),
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
  assert.equal(users[0].referredByUserId, 'admin-1');
  assert.equal(users[0].invitationSource, 'phone-bound-invite');
  assert.equal(referralStore.loadEvents()[0].inviteeSupplierId, users[0].id);
  assert.ok(referralStore.publicForOwner(users[0]).code);
});

test('reusable supplier referral code registers a new supplier and records the inviter', async (t) => {
  const previous = process.env.AUTH_REQUIRE_SMS_OTP;
  delete process.env.AUTH_REQUIRE_SMS_OTP;
  t.after(() => { if (previous === undefined) delete process.env.AUTH_REQUIRE_SMS_OTP; else process.env.AUTH_REQUIRE_SMS_OTP = previous; });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-referral-register-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dataDir = path.join(root, 'data');
  const inviteStore = createSupplierInviteStore(dataDir);
  const referralStore = createSupplierReferralStore(dataDir);
  let users = [{
    id: 'sup-inviter', role: 'supplier', supplierName: 'Inviter Co',
    phone: '15500000000', countryCode: '+86', phoneNormalized: '8615500000000',
  }];
  const inviterCode = referralStore.ensureForUser(users[0]).record.code;
  let response = null;
  const auth = createPhoneOtpAuth({
    dataDir,
    json: (_res, code, payload) => { response = { code, payload }; },
    sessionCookie: () => 'ap_session=test; Path=/; HttpOnly',
    addSession: () => {},
    getUsers: () => users,
    setUsers: (next) => { users = next; },
    saveUsers: () => {},
    id: (prefix) => `${prefix}-invitee`,
    limitSend: () => true,
    limitVerify: () => true,
    validateSupplierInvite: (payload) => inviteStore.validate(payload),
    consumeSupplierInvite: (payload) => inviteStore.consume(payload),
    isSupplierReferralCode: (code) => referralStore.isReferralCode(code),
    validateSupplierReferral: (code) => referralStore.validate(code),
    recordSupplierReferral: (payload) => referralStore.recordRegistration(payload),
    ensureSupplierReferral: (user, options) => referralStore.ensureForUser(user, options),
  });
  const res = {
    writeHead: (code) => { response = { code, payload: null }; },
    end: (body) => { response.payload = JSON.parse(body); },
  };

  await auth.handleOtpRoutes(
    { method: 'POST' }, res, '/api/supplier/register',
    async () => ({
      countryCode: '+86', phone: '16638801930', inviteCode: inviterCode.toLowerCase(),
      password: 'SupplierPass123', passwordConfirm: 'SupplierPass123',
      supplierName: 'New Supplier', businessType: 'export-dealer', contactPerson: 'Li Wei',
      country: 'China', email: 'new@example.com', address: 'Guangzhou', specialization: 'engines',
    }),
  );

  assert.equal(response.code, 200);
  const invitee = users.find((user) => user.id === 'sup-invitee');
  assert.equal(invitee.referredByUserId, 'sup-inviter');
  assert.equal(invitee.invitationSource, 'supplier-referral');
  assert.equal(referralStore.loadEvents()[0].inviterUserId, 'sup-inviter');
  assert.equal(referralStore.publicForOwner(users[0]).useCount, 1);
  assert.ok(referralStore.publicForOwner(invitee).code);
});

test('supplier invitation remains required when SMS OTP mode is enabled', async (t) => {
  const previous = process.env.AUTH_REQUIRE_SMS_OTP;
  process.env.AUTH_REQUIRE_SMS_OTP = '1';
  t.after(() => { if (previous === undefined) delete process.env.AUTH_REQUIRE_SMS_OTP; else process.env.AUTH_REQUIRE_SMS_OTP = previous; });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-otp-invite-required-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let response = null;
  const auth = createPhoneOtpAuth({
    dataDir: path.join(root, 'data'),
    json: (_res, code, payload) => { response = { code, payload }; },
    sessionCookie: () => '', addSession: () => {}, getUsers: () => [], setUsers: () => {}, saveUsers: () => {},
    id: (prefix) => `${prefix}-new`, limitSend: () => true, limitVerify: () => true,
  });
  const handled = await auth.handleOtpRoutes(
    { method: 'POST' }, {}, '/api/supplier/register',
    async () => ({
      countryCode: '+86', phone: '16638801930', code: '123456',
      supplierName: 'OTP Supplier', businessType: 'export-dealer', contactPerson: 'Li Wei',
      country: 'China', email: 'otp@example.com', address: 'Guangzhou', specialization: 'engines',
    }),
  );

  assert.equal(handled, true);
  assert.equal(response.code, 403);
  assert.match(response.payload.error, /邀请码|准入码/);
});
