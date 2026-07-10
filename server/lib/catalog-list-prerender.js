'use strict';

const fs = require('fs');
const path = require('path');
const { escapeAttr } = require('./half-cut-seo');
const { CATALOG_CONFIGS, buildCatalogJsonLd, selectCatalogItems, aggregateByBrand } = require('./inventory-catalog-seo');

const SCHEMA_ID = 'schema-catalog-seo';

function stripExistingSeo(html) {
  return html
    .replace(/\s*<script type="application\/ld\+json" id="schema-halfcut-itemlist"[^>]*>[\s\S]*?<\/script>\n?/g, '')
    .replace(/\s*<script type="application\/ld\+json" id="schema-catalog-seo"[^>]*>[\s\S]*?<\/script>\n?/g, '')
    .replace(/\s*<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema.org",\s*"@type": "CollectionPage"[\s\S]*?<\/script>\n?/g, '');
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

  return out.replace('</head>', `${headBlock}\n</head>`);
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
  injectCatalogSeo,
  renderCatalogListPage,
  renderHalfCutListPage,
  sendListPrerenderHtml,
  CATALOG_KEYS: Object.keys(CATALOG_CONFIGS),
};
