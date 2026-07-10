#!/usr/bin/env node
/**
 * Crawl local HTML + check links against production base URL.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'https://asia-power.com').replace(/\/$/, '');
const SKIP_DIRS = new Set(['node_modules', '.venv', '.venv-faces', '.venv-qxb', 'deploy', 'backups', 'docs', '.git']);

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function extractLinks(html) {
  const links = new Set();
  const re = /(?:href|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    if (raw.startsWith('data:')) continue;
    links.add(raw);
  }
  return [...links];
}

function resolveUrl(link, fromFile) {
  if (link.startsWith('http://') || link.startsWith('https://')) {
    if (!link.includes('asia-power.com') && !link.includes('aspowe.com')) return null;
    return link.split('#')[0];
  }
  if (link.startsWith('//')) return `https:${link.split('#')[0]}`;
  const relDir = path.dirname(fromFile.replace(ROOT + path.sep, ''));
  let p = link.split('#')[0].split('?')[0];
  if (p.startsWith('/')) return `${BASE}${p}`;
  const joined = path.posix.normalize(path.posix.join(relDir.split(path.sep).join('/'), p));
  return `${BASE}/${joined}`.replace(/\/+/g, '/').replace('https:/', 'https://');
}

async function check(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    return { url, status: res.status, ok: res.status < 400 };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

const htmlFiles = walkHtml(ROOT);
const urlMap = new Map();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const link of extractLinks(html)) {
    const abs = resolveUrl(link, file);
    if (!abs) continue;
    if (!urlMap.has(abs)) urlMap.set(abs, []);
    urlMap.get(abs).push(path.relative(ROOT, file));
  }
}

const urls = [...urlMap.keys()].sort();
console.log(`[audit-links] ${urls.length} unique internal URLs from ${htmlFiles.length} HTML files`);
const broken = [];
const slow = [];
let i = 0;
for (const url of urls) {
  i += 1;
  const t0 = Date.now();
  const result = await check(url);
  const ms = Date.now() - t0;
  if (!result.ok) broken.push({ ...result, sources: urlMap.get(url), ms });
  else if (ms > 2000) slow.push({ url, status: result.status, ms, sources: urlMap.get(url) });
  if (i % 20 === 0) process.stderr.write(`  checked ${i}/${urls.length}\n`);
}

console.log('\n=== BROKEN LINKS ===');
if (!broken.length) console.log('  (none)');
else for (const b of broken) {
  console.log(`  [${b.status || 'ERR'}] ${b.url}${b.error ? ` (${b.error})` : ''}`);
  console.log(`    from: ${b.sources.slice(0, 3).join(', ')}${b.sources.length > 3 ? '…' : ''}`);
}

console.log('\n=== SLOW (>2s) ===');
if (!slow.length) console.log('  (none)');
else for (const s of slow.sort((a, b) => b.ms - a.ms).slice(0, 15)) {
  console.log(`  [${s.status}] ${s.ms}ms ${s.url}`);
}

console.log(`\n[audit-links] done: ${broken.length} broken, ${slow.length} slow`);
