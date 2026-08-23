'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadJson, saveJsonAtomic } = require('./json-store');
const { normalizePhone } = require('./phone-normalize');

function digest(code) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

function createSupplierInviteStore(dataDir) {
  const file = path.join(dataDir, 'supplier-invites.json');

  function load() {
    const rows = loadJson(file, []);
    return Array.isArray(rows) ? rows : [];
  }

  function save(rows) {
    saveJsonAtomic(file, rows);
    try { fs.chmodSync(file, 0o600); } catch {}
  }

  function create({ phone, countryCode = '+86', createdBy = '', expiresInHours = 168 } = {}) {
    const phoneNormalized = normalizePhone(phone, countryCode);
    if (!phoneNormalized) throw Object.assign(new Error('Valid supplier phone required'), { statusCode: 400 });
    const code = crypto.randomBytes(6).toString('base64url').toUpperCase();
    const now = Date.now();
    const record = {
      id: `INV-${now}-${crypto.randomBytes(3).toString('hex')}`,
      codeHash: digest(code),
      codeHint: `${code.slice(0, 3)}…${code.slice(-2)}`,
      phoneNormalized,
      createdBy,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + Math.max(1, Number(expiresInHours) || 168) * 3600000).toISOString(),
      usedAt: null,
      usedBySupplierId: '',
    };
    save([record, ...load()]);
    return { ...record, code, codeHash: undefined };
  }

  function consume({ code, phone, countryCode = '+86', supplierId = '' } = {}) {
    const { rows, index, record } = validate({ code, phone, countryCode });
    rows[index] = { ...record, usedAt: new Date().toISOString(), usedBySupplierId: supplierId || '' };
    save(rows);
    return rows[index];
  }

  function validate({ code, phone, countryCode = '+86' } = {}) {
    const phoneNormalized = normalizePhone(phone, countryCode);
    const codeHash = digest(code);
    const rows = load();
    const index = rows.findIndex((row) => row.codeHash === codeHash);
    if (index < 0) throw Object.assign(new Error('邀请代码无效'), { statusCode: 401 });
    const record = rows[index];
    if (record.usedAt) throw Object.assign(new Error('邀请代码已使用'), { statusCode: 409 });
    if (Date.parse(record.expiresAt) <= Date.now()) throw Object.assign(new Error('邀请代码已过期'), { statusCode: 410 });
    if (!phoneNormalized || record.phoneNormalized !== phoneNormalized) {
      throw Object.assign(new Error('邀请代码与手机号不匹配'), { statusCode: 403 });
    }
    return { rows, index, record };
  }

  function list() {
    return load().map(({ codeHash, ...record }) => record);
  }

  return { file, create, validate, consume, list };
}

module.exports = { createSupplierInviteStore };
