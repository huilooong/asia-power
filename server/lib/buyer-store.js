'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Persist buyer identity + login history for CRM / portal.
 * Accounts live in users.json (role=buyer); events append to buyer-login-events.jsonl.
 */

function createBuyerStore(dataDir) {
  const eventsFile = path.join(dataDir, 'buyer-login-events.jsonl');

  function appendLoginEvent(event) {
    fs.mkdirSync(path.dirname(eventsFile), { recursive: true });
    const row = {
      at: new Date().toISOString(),
      ...event,
    };
    fs.appendFileSync(eventsFile, `${JSON.stringify(row)}\n`);
    return row;
  }

  function publicBuyer(user) {
    if (!user || user.role !== 'buyer') return null;
    return {
      id: user.id,
      role: 'buyer',
      name: user.supplierName || user.name || '',
      company: user.company || user.supplierName || '',
      email: user.email || '',
      phone: user.phone || '',
      phoneNormalized: user.phoneNormalized || '',
      countryCode: user.countryCode || '',
      country: user.country || '',
      oauthProvider: user.oauthProvider || '',
      oauthId: user.oauthId || '',
      avatarUrl: user.avatarUrl || '',
      authMethod: user.authMethod || '',
      createdAt: user.createdAt || null,
      lastLoginAt: user.lastLoginAt || null,
      loginCount: Number(user.loginCount || 0),
      profileComplete: true,
      missingFields: [],
    };
  }

  function touchLogin(user, meta = {}) {
    const next = {
      ...user,
      lastLoginAt: new Date().toISOString(),
      loginCount: Number(user.loginCount || 0) + 1,
    };
    if (meta.email && !next.email) next.email = meta.email;
    if (meta.name && (!next.supplierName || next.supplierName.startsWith('Buyer '))) {
      next.supplierName = meta.name;
    }
    if (meta.company) next.company = meta.company;
    if (meta.country) next.country = meta.country;
    if (meta.avatarUrl) next.avatarUrl = meta.avatarUrl;
    appendLoginEvent({
      buyerId: next.id,
      authMethod: next.authMethod || meta.authMethod || '',
      oauthProvider: next.oauthProvider || '',
      email: next.email || '',
      phoneNormalized: next.phoneNormalized || '',
      source: meta.source || 'login',
    });
    return next;
  }

  function listBuyers(users) {
    return (users || [])
      .filter((u) => u.role === 'buyer')
      .map(publicBuyer)
      .sort((a, b) => String(b.lastLoginAt || b.createdAt || '').localeCompare(String(a.lastLoginAt || a.createdAt || '')));
  }

  function readRecentEvents(limit = 100) {
    if (!fs.existsSync(eventsFile)) return [];
    const lines = fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  }

  return {
    publicBuyer,
    touchLogin,
    appendLoginEvent,
    listBuyers,
    readRecentEvents,
    eventsFile,
  };
}

module.exports = {
  createBuyerStore,
};
