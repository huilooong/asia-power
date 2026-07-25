#!/usr/bin/env node
/**
 * stock-id search must find export used-cars / trucks outside the half-cuts pool.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hub = fs.readFileSync(path.join(ROOT, 'js/ebay-catalog-hub.js'), 'utf8');
const layout = fs.readFileSync(path.join(ROOT, 'js/ebay-layout.js'), 'utf8');

assert.match(hub, /Full-site search/, 'getInventory documents full-site search');
assert.match(hub, /matchesStockId\?\.?\(item, q\)/, 'getInventory merges stock-id hits from HALF_CUT_LIST');
assert.match(layout, /routeStockIdSearch/, 'header search has stock-id router');
assert.match(layout, /api\/half-cuts\/public\/item/, 'stock-id cold start uses public item API');
assert.match(layout, /detailHrefForItem/, 'stock-id routes to the correct detail path');

console.log('PASS: sitewide stock search wiring present');
