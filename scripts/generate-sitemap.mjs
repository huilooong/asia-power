#!/usr/bin/env node
/**
 * Write sitemap.xml from static pages + data/half-cut-approved.json (local/dev backup).
 * Production serves a dynamic sitemap from the Node server — run this after bulk content changes if needed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const sitemapPath = path.join(ROOT, 'server/lib/sitemap.js');

const { buildSitemapXml } = await import(pathToFileURL(sitemapPath).href);

const approvedFile = path.join(ROOT, 'data/half-cut-approved.json');
let approved = [];
if (fs.existsSync(approvedFile)) {
  approved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
}

const xml = buildSitemapXml({
  siteUrl: process.env.SITE_URL || 'https://asia-power.com',
  publicDir: ROOT,
  approved,
});

const out = path.join(ROOT, 'sitemap.xml');
fs.writeFileSync(out, xml);
console.log(`[sitemap] wrote ${out} (${approved.filter(i => i?.slug && i.status !== 'Sold').length} half-cut URLs)`);
