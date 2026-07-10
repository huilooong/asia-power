#!/usr/bin/env node
/**
 * Regression: stock ID search must find Available listings across categories.
 * Usage: node scripts/verify-stock-id-search.mjs [--base https://asia-power.com]
 */
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : (process.env.SITE_URL || 'https://asia-power.com');

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
  const res = await fetch(`${BASE}/api/half-cuts/public`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`public API ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.approved) ? data.approved : [];
  const available = items.filter((i) => String(i.status || '').toLowerCase() === 'available');

  const focus = ['250551', 'HC250551', 'hc250551'];
  const focusHits = {};
  for (const q of focus) {
    focusHits[q] = available.filter((i) => matchesStockId(i, q)).map((i) => i.stockId);
  }

  // Every Available HC/UV stock must be findable by full ID and by numeric body
  const misses = [];
  const sampleOk = [];
  for (const item of available) {
    const sid = String(item.stockId || '').toUpperCase();
    if (!/^(HC|UV)\d+$/i.test(sid)) continue;
    const digits = stockIdDigits(sid);
    const queries = [sid, sid.toLowerCase(), digits];
    for (const q of queries) {
      if (!isStockIdQuery(q)) {
        misses.push({ stockId: sid, q, reason: 'not recognized as stock query' });
        continue;
      }
      const hits = available.filter((i) => matchesStockId(i, q));
      if (!hits.some((h) => String(h.stockId).toUpperCase() === sid)) {
        misses.push({ stockId: sid, q, reason: 'no hit', category: categoryOf(item) });
      }
    }
    if (sampleOk.length < 12) sampleOk.push({ stockId: sid, category: categoryOf(item), digits });
  }

  // Cross-category: stock IDs that live outside halfcuts must still match digit query
  const outsideHalfcuts = available.filter((i) => categoryOf(i) !== 'halfcuts' && /^(HC|UV)\d+$/i.test(i.stockId || ''));
  const crossMiss = [];
  for (const item of outsideHalfcuts) {
    const digits = stockIdDigits(item.stockId);
    const hits = available.filter((i) => matchesStockId(i, digits));
    if (!hits.some((h) => h.stockId === item.stockId)) {
      crossMiss.push(item.stockId);
    }
  }

  const okFocus = focus.every((q) => (focusHits[q] || []).includes('HC250551'));
  const report = {
    base: BASE,
    totalApproved: items.length,
    available: available.length,
    outsideHalfcuts: outsideHalfcuts.length,
    focusHits,
    focusOk: okFocus,
    missCount: misses.length,
    crossMissCount: crossMiss.length,
    crossMissSample: crossMiss.slice(0, 20),
    sampleOk,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!okFocus || misses.length || crossMiss.length) {
    console.error('VERIFY FAILED');
    process.exit(1);
  }
  console.log('VERIFY OK — stock ID search covers all Available HC/UV listings');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
