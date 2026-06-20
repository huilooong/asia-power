'use strict';

const fs = require('fs');
const path = require('path');
const {
  seoTitle,
  seoDescription,
  canonicalUrl,
  productJsonLd,
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

function injectHalfCutPrerender(html, item, siteUrl) {
  const title = seoTitle(item);
  const description = seoDescription(item);
  const canonical = canonicalUrl(siteUrl, item.slug);
  const jsonLd = JSON.stringify(productJsonLd(item, siteUrl));
  const ogImage = (productJsonLd(item, siteUrl).image || [])[0] || '';

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
    .replace(/\s*<script type="application\/ld\+json" id="schema-halfcut-product"[^>]*>[\s\S]*?<\/script>\n?/g, '')
    .replace(/<!-- HALF_CUT_PRERENDER -->[\s\S]*?<!-- \/HALF_CUT_PRERENDER -->/g, '');

  const headBlock = `
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ''}
  <script type="application/ld+json" id="schema-halfcut-product">${jsonLd}</script>`;

  const bodyBlock = `
<!-- HALF_CUT_PRERENDER -->
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
    `${bodyBlock}\n      <div id="half-cut-detail-root"></div>`
  );
  return out;
}

function renderHalfCutDetailPage({ publicDir, slug, catalog, siteUrl }) {
  const resolved = findApprovedItem(catalog, slug);
  if (!resolved?.item) return null;
  const templatePath = path.join(publicDir, 'half-cuts', 'detail.html');
  if (!fs.existsSync(templatePath)) return null;
  const html = fs.readFileSync(templatePath, 'utf8');
  return {
    html: injectHalfCutPrerender(html, resolved.item, siteUrl),
    redirectSlug: resolved.redirectSlug,
  };
}

function sendPrerenderedHtml(res, html, redirectSlug = null) {
  if (redirectSlug) {
    res.writeHead(301, {
      Location: `/half-cuts/detail.html?slug=${encodeURIComponent(redirectSlug)}`,
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
  res.end(html);
}

module.exports = {
  findApprovedItem,
  injectHalfCutPrerender,
  renderHalfCutDetailPage,
  sendPrerenderedHtml,
};
