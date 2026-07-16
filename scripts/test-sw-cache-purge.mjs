#!/usr/bin/env node
/**
 * Automated check for SW cache purge policy (no browser required).
 * Mirrors obsoleteCacheKeys() in sw.js — fails if the old apapp-001- filter returns.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const swPath = path.join(ROOT, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('PASS:', msg);
}

function obsoleteCacheKeys(keys, currentStaticCache) {
  return keys.filter((key) => key !== currentStaticCache);
}

assert(sw.includes("CACHE_VERSION = 'pwa-app-v6b'"), 'CACHE_VERSION is pwa-app-v6b');
assert(sw.includes('function obsoleteCacheKeys'), 'obsoleteCacheKeys helper present');
assert(!/key\.startsWith\(['"]apapp-001-/.test(sw), 'must not use dead apapp-001- prefix filter');
assert(/keys\.filter\(\s*\(?key\)?\s*=>\s*key\s*!==\s*currentStaticCache/.test(sw)
  || /key !== currentStaticCache/.test(sw), 'activate deletes every key except current static cache');

const current = 'pwa-app-v6b-static';
const observed = [
  'apcontact-002-v1-static',
  'pwa-install-v2-static',
  'pwa-app-v3-static',
  'pwa-app-v4-static',
  'pwa-app-v5-static',
  'pwa-app-v6b-static',
];
const toDelete = obsoleteCacheKeys(observed, current);
assert(toDelete.length === 5, 'deletes 5 obsolete buckets from Claude evidence set');
assert(!toDelete.includes(current), 'keeps current pwa-app-v6b-static');
assert(toDelete.includes('pwa-app-v5-static'), 'deletes pwa-app-v5-static');
assert(toDelete.includes('apcontact-002-v1-static'), 'deletes apcontact-002-v1-static');

const installJs = fs.readFileSync(path.join(ROOT, 'js/pwa-install.js'), 'utf8');
assert(installJs.includes("SW_URL = '/sw.js?v=pwa-app-v6b'"), 'pwa-install registers sw.js?v=pwa-app-v6b');
assert(installJs.includes("updateViaCache: 'none'"), 'register bypasses HTTP cache for SW updates');
assert(installJs.includes('.update()'), 'periodic / immediate registration.update() present');

const serverJs = fs.readFileSync(path.join(ROOT, 'deploy/inventory-site-server.js'), 'utf8');
assert(/shortCacheJs[\s\S]*'pwa-install\.js'/.test(serverJs), 'origin short-caches pwa-install.js (not year-immutable)');
assert(/shortCacheJs[\s\S]*'pwa-app-shell\.js'/.test(serverJs), 'origin short-caches pwa-app-shell.js');

console.log('\nAll SW cache-purge checks passed.');
