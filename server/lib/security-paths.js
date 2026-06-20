'use strict';

const BLOCKED_PREFIXES = [
  '/data/',
  '/server/',
  '/deploy/',
  '/scripts/',
  '/.git/',
  '/node_modules/',
];

const BLOCKED_EXACT = new Set([
  '/.env',
  '/package.json',
  '/package-lock.json',
]);

function isBlockedStaticPath(pathname) {
  const lower = String(pathname || '').toLowerCase();
  if (BLOCKED_EXACT.has(lower)) return true;
  if (BLOCKED_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  if (lower.includes('/.')) return true;
  if (lower.endsWith('.json') && !lower.startsWith('/public/')) return true;
  return false;
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

module.exports = { isBlockedStaticPath, applySecurityHeaders, BLOCKED_PREFIXES };
