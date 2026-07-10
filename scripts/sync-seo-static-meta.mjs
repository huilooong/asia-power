#!/usr/bin/env node
/**
 * Write static title, description, canonical and Open Graph tags into HTML
 * so crawlers and social previews work without waiting for JS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SITE = 'https://asia-power.com';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function stripBrowserModule(src, exportName) {
  return src
    .replace(/^\s*\(function \(\) {\s*'use strict';\s*/m, '')
    .replace(new RegExp(`window\\.${exportName}\\s*=\\s*${exportName};\\s*\\}\\)\\(\\);\\s*$`, 'm'), '')
    .replace(new RegExp(`window\\.${exportName}\\s*=\\s*${exportName};\\s*`, 'g'), '');
}

function loadEngines() {
  const src = stripBrowserModule(
    fs.readFileSync(path.join(ROOT, 'js/seo-engines.js'), 'utf8'),
    'SEO_ENGINES'
  );
  const fn = new Function(`${src}; return SEO_ENGINES;`);
  return fn();
}

function loadBrandCatalog() {
  const src = stripBrowserModule(
    fs.readFileSync(path.join(ROOT, 'js/brand-catalog.js'), 'utf8'),
    'BRAND_CATALOG'
  );
  const fn = new Function(`${src}; return BRAND_CATALOG;`);
  return fn();
}

function upsertHeadBlock(html, block) {
  const withoutSeo = html
    .replace(/\s*<link rel="canonical"[^>]*>\n?/g, '')
    .replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:title"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:description"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:url"[^>]*>\n?/g, '');
  return withoutSeo.replace('</head>', `${block}\n</head>`);
}

function hreflangBlock(pageUrl) {
  return `
  <link rel="alternate" hreflang="en" href="${pageUrl}">
  <link rel="alternate" hreflang="zh-Hans" href="${pageUrl}?lang=zh">
  <link rel="alternate" hreflang="fr" href="${pageUrl}?lang=fr">
  <link rel="alternate" hreflang="ar" href="${pageUrl}?lang=ar">
  <link rel="alternate" hreflang="x-default" href="${pageUrl}">`;
}

function seoHeadBlock({ url, title, description, withHreflang = true }) {
  return `
  <link rel="canonical" href="${url}">${withHreflang ? hreflangBlock(url) : ''}
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${url}">`;
}

function syncEnginePage(slug, engine) {
  const file = path.join(ROOT, 'engines', `${slug}.html`);
  if (!fs.existsSync(file)) {
    console.warn(`[skip] missing engine page: ${slug}`);
    return false;
  }

  const url = `${SITE}/engines/${slug}.html`;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeAttr(engine.description)}">`
  );
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(engine.title)}</title>`);

  const block = seoHeadBlock({
    url,
    title: engine.title,
    description: engine.description,
  });

  fs.writeFileSync(file, upsertHeadBlock(html, block));
  return true;
}

function syncBrandPage(slug, brand) {
  const file = path.join(ROOT, 'brands', `${slug}.html`);
  if (!fs.existsSync(file)) {
    console.warn(`[skip] missing brand page: ${slug}`);
    return false;
  }

  const title = `${brand.name} — Engines, Gearboxes & Half-Cuts | AsiaPower`;
  const description = brand.lead || `AsiaPower supplies ${brand.name} engines, gearboxes, chassis parts and half-cuts for global export.`;
  const url = `${SITE}/brands/${slug}.html`;

  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeAttr(description)}">`
  );
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`);

  const block = seoHeadBlock({ url, title, description });

  fs.writeFileSync(file, upsertHeadBlock(html, block));
  return true;
}

const engines = loadEngines();
let engineCount = 0;
for (const [slug, engine] of Object.entries(engines)) {
  if (syncEnginePage(slug, engine)) engineCount += 1;
}

const brands = loadBrandCatalog();
let brandCount = 0;
for (const [slug, brand] of Object.entries(brands)) {
  if (syncBrandPage(slug, brand)) brandCount += 1;
}

console.log(`[seo-sync] updated ${engineCount} engine pages, ${brandCount} brand pages`);
