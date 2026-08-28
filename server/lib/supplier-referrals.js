'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadJson, saveJsonAtomic } = require('./json-store');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ELIGIBLE_OWNER_ROLES = new Set(['supplier', 'admin']);

function normalizeReferralCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isSupplierReferralCode(code) {
  return /^AP[A-HJ-NP-Z2-9]{8}$/.test(normalizeReferralCode(code));
}

function generateReferralCode() {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i += 1) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `AP-${body.slice(0, 4)}-${body.slice(4)}`;
}

function maskPhone(value = '') {
  const phone = String(value || '').replace(/\D/g, '');
  if (!phone) return '';
  if (phone.length <= 7) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function createSupplierReferralStore(dataDir) {
  const codesFile = path.join(dataDir, 'supplier-referral-codes.json');
  const eventsFile = path.join(dataDir, 'supplier-referral-events.json');

  function loadCodes() {
    const rows = loadJson(codesFile, [], { createIfMissing: false });
    return Array.isArray(rows) ? rows : [];
  }

  function loadEvents() {
    const rows = loadJson(eventsFile, [], { createIfMissing: false });
    return Array.isArray(rows) ? rows : [];
  }

  function savePrivate(file, rows) {
    saveJsonAtomic(file, rows);
    try { fs.chmodSync(file, 0o600); } catch {}
  }

  function findForOwner(ownerUserId) {
    return loadCodes().find((row) => row.ownerUserId === ownerUserId && row.active !== false) || null;
  }

  function ensureForUser(user, { createdBy = 'system' } = {}) {
    if (!user || !user.id || !ELIGIBLE_OWNER_ROLES.has(user.role)) {
      throw Object.assign(new Error('Supplier or admin account required'), { statusCode: 400 });
    }
    const rows = loadCodes();
    const existing = rows.find((row) => row.ownerUserId === user.id && row.active !== false);
    if (existing) return { record: existing, created: false };

    let code = '';
    let codeKey = '';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      code = generateReferralCode();
      codeKey = normalizeReferralCode(code);
      if (!rows.some((row) => row.codeKey === codeKey)) break;
      code = '';
    }
    if (!code) throw Object.assign(new Error('Could not allocate unique referral code'), { statusCode: 503 });

    const now = new Date().toISOString();
    const record = {
      id: `SRC-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      code,
      codeKey,
      ownerUserId: user.id,
      ownerRole: user.role,
      createdBy,
      createdAt: now,
      active: true,
      useCount: 0,
      lastUsedAt: null,
    };
    savePrivate(codesFile, [record, ...rows]);
    return { record, created: true };
  }

  function backfillUsers(users, { createdBy = 'system-backfill' } = {}) {
    const eligible = (Array.isArray(users) ? users : [])
      .filter((user) => user && user.id && ELIGIBLE_OWNER_ROLES.has(user.role));
    const created = [];
    for (const user of eligible) {
      const result = ensureForUser(user, { createdBy });
      if (result.created) created.push(result.record.ownerUserId);
    }
    return {
      eligible: eligible.length,
      created: created.length,
      existing: eligible.length - created.length,
      createdOwnerUserIds: created,
    };
  }

  function validate(code) {
    const codeKey = normalizeReferralCode(code);
    const record = loadCodes().find((row) => row.codeKey === codeKey) || null;
    if (!record || record.active === false) {
      throw Object.assign(new Error('推荐人邀请码无效'), { statusCode: 401 });
    }
    return record;
  }

  function publicForOwner(user) {
    if (!user || !ELIGIBLE_OWNER_ROLES.has(user.role)) return null;
    const record = findForOwner(user.id);
    if (!record) return null;
    return {
      id: record.id,
      code: record.code,
      ownerUserId: record.ownerUserId,
      createdAt: record.createdAt,
      useCount: Number(record.useCount || 0),
      lastUsedAt: record.lastUsedAt || null,
    };
  }

  function recordRegistration({
    source,
    invitationId,
    inviterUserId,
    inviteeSupplierId,
    codeHint = '',
  } = {}) {
    if (!inviteeSupplierId) {
      throw Object.assign(new Error('Invitee supplier required'), { statusCode: 400 });
    }
    const rows = loadEvents();
    const existing = rows.find((row) => row.inviteeSupplierId === inviteeSupplierId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const event = {
      id: `SRE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      source: source || 'unknown',
      invitationId: invitationId || '',
      inviterUserId: inviterUserId || '',
      inviteeSupplierId,
      codeHint: codeHint || '',
      registeredAt: now,
    };
    savePrivate(eventsFile, [event, ...rows]);

    if (source === 'supplier-referral' && invitationId) {
      const codes = loadCodes();
      const index = codes.findIndex((row) => row.id === invitationId);
      if (index >= 0) {
        codes[index] = {
          ...codes[index],
          useCount: Number(codes[index].useCount || 0) + 1,
          lastUsedAt: now,
        };
        savePrivate(codesFile, codes);
      }
    }
    return event;
  }

  function adminSummary(users) {
    const allUsers = Array.isArray(users) ? users : [];
    const people = new Map(allUsers.map((user) => [user.id, user]));
    const codes = loadCodes().map((record) => {
      const owner = people.get(record.ownerUserId) || {};
      return {
        id: record.id,
        code: record.code,
        ownerUserId: record.ownerUserId,
        ownerRole: record.ownerRole,
        ownerName: owner.supplierName || owner.company || owner.username || '',
        ownerPhone: maskPhone(owner.phoneNormalized || owner.phone || ''),
        createdAt: record.createdAt,
        active: record.active !== false,
        useCount: Number(record.useCount || 0),
        lastUsedAt: record.lastUsedAt || null,
      };
    });
    const storedEvents = loadEvents();
    const knownInvitees = new Set(storedEvents.map((event) => event.inviteeSupplierId));
    const recoveredEvents = allUsers
      .filter((user) => user.role === 'supplier' && user.referredByUserId && !knownInvitees.has(user.id))
      .map((user) => ({
        id: `RECOVERED-${user.id}`,
        source: user.invitationSource || 'unknown',
        invitationId: user.invitationId || '',
        inviterUserId: user.referredByUserId,
        inviteeSupplierId: user.id,
        codeHint: '',
        registeredAt: user.referredAt || user.createdAt || '',
        recoveredFromUser: true,
      }));
    const events = [...storedEvents, ...recoveredEvents].map((event) => {
      const inviter = people.get(event.inviterUserId) || {};
      const invitee = people.get(event.inviteeSupplierId) || {};
      return {
        ...event,
        inviterName: inviter.supplierName || inviter.company || inviter.username || event.inviterUserId || 'AsiaPower',
        inviteeName: invitee.supplierName || invitee.company || invitee.username || '',
        inviteePhone: maskPhone(invitee.phoneNormalized || invitee.phone || ''),
      };
    });
    return { codes, events };
  }

  return {
    codesFile,
    eventsFile,
    normalizeReferralCode,
    isReferralCode: isSupplierReferralCode,
    ensureForUser,
    backfillUsers,
    validate,
    publicForOwner,
    recordRegistration,
    adminSummary,
    loadCodes,
    loadEvents,
  };
}

module.exports = {
  createSupplierReferralStore,
  normalizeReferralCode,
  isSupplierReferralCode,
};
