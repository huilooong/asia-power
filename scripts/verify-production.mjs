#!/usr/bin/env node
/**
 * Post-deploy smoke tests — catches "stone age" unstyled site (CSS 404 / HTML cached as CSS).
 * Usage: node scripts/verify-production.mjs [base-url]
 */
const BASE = (process.argv[2] || process.env.SITE_URL || 'https://asia-power.com').replace(/\/$/, '');

const MIN_CSS_BYTES = 80_000;
const MIN_JS_BYTES = 400;

async function fetchCheck(label, url, options = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: options.headers || {},
  });
  const body = await res.text();
  const type = res.headers.get('content-type') || '';
  const ok = [];

  if (options.status && res.status !== options.status) {
    throw new Error(`${label}: expected HTTP ${options.status}, got ${res.status} (${url})`);
  }
  if (!options.allow404 && res.status >= 400) {
    throw new Error(`${label}: HTTP ${res.status} (${url})`);
  }
  if (options.contentType && !type.includes(options.contentType)) {
    throw new Error(`${label}: expected Content-Type *${options.contentType}*, got "${type}" (${url})`);
  }
  if (options.minBytes && body.length < options.minBytes) {
    throw new Error(`${label}: body too small (${body.length} < ${options.minBytes}) — possible 404 HTML cached as asset (${url})`);
  }
  if (options.startsWith && !body.startsWith(options.startsWith)) {
    throw new Error(`${label}: unexpected body prefix (${url})`);
  }
  if (options.includes && !body.includes(options.includes)) {
    throw new Error(`${label}: missing expected content "${options.includes}" (${url})`);
  }
  if (options.json) {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(`${label}: invalid JSON (${url})`);
    }
    for (const [key, value] of Object.entries(options.json)) {
      if (data[key] !== value) {
        throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(data[key])} (${url})`);
      }
    }
  }

  ok.push(`${label} OK (${res.status}, ${body.length} bytes)`);
  return ok;
}

async function main() {
  console.log(`[verify] ${BASE}`);
  const results = [];

  results.push(...await fetchCheck('homepage', `${BASE}/`, {
    includes: 'styles.css',
    minBytes: 2000,
  }));

  results.push(...await fetchCheck('css', `${BASE}/css/styles.css`, {
    contentType: 'text/css',
    minBytes: MIN_CSS_BYTES,
    startsWith: '/* AsiaPower',
  }));

  results.push(...await fetchCheck('css-gzip', `${BASE}/css/styles.css`, {
    headers: { 'Accept-Encoding': 'gzip' },
    contentType: 'text/css',
    minBytes: 5000,
  }));

  results.push(...await fetchCheck('js-config', `${BASE}/js/config.js`, {
    contentType: 'javascript',
    minBytes: MIN_JS_BYTES,
    includes: 'ASIAPOWER',
  }));

  results.push(...await fetchCheck('api-health', `${BASE}/api/half-cuts/health`, {
    json: { ok: true },
  }));

  results.push(...await fetchCheck('supplier-upload', `${BASE}/supplier-portal/half-cut-upload.html`, {
    includes: 'supplier-half-cut-upload-root',
    minBytes: 1500,
  }));

  results.push(...await fetchCheck('half-cuts', `${BASE}/half-cuts/`, {
    includes: 'half-cut-catalog-root',
    minBytes: 1500,
  }));

  for (const line of results) console.log(`  ✓ ${line}`);
  console.log('[verify] all checks passed');
}

main().catch((err) => {
  console.error('[verify] FAILED:', err.message);
  console.error('See deploy/SITE-HEALTH.md for recovery steps.');
  process.exit(1);
});
