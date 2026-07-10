#!/usr/bin/env node
/**
 * Write a local dev snapshot of sitemap.xml (not deployed — production uses Node GET /sitemap.xml).
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

const out = path.join(ROOT, 'docs/dev-sitemap.xml');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, xml);
const urlCount = (xml.match(/<loc>/g) || []).length;
console.log(`[sitemap] wrote ${out} (${urlCount} URLs, dev snapshot only)`);
