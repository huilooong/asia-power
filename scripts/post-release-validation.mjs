#!/usr/bin/env node
/**
 * OPS-003 CLI — Post-Release Public Validation
 * Usage: node scripts/post-release-validation.mjs [--base-url=...] [--release-id=...] [--out-dir=...]
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mod = await import(pathToFileURL(path.join(here, 'lib/post-release-validation.mjs')).href);

const args = process.argv.slice(2);
const get = (k, def = '') => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const ROOT = path.resolve(here, '..');
const baseUrl = get('--base-url', process.env.SITE_URL || 'https://asia-power.com');
const releaseId = get('--release-id', '');
const outDir = path.resolve(ROOT, get('--out-dir', 'docs/tasks/ops-003'));

const report = await mod.runPublicPostReleaseValidation({ baseUrl, releaseId });
const purge = await mod.attemptCloudflarePurge({ baseUrl });
mod.writeValidationReports(outDir, report, purge);

console.log(`[ops-003] status=${report.status} pass=${report.pass_count} fail=${report.fail_count}`);
console.log(`[ops-003] purge=${purge.status}: ${purge.detail}`);
console.log(`[ops-003] reports → ${outDir}`);
for (const c of report.checks.filter((x) => x.status === 'fail')) {
  console.log(`  FAIL ${c.name}: ${c.detail}`);
}
process.exit(report.status === 'pass' ? 0 : 1);
