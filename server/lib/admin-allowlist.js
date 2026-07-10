'use strict';

/**
 * Admin email allowlist — only these Google (or other OAuth) emails may hold role=admin
 * via OAuth. Password user `admin` remains a separate break-glass account.
 *
 * Env: ADMIN_EMAIL_ALLOWLIST=gooddlong@gmail.com,other@example.com
 * Comma / whitespace separated. Case-insensitive.
 */

function parseAdminEmailAllowlist(raw = process.env.ADMIN_EMAIL_ALLOWLIST) {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email, allowlist = parseAdminEmailAllowlist()) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !allowlist.length) return false;
  return allowlist.includes(normalized);
}

module.exports = {
  parseAdminEmailAllowlist,
  isAdminEmail,
};
