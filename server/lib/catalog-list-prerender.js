'use strict';

const fs = require('fs');
const path = require('path');
const { escapeAttr, escapeHtml, displayTitle, canonicalUrl, resolveDetailPath } = require('./half-cut-seo');
const { CATALOG_CONFIGS, buildCatalogJsonLd, selectCatalogItems, aggregateByBrand } = require('./inventory-catalog-seo');

const SCHEMA_ID = 'schema-catalog-seo';

function stripExistingSeo(html) {
  return html
    .replace(/\s*<script type="application\/ld\+json" id="schema-halfcut-itemlist"[^>]*>[\s\S]*?<\/script>\n?/g, '')
    .replace(/\s*<script type="application\/ld\+json" id="schema-catalog-seo"[^>]*>[\s\S]*?<\/script>\n?/g, '')
    .replace(/\s*<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema.org",\s*"@type": "CollectionPage"[\s\S]*?<\/script>\n?/g, '');
}

// Real public-stock navigation remains available if the interactive catalog cannot load.
function buildCatalogQuickLinks(catalog, siteUrl, catalogKey) {
  const config = CATALOG_CONFIGS[catalogKey];
  if (!config) return '';
  const items = selectCatalogItems(catalog, catalogKey).slice(0, 24);
  if (!items.length) return '';
  const links = items.map(item => {
    const href = canonicalUrl(siteUrl, item.slug, resolveDetailPath(item));
    const title = displayTitle(item);
    return `<li><a href="${escapeAttr(href)}">${escapeHtml(title)}${item.stockId ? ` — ${escapeHtml(item.stockId)}` : ''}</a></li>`;
  }).join('\n');
  const guide = catalogKey === 'engines' && selectCatalogItems(catalog, catalogKey).some(item => String(item.engineCode || '').trim().toUpperCase() === 'G4KD')
    ? '<p><a href="/engines/g4kd.html">G4KD engines and half-cuts: buying guide</a></p>' : '';
  return `<details id="catalog-stock-links" class="container" data-catalog-quick-links="${escapeAttr(catalogKey)}">
    <summary>Browse recent listings in this category</summary>
    <ul>${links}</ul>${guide}
  </details>`;
}

function injectCatalogSeo(html, catalog, siteUrl, catalogKey) {
  const config = CATALOG_CONFIGS[catalogKey];
  if (!config) return html;

  const jsonLd = buildCatalogJsonLd(catalog, siteUrl, catalogKey);
  if (!jsonLd) return html;

  const items = selectCatalogItems(catalog, catalogKey);
  const description = config.buildDescription({
    items,
    brands: aggregateByBrand(items),
  });

  let out = stripExistingSeo(html);

  if (description) {
    out = out.replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeAttr(description)}">`
    );
  }

  const headBlock = `
  <script type="application/ld+json" id="${SCHEMA_ID}">${JSON.stringify(jsonLd)}</script>`;

  out = out.replace('</head>', `${headBlock}\n</head>`);
  const quickLinks = buildCatalogQuickLinks(catalog, siteUrl, catalogKey);
  if (quickLinks && !out.includes('id="catalog-stock-links"')) out = out.replace('</main>', `${quickLinks}\n</main>`);
  return out;
}

function renderCatalogListPage({ publicDir, catalog, siteUrl, catalogKey }) {
  const config = CATALOG_CONFIGS[catalogKey];
  if (!config) return null;
  const templatePath = path.join(publicDir, config.template);
  if (!fs.existsSync(templatePath)) return null;
  const html = fs.readFileSync(templatePath, 'utf8');
  return injectCatalogSeo(html, catalog, siteUrl, catalogKey);
}

function renderHalfCutListPage(opts) {
  return renderCatalogListPage({ ...opts, catalogKey: 'halfcuts' });
}

function sendListPrerenderHtml(res, html, catalogKey = 'halfcuts') {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'X-AsiaPower-Prerender': `catalog-list-${catalogKey}`,
  });
  res.end(html);
}

module.exports = {
  SCHEMA_ID,
  buildCatalogQuickLinks,
  injectCatalogSeo,
  renderCatalogListPage,
  renderHalfCutListPage,
  sendListPrerenderHtml,
  CATALOG_KEYS: Object.keys(CATALOG_CONFIGS),
};
