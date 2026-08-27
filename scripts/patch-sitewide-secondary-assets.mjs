#!/usr/bin/env node
/* Mechanical public-page asset alignment for secondary design V1. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SKIP_DIRS = new Set([
  '.git', '.wwebjs_cache', 'admin', 'buyer-portal', 'campaigns', 'docs', 'login',
  'node_modules', 'outputs', 'pages', 'reports', 'supplier-portal', 'tests', 'tmp',
]);
const VERSION = 'sitewide-secondary-v1';
const SKIP_FILES = new Set(['app.html', 'supplier-portal.html']);

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(rel.split(path.sep)[0])) collect(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function updateVersion(html, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html
    .replace(new RegExp(`(${escaped}\\?v=)[^"']+`, 'g'), `$1${VERSION}`)
    .replace(new RegExp(`(${escaped})(["'])`, 'g'), `$1?v=${VERSION}$2`);
}

let changed = 0;
const touched = [];
for (const file of collect(ROOT)) {
  if (SKIP_FILES.has(path.relative(ROOT, file))) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('js/components.js')) continue;
  const original = html;
  const isHome = path.relative(ROOT, file) === 'index.html';

  if (!/<meta\s+name=["']google["']/i.test(html)) {
    html = html.replace(/(<meta\s+charset=[^>]+>)/i, '$1\n  <meta name="google" content="notranslate">');
  }

  for (const asset of [
    'js/path-utils.js',
    'js/public-i18n.js',
    'js/components.js',
    'js/main.js',
    'js/ebay-layout.js',
    'js/ebay-catalog-hub.js',
    'js/brand-page.js',
    'js/engine-card-label.js',
    'js/half-cut-directory.js',
    'js/half-cut-detail.js',
    'js/half-cut-title.js',
    'js/half-cut-vehicle-title-i18n.js',
    'js/quote-list.js',
  ]) html = updateVersion(html, asset);

  if (!isHome && !html.includes('sitewide-secondary-v1.css')) {
    const componentsMatch = html.match(/<script\s+src=["']([^"']*?)js\/components\.js(?:\?[^"']*)?["']/i);
    const prefix = componentsMatch ? componentsMatch[1] : '';
    const link = `  <link rel="stylesheet" href="${prefix}css/sitewide-secondary-v1.css?v=${VERSION}" data-sitewide-secondary="1">`;
    html = html.replace(/\s*<\/head>/i, `\n${link}\n</head>`);
  }

  if (html !== original) {
    fs.writeFileSync(file, html);
    changed += 1;
    touched.push(path.relative(ROOT, file));
  }
}

console.log(JSON.stringify({ changed, touched }, null, 2));
