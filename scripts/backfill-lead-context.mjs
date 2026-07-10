#!/usr/bin/env node
/**
 * Backfill inquiry context fields on stored leads.
 * Usage: node scripts/backfill-lead-context.mjs [path/to/contact-leads.json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const target = process.argv[2] || path.join(ROOT, 'data', 'contact-leads.json');

const leadContextCandidates = [
  path.join(ROOT, 'server', 'lib', 'lead-context.js'),
  path.join(ROOT, 'lib', 'lead-context.js'),
];
const leadContextPath = leadContextCandidates.find((p) => fs.existsSync(p));
if (!leadContextPath) {
  console.error('[backfill-lead-context] lead-context.js not found');
  process.exit(1);
}

const { enrichLeadFields } = await import(pathToFileURL(leadContextPath).href);

if (!fs.existsSync(target)) {
  console.error(`[backfill-lead-context] file not found: ${target}`);
  process.exit(1);
}

const raw = fs.readFileSync(target, 'utf8');
const leads = JSON.parse(raw);
if (!Array.isArray(leads)) {
  console.error('[backfill-lead-context] expected JSON array');
  process.exit(1);
}

const backup = `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(target, backup);
console.log(`[backfill-lead-context] backup → ${backup}`);

let changed = 0;
const next = leads.map((lead) => {
  const enriched = enrichLeadFields(lead);
  const same = JSON.stringify(enriched) === JSON.stringify(lead);
  if (!same) changed += 1;
  return enriched;
});

fs.writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`);
console.log(`[backfill-lead-context] updated ${changed}/${leads.length} leads in ${target}`);

const mark = next.find((lead) => lead.id === 'lead-abafc4dc34de');
if (mark) {
  console.log('[backfill-lead-context] Mark Finley sample:');
  console.log(`  inquirySubject: ${mark.inquirySubject}`);
  console.log(`  replySubject: ${mark.replySubject}`);
  console.log(`  pageUrl: ${mark.pageUrl}`);
  console.log(`  product: ${mark.product}`);
}
