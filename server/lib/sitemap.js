/**
 * Dynamic sitemap.xml — merges static site pages with live approved half-cut inventory.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CORE_PAGES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/brands.html', changefreq: 'weekly', priority: '0.9' },
  { loc: '/contact.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/supplier-portal.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/about.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/engines/', changefreq: 'weekly', priority: '0.8' },
  { loc: '/gearboxes/', changefreq: 'weekly', priority: '0.7' },
  { loc: '/chassis-parts/', changefreq: 'weekly', priority: '0.7' },
  { loc: '/half-cuts/', changefreq: 'daily', priority: '0.8' },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || 'https://asia-power.com').replace(/\/$/, '');
}

function listHtmlPaths(publicDir, subdir, priority, changefreq) {
  const dir = path.join(publicDir, subdir);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.html') && name !== 'index.html')
    .sort()
    .map(name => ({
      loc: `/${subdir}/${name}`,
      changefreq,
      priority,
    }));
}

function halfCutEntries(approved, lastmod) {
  return (approved || [])
    .filter(item => item?.slug && item.status !== 'Sold')
    .map(item => ({
      loc: `/half-cuts/detail.html?slug=${encodeURIComponent(item.slug)}`,
      changefreq: 'weekly',
      priority: '0.65',
      lastmod: item.approvedAt || item.updatedAt || lastmod,
    }));
}

function buildSitemapXml({ siteUrl, publicDir, approved = [] }) {
  const base = normalizeSiteUrl(siteUrl);
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    ...CORE_PAGES,
    ...listHtmlPaths(publicDir, 'brands', '0.75', 'weekly'),
    ...listHtmlPaths(publicDir, 'engines', '0.65', 'monthly'),
    ...halfCutEntries(approved, today),
  ];

  const body = entries.map(entry => {
    const loc = `${base}${entry.loc.startsWith('/') ? entry.loc : `/${entry.loc}`}`;
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(String(entry.lastmod).slice(0, 10))}</lastmod>` : '';
    return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function sendSitemap(res, xml) {
  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(xml);
}

module.exports = {
  buildSitemapXml,
  sendSitemap,
  CORE_PAGES,
};
