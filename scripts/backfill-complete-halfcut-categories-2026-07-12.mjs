#!/usr/bin/env node
/**
 * Mark verified complete passenger half-cuts for four-category derived display.
 *
 * This does not create SKUs or change stock/quantity/price. The same stockId is
 * rendered in front-cut, engine, gearbox, and chassis catalogs.
 *
 * Default is dry-run. Use --apply only after reviewing the plan.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'ceo-approved-complete-halfcut-four-category-2026-07-12';
const CHASSIS_ASSEMBLY = 'Front subframe, suspension & steering assembly';
const CRITICAL_MISSING_RE = /(?:missing|without|removed|not included)\s+(?:the\s+)?(?:engine|gearbox|transmission|front clip|subframe|suspension|steering)|(?:engine|gearbox|transmission|front clip|subframe|suspension|steering)\s+(?:missing|removed|not included)|(?:缺失|缺少|不含|拆除|无)(?:发动机|变速箱|前切|车头|副车架|悬挂|转向)|(?:发动机|变速箱|前切|车头|副车架|悬挂|转向)(?:缺失|缺少|不含|拆除)/i;

function parseArgs(argv) {
  const args = { root: ROOT, apply: false, expected: 398 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) args.root = path.resolve(argv[++i]);
    else if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--expected' && argv[i + 1]) args.expected = Number(argv[++i]);
    else if (argv[i] === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
  }
  return args;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function stockId(row) {
  return String(row?.stockId || row?.approvedStockId || '').trim().toUpperCase();
}

function isCandidate(row) {
  return !String(row?.passengerPartType || '').trim()
    && String(row?.vehicleCondition || '').trim().toLowerCase() === 'half cut'
    && Boolean(String(row?.engineCode || '').trim())
    && Boolean(String(row?.transmissionCode || '').trim());
}

function evidenceText(row) {
  return [
    row?.title,
    row?.shortDescription,
    row?.notes,
    row?.remark,
    row?.remarkZh,
    row?.remarkEn,
    ...(Array.isArray(row?.includedParts) ? row.includedParts : []),
  ].filter(Boolean).join(' ');
}

function immutableFingerprint(rows) {
  const protectedState = rows.map((row) => ({
    stockId: stockId(row),
    priceUsd: row.priceUsd,
    quantity: row.quantity,
    quantityUnits: row.quantityUnits,
    sellableQty: row.sellableQty,
    status: row.status,
  }));
  return crypto.createHash('sha256').update(JSON.stringify(protectedState)).digest('hex');
}

function patchComplete(row, now) {
  const parts = Array.isArray(row.includedParts) ? [...row.includedParts] : [];
  if (!parts.some((part) => String(part).trim().toLowerCase() === CHASSIS_ASSEMBLY.toLowerCase())) {
    parts.push(CHASSIS_ASSEMBLY);
  }
  return {
    ...row,
    includedParts: parts,
    halfCutCompleteness: 'complete',
    halfCutCategoryVisibility: ['frontcuts', 'engines', 'gearboxes', 'chassis'],
    halfCutCompletenessSource: SOURCE,
    halfCutCompletenessVerifiedAt: now,
    updatedAt: now,
  };
}

function unpatchExcluded(row, now) {
  if (row.halfCutCompletenessSource !== SOURCE) return row;
  const next = {
    ...row,
    includedParts: (Array.isArray(row.includedParts) ? row.includedParts : [])
      .filter((part) => String(part).trim().toLowerCase() !== CHASSIS_ASSEMBLY.toLowerCase()),
    updatedAt: now,
  };
  delete next.halfCutCompleteness;
  delete next.halfCutCategoryVisibility;
  delete next.halfCutCompletenessSource;
  delete next.halfCutCompletenessVerifiedAt;
  return next;
}

function main() {
  const args = parseArgs(process.argv);
  const dataDir = path.join(args.root, 'data');
  const approvedFile = path.join(dataDir, 'half-cut-approved.json');
  const submissionsFile = path.join(dataDir, 'half-cut-submissions.json');
  const approved = loadJson(approvedFile);
  const submissions = fs.existsSync(submissionsFile) ? loadJson(submissionsFile) : [];
  const candidates = approved.filter(isCandidate);

  if (candidates.length !== args.expected) {
    throw new Error(`Candidate count ${candidates.length} does not match approved scope ${args.expected}`);
  }

  const exclusions = candidates.flatMap((row) => {
    if (row.isExportUsedCar === true) {
      return [{ stockId: stockId(row), reason: 'record is explicitly classified as export used car' }];
    }
    if (CRITICAL_MISSING_RE.test(evidenceText(row))) {
      return [{ stockId: stockId(row), reason: 'critical powertrain/front-structure missing evidence' }];
    }
    return [];
  });
  const excludedIds = new Set(exclusions.map((row) => row.stockId));
  const eligibleIds = new Set(
    candidates.map(stockId).filter((id) => id && !excludedIds.has(id)),
  );
  const alreadyComplete = candidates.filter(
    (row) => String(row.halfCutCompleteness || '').toLowerCase() === 'complete',
  ).length;
  const beforeFingerprint = immutableFingerprint(approved);
  const now = new Date().toISOString();
  const nextApproved = approved.map((row) => {
    if (eligibleIds.has(stockId(row))) return patchComplete(row, now);
    if (excludedIds.has(stockId(row))) return unpatchExcluded(row, now);
    return row;
  });
  const nextSubmissions = submissions.map((row) => {
    if (eligibleIds.has(stockId(row))) return patchComplete(row, now);
    if (excludedIds.has(stockId(row))) return unpatchExcluded(row, now);
    return row;
  });

  const afterFingerprint = immutableFingerprint(nextApproved);
  if (beforeFingerprint !== afterFingerprint) {
    throw new Error('Protected price/quantity/status fields changed; refusing backfill');
  }
  if (nextApproved.length !== approved.length) {
    throw new Error('Inventory row count changed; refusing backfill');
  }

  const outsideScopeDedicated = approved.filter(
    (row) => Boolean(String(row.passengerPartType || '').trim()),
  ).length;
  const report = {
    ok: true,
    dryRun: !args.apply,
    generatedAt: now,
    source: SOURCE,
    inventoryRowsBefore: approved.length,
    inventoryRowsAfter: nextApproved.length,
    candidateCount: candidates.length,
    eligibleCount: eligibleIds.size,
    excludedCount: exclusions.length,
    alreadyComplete,
    changedApproved: nextApproved.reduce(
      (count, row, index) => count + (row !== approved[index] ? 1 : 0),
      0,
    ),
    changedSubmissions: nextSubmissions.reduce(
      (count, row, index) => count + (row !== submissions[index] ? 1 : 0),
      0,
    ),
    outsideScopeDedicated,
    exclusions,
    protectedFingerprint: beforeFingerprint,
    stockIds: [...eligibleIds],
  };

  const outFile = args.out || path.join(
    args.root,
    'reports',
    'complete-halfcut-four-category-backfill-2026-07-12.json',
  );

  if (args.apply) {
    const stamp = now.replace(/[:.]/g, '-');
    const backupDir = path.join(dataDir, 'backups', `complete-halfcut-four-category-${stamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(approvedFile, path.join(backupDir, 'half-cut-approved.json'));
    if (fs.existsSync(submissionsFile)) {
      fs.copyFileSync(submissionsFile, path.join(backupDir, 'half-cut-submissions.json'));
    }
    saveJsonAtomic(approvedFile, nextApproved);
    if (fs.existsSync(submissionsFile)) saveJsonAtomic(submissionsFile, nextSubmissions);
    report.backupDir = backupDir;
  }

  saveJsonAtomic(outFile, report);
  console.log(JSON.stringify({ ...report, stockIds: undefined, outFile }, null, 2));
}

main();
