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

/** Public JSON assets that are safe to serve (homepage snapshot, etc.) */
const ALLOWED_JSON = new Set([
  '/assets/home-v4-inventory-snapshot.json',
  '/public/assets/home-v4-inventory-snapshot.json',
]);

function isBlockedStaticPath(pathname) {
  const lower = String(pathname || '').toLowerCase();
  if (BLOCKED_EXACT.has(lower)) return true;
  if (BLOCKED_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  if (lower.includes('/.')) return true;
  if (lower.endsWith('.json') && !lower.startsWith('/public/') && !ALLOWED_JSON.has(lower)) return true;
  return false;
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HSTS — enforce HTTPS for 1 year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP — whitelist known sources; tighten script-src once inline scripts are removed
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
      "font-src 'self'",
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
}

module.exports = { isBlockedStaticPath, applySecurityHeaders, BLOCKED_PREFIXES };
