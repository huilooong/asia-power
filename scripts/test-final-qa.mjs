#!/usr/bin/env node
/**
 * Final QA — HTTP loads, redirect loops, public VIN leak in static HTML.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765';

const FULL_VINS = [
  'MR0BA3CD500123456',
  'JTMBF4DV1A5023456',
  'KMHXX00XXXX000001',
];

const issues = [];
const pass = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => { issues.push(msg); console.log(`✗ ${msg}`); };

async function fetchFinal(url, maxRedirects = 5) {
  let current = url;
  const chain = [];
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, { redirect: 'manual' });
    chain.push({ url: current, status: res.status });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).href;
      continue;
    }
    const body = await res.text();
    return { status: res.status, body, chain, finalUrl: current };
  }
  return { status: 0, body: '', chain, finalUrl: current, loop: true };
}

const urls = [
  '/half-cuts/',
  '/half-cuts/index.html',
  '/brands/toyota.html',
  '/half-cuts/detail.html?slug=toyota-hilux-revo-2022-2gd-ftv-half-cut-hc250001',
  '/supplier-portal/half-cut-upload.html',
  '/admin/half-cut-review.html',
  '/index.html',
];

for (const path of urls) {
  try {
    const { status, chain, loop, finalUrl } = await fetchFinal(BASE + path);
    if (loop || chain.length > 3) fail(`Redirect loop or excessive redirects: ${path}`);
    else if (status !== 200) fail(`${path} returned HTTP ${status}`);
    else pass(`${path} → 200 (${chain.length} hop(s))`);
  } catch (e) {
    fail(`${path} fetch failed: ${e.message}`);
  }
}

// Static HTML must not embed full demo VINs (JS may contain decode table — separate check)
for (const file of ['half-cuts/index.html', 'half-cuts/detail.html', 'brands/toyota.html', 'index.html']) {
  const html = readFileSync(join(root, file), 'utf8');
  for (const vin of FULL_VINS) {
    if (html.includes(vin)) fail(`Full VIN in static HTML: ${file} contains ${vin}`);
  }
  if (!html.includes('half-cut-supplier-i18n.js')) {
    if (file.includes('supplier') || file.includes('admin')) {
      // skip
    } else pass(`${file} has no supplier i18n script`);
  }
  if (html.includes('提交') && !file.includes('supplier') && !file.includes('admin')) {
    fail(`Chinese text in public HTML: ${file}`);
  }
}

// Demo VIN table lives in JS source — note but don't fail public HTML check
const vinJs = readFileSync(join(root, 'js/half-cut-vin.js'), 'utf8');
if (FULL_VINS.some(v => vinJs.includes(v))) {
  console.log('ℹ Demo full VINs exist in js/half-cut-vin.js decode table (client-side demo only; not rendered in public DOM)');
}

// Upload + lead guards live in scripts/test-critical-paths.mjs (also run by deploy-production.mjs)

console.log(`\n${issues.length ? issues.length + ' issue(s)' : 'All HTTP/static checks passed'}\n`);
process.exit(issues.length ? 1 : 0);
