'use strict';

const fs = require('fs');
const path = require('path');
const {
  seoTitle,
  seoDescription,
  canonicalUrl,
  productJsonLd,
  buildDetailRootHtml,
  noscriptSummary,
  escapeAttr,
} = require('./half-cut-seo');

function findApprovedItem(catalog, slug) {
  if (!slug) return null;
  const approved = catalog?.approved || [];
  const direct = approved.find((entry) => entry?.slug === slug);
  if (direct) return { item: direct, requestedSlug: slug, redirectSlug: null };
  const viaAlias = approved.find((entry) => Array.isArray(entry?.slugAliases) && entry.slugAliases.includes(slug));
  if (!viaAlias) return null;
  return { item: viaAlias, requestedSlug: slug, redirectSlug: viaAlias.slug || null };
}

function injectHalfCutPrerender(html, item, siteUrl, detailPath = '/half-cuts/detail.html') {
  const title = seoTitle(item);
  const description = seoDescription(item);
  const canonical = canonicalUrl(siteUrl, item.slug, detailPath);
  const jsonLd = JSON.stringify(productJsonLd(item, siteUrl, detailPath));
  const ogImage = (productJsonLd(item, siteUrl, detailPath).image || [])[0] || '';
  const ogImageBlock = ogImage
    ? `<meta property="og:type" content="product">
  <meta property="og:image" content="${escapeAttr(ogImage)}">
  <meta property="og:image:secure_url" content="${escapeAttr(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escapeAttr(ogImage)}">`
    : '';

  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeAttr(description)}">`
    )
    .replace(/\s*<link rel="canonical"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:title"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:description"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:url"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:image"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:image:secure_url"[^>]*>\n?/g, '')
    .replace(/\s*<meta property="og:type"[^>]*>\n?/g, '')
    .replace(/\s*<meta name="twitter:card"[^>]*>\n?/g, '')
    .replace(/\s*<meta name="twitter:image"[^>]*>\n?/g, '')
    .replace(/\s*<script type="application\/ld\+json" id="schema-halfcut-product"[^>]*>[\s\S]*?<\/script>\n?/g, '')
    .replace(/<!-- HALF_CUT_PRERENDER -->[\s\S]*?<!-- \/HALF_CUT_PRERENDER -->/g, '');

  const headBlock = `
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  ${ogImageBlock}
  <script type="application/ld+json" id="schema-halfcut-product">${jsonLd}</script>`;

  const prerenderJson = JSON.stringify(item).replace(/<\//g, '<\\/');
  const bodyBlock = `
<!-- HALF_CUT_PRERENDER -->
<script>window.__HALF_CUT_PRERENDER_ITEM__=${prerenderJson};</script>
<script type="application/json" id="half-cut-prerender-item">${prerenderJson}</script>
<noscript id="half-cut-prerender-fallback" class="half-cut-prerender">
  <div class="container" style="padding:24px 0">
    ${noscriptSummary(item)}
    <p><a href="${escapeAttr(canonical)}">View ${escapeAttr(item.stockId)} on AsiaPower</a></p>
  </div>
</noscript>
<!-- /HALF_CUT_PRERENDER -->`;

  out = out.replace('</head>', `${headBlock}\n</head>`);
  out = out.replace(
    '<div id="half-cut-detail-root"></div>',
    `${bodyBlock}\n      <div id="half-cut-detail-root" data-prerender-slug="${escapeAttr(item.slug)}">${buildDetailRootHtml(item, siteUrl)}</div>`
  );
  return out;
}

function catalogHomeForDetailPath(detailPath = '/half-cuts/detail.html') {
  const p = String(detailPath || '/half-cuts/detail.html');
  if (p.startsWith('/trucks/')) return '/trucks/';
  if (p.startsWith('/machinery/')) return '/machinery/';
  return '/half-cuts/';
}

/**
 * Missing / sold-out slug: never serve the bare detail shell as 200 without canonical.
 * Return 410 Gone + canonical to the catalog list + noindex so Google can drop stale URLs.
 */
function renderMissingCatalogDetailPage({ siteUrl, detailPath = '/half-cuts/detail.html', slug = '' }) {
  const home = catalogHomeForDetailPath(detailPath);
  const base = String(siteUrl || 'https://asia-power.com').replace(/\/$/, '');
  const canonical = `${base}${home}`;
  const safeSlug = escapeAttr(String(slug || '').slice(0, 160));
  const title = 'Listing unavailable | AsiaPower';
  const description = 'This inventory listing is no longer available. Browse current stock on AsiaPower.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
</head>
<body data-page="catalog-detail-gone" data-missing-slug="${safeSlug}">
  <main style="max-width:640px;margin:48px auto;padding:0 16px;font-family:system-ui,sans-serif">
    <h1>Listing unavailable</h1>
    <p>This stock item is no longer listed (sold, reserved, or removed).</p>
    <p><a href="${escapeAttr(home)}">Browse current inventory</a> · <a href="/contact.html">Contact us</a></p>
  </main>
</body>
</html>`;
}

function renderHalfCutDetailPage({ publicDir, slug, catalog, siteUrl, detailPath = '/half-cuts/detail.html' }) {
  const resolved = findApprovedItem(catalog, slug);
  if (!resolved?.item) return null;
  const rel = String(detailPath || '/half-cuts/detail.html').replace(/^\//, '');
  const templatePath = path.join(publicDir, rel);
  if (!fs.existsSync(templatePath)) return null;
  const html = fs.readFileSync(templatePath, 'utf8');
  return {
    html: injectHalfCutPrerender(html, resolved.item, siteUrl, detailPath),
    redirectSlug: resolved.redirectSlug,
    detailPath,
  };
}

function sendPrerenderedHtml(res, html, redirectSlug = null, detailPath = '/half-cuts/detail.html', options = {}) {
  if (redirectSlug) {
    const pathPart = detailPath.startsWith('/') ? detailPath : `/${detailPath}`;
    res.writeHead(301, {
      Location: `${pathPart}?slug=${encodeURIComponent(redirectSlug)}`,
      'Cache-Control': 'public, max-age=300',
    });
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'X-AsiaPower-Prerender': 'half-cut',
  });
  if (options.head) return res.end();
  res.end(html);
}

function sendMissingDetailHtml(res, html, options = {}) {
  res.writeHead(410, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'X-AsiaPower-Prerender': 'catalog-gone',
  });
  if (options.head) return res.end();
  res.end(html);
}

module.exports = {
  findApprovedItem,
  catalogHomeForDetailPath,
  injectHalfCutPrerender,
  renderMissingCatalogDetailPage,
  renderHalfCutDetailPage,
  sendPrerenderedHtml,
  sendMissingDetailHtml,
};
