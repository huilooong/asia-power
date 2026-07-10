#!/usr/bin/env node
/**
 * Regenerate js/catalog-search-aliases.js from server/lib/vin/zh-en-seed.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'server/lib/vin/zh-en-seed.js'), 'utf8');
const start = src.indexOf('const MODEL_ZH_TO_EN = {');
const end = src.indexOf('};', start);
if (start < 0 || end < 0) throw new Error('MODEL_ZH_TO_EN not found');
const objSrc = src.slice(start + 'const MODEL_ZH_TO_EN = '.length, end + 1);
const MODEL_ZH_TO_EN = Function(`"use strict"; return (${objSrc});`)();

const flat = {};
for (const brand of Object.keys(MODEL_ZH_TO_EN)) {
  for (const [zh, en] of Object.entries(MODEL_ZH_TO_EN[brand])) {
    if (!flat[zh]) flat[zh] = en;
    if (/^[A-Za-z0-9]/.test(zh)) {
      const k = zh.toLowerCase();
      if (!flat[k]) flat[k] = en;
    }
  }
}
Object.assign(flat, {
  尚酷: 'Scirocco',
  霸道: 'Land Cruiser Prado',
  普拉多: 'Land Cruiser Prado',
  途安: 'Touran',
  凌渡: 'Lamando',
  狮跑: 'Sportage',
  五菱之光: 'Sunshine',
  pardo: 'Land Cruiser Prado',
  prado: 'Land Cruiser Prado',
});

const out = `/**
 * Auto-derived catalog search aliases (zh/en nicknames → English model).
 * Source: server/lib/vin/zh-en-seed.js + search extras. Do not hand-edit bulk;
 * regenerate: node scripts/build-catalog-search-aliases.mjs
 */
(function () {
  'use strict';
  window.AsiaPowerCatalogSearchAliases = ${JSON.stringify(flat, null, 2)};
})();
`;
writeFileSync(join(ROOT, 'js/catalog-search-aliases.js'), out);
console.log(`wrote js/catalog-search-aliases.js (${Object.keys(flat).length} aliases)`);
