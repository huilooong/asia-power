#!/usr/bin/env node
/**
 * Add hreflang alternates to brand and engine landing pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE = 'https://asia-power.com';

function hreflangBlock(pageUrl) {
  return `
  <link rel="alternate" hreflang="en" href="${pageUrl}">
  <link rel="alternate" hreflang="zh-Hans" href="${pageUrl}?lang=zh">
  <link rel="alternate" hreflang="fr" href="${pageUrl}?lang=fr">
  <link rel="alternate" hreflang="ar" href="${pageUrl}?lang=ar">
  <link rel="alternate" hreflang="x-default" href="${pageUrl}">`;
}

function addHreflang(filePath, pageUrl) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('hreflang="zh-Hans"')) return false;
  if (!html.includes('rel="canonical"')) return false;

  html = html.replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>\n?/g, '');
  html = html.replace(
    /(<link rel="canonical" href="[^"]+">)/,
    `$1${hreflangBlock(pageUrl)}`
  );
  fs.writeFileSync(filePath, html);
  return true;
}

function syncDir(subdir, urlPrefix) {
  const dir = path.join(ROOT, subdir);
  let count = 0;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.html') || name === 'index.html') continue;
    const file = path.join(dir, name);
    const url = `${SITE}${urlPrefix}${name}`;
    if (addHreflang(file, url)) count += 1;
  }
  return count;
}

const brandCount = syncDir('brands', '/brands/');
const engineCount = syncDir('engines', '/engines/');
console.log(`[hreflang] updated ${brandCount} brand pages, ${engineCount} engine pages`);
