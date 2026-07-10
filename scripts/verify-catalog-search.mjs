#!/usr/bin/env node
/**
 * Regression: Available catalog must be findable by stockId / model / engine / CN aliases / VIN.
 * Usage: node scripts/verify-catalog-search.mjs [--base https://asia-power.com]
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : (process.env.SITE_URL || 'https://asia-power.com');

function loadAliases() {
  const src = readFileSync(join(ROOT, 'js/catalog-search-aliases.js'), 'utf8');
  const m = src.match(/window\.AsiaPowerCatalogSearchAliases\s*=\s*(\{[\s\S]*\});/);
  if (!m) return {};
  return JSON.parse(m[1]);
}

function normalizeStockIdQuery(query) {
  return String(query || '').trim().toUpperCase();
}

function isStockIdQuery(query) {
  const q = normalizeStockIdQuery(query);
  if (!q) return false;
  if (/^(HC|UV)\d{3,}$/i.test(q)) return true;
  return /^\d{4,}$/.test(q);
}

function stockIdDigits(stockId) {
  const sid = String(stockId || '').trim().toUpperCase();
  const m = sid.match(/^(?:HC|UV)?(\d+)$/i);
  return m ? m[1] : '';
}

function matchesStockId(item, query) {
  const q = normalizeStockIdQuery(query);
  if (!q) return false;
  const sid = String(item?.stockId || '').trim().toUpperCase();
  if (!sid) return false;
  if (sid === q) return true;
  const digits = stockIdDigits(sid);
  if (!digits) return false;
  if (/^\d+$/.test(q)) {
    if (digits === q) return true;
    if (q.length >= 4 && digits.endsWith(q)) return true;
    return false;
  }
  if (/^(HC|UV)\d+$/i.test(q)) {
    return digits === q.replace(/^(HC|UV)/i, '');
  }
  return false;
}

function normalizeCatalogSearch(value) {
  return String(value || '').toLowerCase().replace(/[\s-/]+/g, '');
}

function buildCatalogSearchHaystack(item) {
  return [
    item?.stockId,
    item?.brand,
    item?.brandSlug,
    item?.model,
    item?.engineCode,
    item?.transmissionCode,
    item?.gearboxModel,
    item?.title,
    item?.originalVehicleName,
    item?.shortDescription,
    item?.vin,
    item?.maskedVin,
    item?.slug,
    item?.fuelType,
  ]
    .map((v) => String(v || ''))
    .join(' ')
    .toLowerCase();
}

function expandCatalogSearchTerms(query, aliases) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const terms = new Set([raw, raw.toLowerCase()]);
  const direct = aliases[raw] || aliases[raw.toLowerCase()];
  if (direct) {
    terms.add(direct);
    terms.add(String(direct).toLowerCase());
  }
  Object.keys(aliases).forEach((zh) => {
    if (!/[\u4e00-\u9fff]/.test(zh)) return;
    if (zh.length >= 2 && raw.includes(zh)) {
      const en = aliases[zh];
      if (en) {
        terms.add(en);
        terms.add(String(en).toLowerCase());
      }
    }
  });
  return [...terms];
}

function matchesCatalogSearch(item, query, aliases) {
  if (!query) return true;
  if (isStockIdQuery(query) && matchesStockId(item, query)) return true;
  const hay = buildCatalogSearchHaystack(item);
  const hayN = normalizeCatalogSearch(hay);
  for (const term of expandCatalogSearchTerms(query, aliases)) {
    const t = String(term || '').toLowerCase().trim();
    if (!t) continue;
    if (hay.includes(t)) return true;
    const tn = normalizeCatalogSearch(t);
    if (tn.length >= 4 && hayN.includes(tn)) return true;
  }
  return false;
}

function isExportableUsedCarItem(item) {
  if (!item) return false;
  if (item.vehicleCategory === 'truck' || item.vehicleCategory === 'machinery') return false;
  if (item.isExportUsedCar === true) return true;
  const notes = String(item.notes || '');
  if (/可整车|有手续|手续齐全|可出口/.test(notes.replace(/\s+/g, ''))) return true;
  return false;
}

function categoryOf(item) {
  if (item.vehicleCategory === 'truck') return 'trucks';
  if (item.vehicleCategory === 'machinery' || String(item.machineryType || '').trim()) return 'machinery';
  if (isExportableUsedCarItem(item)) return 'used-cars';
  return 'halfcuts';
}

async function main() {
  const aliases = loadAliases();
  const res = await fetch(`${BASE}/api/half-cuts/public`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'AsiaPower-verify-catalog-search/1.0' },
  });
  if (!res.ok) throw new Error(`public API ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.approved) ? data.approved : [];
  const available = items.filter((i) => String(i.status || '').toLowerCase() === 'available');

  const focusQueries = [
    { q: '250551', expect: 'HC250551' },
    { q: 'HC250551', expect: 'HC250551' },
    { q: 'HC250546', expect: 'HC250546' },
    { q: 'Scirocco', expect: 'HC250552' },
    { q: '尚酷', expect: 'HC250552' },
    { q: '霸道', expect: 'HC250551' },
    { q: 'Prado', expect: 'HC250551' },
    { q: 'CDL', expect: 'HC250552' },
  ];

  const focus = {};
  const focusFail = [];
  for (const { q, expect } of focusQueries) {
    const hits = available.filter((i) => matchesCatalogSearch(i, q, aliases)).map((i) => i.stockId);
    focus[q] = hits;
    if (!hits.includes(expect)) focusFail.push({ q, expect, hits: hits.slice(0, 8) });
  }

  const misses = [];
  let checks = 0;
  let passes = 0;
  for (const item of available) {
    const sid = String(item.stockId || '').toUpperCase();
    const model = String(item.model || '').trim();
    const eng = String(item.engineCode || '').trim();
    const brand = String(item.brand || '').trim();
    const vin = String(item.vin || '').trim();
    const queries = [];
    if (/^(HC|UV)\d+$/i.test(sid)) {
      queries.push(['stockId', sid]);
      const digits = stockIdDigits(sid);
      if (digits.length >= 4) queries.push(['digits', digits]);
    }
    if (model) queries.push(['model', model]);
    if (eng) queries.push(['engine', eng]);
    if (brand) queries.push(['brand', brand]);
    if (vin.length >= 6) queries.push(['vin6', vin.slice(-6)]);

    for (const [kind, q] of queries) {
      checks += 1;
      const hits = available.filter((i) => matchesCatalogSearch(i, q, aliases));
      if (!hits.some((h) => String(h.stockId).toUpperCase() === sid)) {
        misses.push({ stockId: sid, kind, q, category: categoryOf(item) });
      } else {
        passes += 1;
      }
    }
  }

  // Cross-category: non-halfcuts must still be findable (simulates header → /half-cuts/?q=)
  const outside = available.filter((i) => categoryOf(i) !== 'halfcuts');
  const crossMiss = [];
  for (const item of outside) {
    const sid = String(item.stockId || '');
    const model = String(item.model || '').trim();
    for (const q of [sid, model].filter(Boolean)) {
      const hits = available.filter((i) => matchesCatalogSearch(i, q, aliases));
      if (!hits.some((h) => h.stockId === item.stockId)) {
        crossMiss.push({ stockId: item.stockId, q, category: categoryOf(item) });
      }
    }
  }

  const passRate = checks ? +(100 * passes / checks).toFixed(2) : 0;
  const report = {
    base: BASE,
    totalApproved: items.length,
    available: available.length,
    aliasCount: Object.keys(aliases).length,
    focus,
    focusFail,
    checks,
    passes,
    passRate,
    missCount: misses.length,
    missSample: misses.slice(0, 25),
    outsideHalfcuts: outside.length,
    crossMissCount: crossMiss.length,
    crossMissSample: crossMiss.slice(0, 15),
  };

  console.log(JSON.stringify(report, null, 2));
  if (focusFail.length || misses.length || crossMiss.length) {
    console.error('VERIFY FAILED');
    process.exit(1);
  }
  console.log(`VERIFY OK — catalog search ${passRate}% (${passes}/${checks})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
