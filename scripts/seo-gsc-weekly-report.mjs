#!/usr/bin/env node
/**
 * Build a weekly APSEO Search Console query tracking report from a GSC CSV export.
 *
 * Usage:
 *   node scripts/seo-gsc-weekly-report.mjs --csv exports/gsc.csv
 *   node scripts/seo-gsc-weekly-report.mjs --csv exports/gsc.csv --date 2026-07-16
 *   node scripts/seo-gsc-weekly-report.mjs --watchlist-only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WATCHLIST_PATH = path.join(ROOT, 'data/seo/gsc-query-watchlist.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'watchlist-only') {
      args.watchlistOnly = true;
      continue;
    }
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell || '').trim()));
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseNumber(value) {
  const raw = String(value || '').trim().replace(/,/g, '').replace(/%$/, '');
  if (!raw) return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function parseCtr(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const num = parseNumber(raw);
  return raw.includes('%') ? num / 100 : num;
}

function csvRecords(csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const rec = {};
    headers.forEach((header, i) => {
      rec[header] = row[i] || '';
    });
    const query = rec.query || rec.top_queries || rec.search_query || rec.queries || '';
    const page = rec.page || rec.pages || rec.landing_page || rec.url || '';
    const clicks = parseNumber(rec.clicks);
    const impressions = parseNumber(rec.impressions);
    const ctr = parseCtr(rec.ctr);
    const position = parseNumber(rec.position || rec.avg_position || rec.average_position);
    const date = rec.date || rec.day || '';
    return { query, page, clicks, impressions, ctr, position, date, raw: rec };
  }).filter((row) => row.query || row.page);
}

function normalizePage(raw, site) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value, site);
    return url.pathname;
  } catch {
    return value.startsWith('/') ? value.split('?')[0] : `/${value.split('?')[0]}`;
  }
}

function formatPct(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function avgPosition(rows) {
  const weighted = rows.reduce((sum, row) => sum + (row.position || 0) * (row.impressions || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (row.impressions || 0), 0);
  return impressions ? weighted / impressions : 0;
}

function detectCoveredQuery(query, targetQueries) {
  const q = String(query || '').toLowerCase();
  return targetQueries.some((target) => {
    const terms = String(target || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return false;
    return terms.every((term) => q.includes(term));
  });
}

function buildReport({ args, watchlist, records }) {
  const today = args.date || new Date().toISOString().slice(0, 10);
  const site = watchlist.site || 'https://asia-power.com';
  const out = [];
  const normalized = records.map((row) => ({ ...row, normalizedPage: normalizePage(row.page, site) }));
  const tracked = watchlist.trackedPages || [];
  const trackedPaths = new Set(tracked.map((page) => page.page));
  const trackedRows = normalized.filter((row) => trackedPaths.has(row.normalizedPage));
  const totalClicks = trackedRows.reduce((sum, row) => sum + row.clicks, 0);
  const totalImpressions = trackedRows.reduce((sum, row) => sum + row.impressions, 0);
  const reportStatus = args.watchlistOnly ? 'watchlist baseline' : 'GSC CSV analysis';

  out.push(`# APSEO Search Console Weekly Query Report - ${today}`);
  out.push('');
  out.push(`Status: ${reportStatus}`);
  out.push(`Watchlist: \`${path.relative(ROOT, WATCHLIST_PATH)}\``);
  if (args.csv) out.push(`Source CSV: \`${path.relative(ROOT, path.resolve(args.csv))}\``);
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(`- CSV rows reviewed: ${records.length}`);
  out.push(`- Tracked landing-page rows: ${trackedRows.length}`);
  out.push(`- Tracked clicks: ${totalClicks}`);
  out.push(`- Tracked impressions: ${totalImpressions}`);
  out.push(`- Tracked average CTR: ${totalImpressions ? formatPct(totalClicks / totalImpressions) : '0.00%'}`);
  out.push(`- Tracked weighted average position: ${avgPosition(trackedRows).toFixed(1)}`);
  out.push('');

  out.push('## Watchlist Coverage');
  out.push('');
  out.push('| Page | Segment | Market | Clicks | Impressions | CTR | Avg position | Target query seen | Next action |');
  out.push('| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |');
  tracked.forEach((page) => {
    const rows = trackedRows.filter((row) => row.normalizedPage === page.page);
    const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const targetSeen = rows.some((row) => detectCoveredQuery(row.query, page.targetQueries || []));
    out.push(`| \`${page.page}\` | ${page.segment} | ${page.market} | ${clicks} | ${impressions} | ${impressions ? formatPct(clicks / impressions) : '0.00%'} | ${avgPosition(rows).toFixed(1)} | ${targetSeen ? 'yes' : 'no'} | ${page.nextActionIfSeen} |`);
  });
  out.push('');

  const rules = watchlist.reviewRules || {};
  const ctrRule = rules.highImpressionsLowCtr || { minImpressions: 50, maxCtr: 0.01 };
  const rankRule = rules.rankingOpportunity || { minPosition: 8, maxPosition: 20 };
  const newQueryRule = rules.newQueryCandidate || { minImpressions: 20 };
  const highImpressionsLowCtr = trackedRows
    .filter((row) => row.impressions >= ctrRule.minImpressions && row.ctr <= ctrRule.maxCtr)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
  const rankingOpportunities = trackedRows
    .filter((row) => row.position >= rankRule.minPosition && row.position <= rankRule.maxPosition)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
  const newQueryCandidates = trackedRows
    .filter((row) => row.impressions >= newQueryRule.minImpressions)
    .filter((row) => {
      const page = tracked.find((entry) => entry.page === row.normalizedPage);
      return page && !detectCoveredQuery(row.query, page.targetQueries || []);
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  function addRows(title, rows, emptyText) {
    out.push(`## ${title}`);
    out.push('');
    if (!rows.length) {
      out.push(emptyText);
      out.push('');
      return;
    }
    out.push('| Query | Page | Clicks | Impressions | CTR | Position |');
    out.push('| --- | --- | ---: | ---: | ---: | ---: |');
    rows.forEach((row) => {
      out.push(`| ${row.query || '(page-only row)'} | \`${row.normalizedPage || row.page}\` | ${row.clicks} | ${row.impressions} | ${formatPct(row.ctr)} | ${row.position.toFixed(1)} |`);
    });
    out.push('');
  }

  addRows('High Impressions, Low CTR', highImpressionsLowCtr, 'No tracked rows crossed the low-CTR threshold.');
  addRows('Ranking Opportunities', rankingOpportunities, 'No tracked rows were in positions 8-20.');
  addRows('New Query Candidates', newQueryCandidates, 'No new query candidates crossed the minimum impression threshold.');

  const missingRows = tracked.filter((page) => !trackedRows.some((row) => row.normalizedPage === page.page));
  out.push('## Pages With No GSC Rows In This Export');
  out.push('');
  if (missingRows.length) {
    missingRows.forEach((page) => out.push(`- \`${page.page}\` (${page.segment}, ${page.market})`));
  } else {
    out.push('All tracked pages appeared in this export.');
  }
  out.push('');

  out.push('## Required Weekly Actions');
  out.push('');
  out.push('- Review at least 20 query/page rows when data volume allows.');
  out.push('- Pick at least 5 page actions: title/meta rewrite, FAQ expansion, internal links, page split, or sitemap/indexing check.');
  out.push('- Save this report under `docs/reports/seo/` and link follow-up code/content changes in the next APSEO execution report.');
  out.push('- Do not claim indexing or ranking improvements unless confirmed in GSC.');
  out.push('');

  return out.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.csv && !args.watchlistOnly) {
    console.error('Usage: node scripts/seo-gsc-weekly-report.mjs --csv path/to/gsc.csv [--date YYYY-MM-DD]');
    console.error('       node scripts/seo-gsc-weekly-report.mjs --watchlist-only');
    process.exit(1);
  }

  const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
  const records = args.csv ? csvRecords(path.resolve(args.csv)) : [];
  const date = args.date || new Date().toISOString().slice(0, 10);
  const outPath = path.resolve(args.out || path.join(ROOT, 'docs/reports/seo', `gsc-weekly-${date}.md`));
  const report = buildReport({ args: { ...args, date }, watchlist, records });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report);
  console.log(`[seo-gsc] wrote ${path.relative(ROOT, outPath)}`);
}

main();
