#!/usr/bin/env node
/**
 * Release Manager (OPS-005) — pre/post validation, release.json, recovery metadata.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  runPublicPostReleaseValidation,
  attemptCloudflarePurge,
  writeValidationReports,
  stampReleaseIdIntoConfig,
} from './post-release-validation.mjs';
import { checkCacheBustConsistency } from './cache-bust-check.mjs';

export const VALID_TARGETS = ['nginx', 'api', 'engines', 'apsales', 'apsales-openclaw', 'finalize', 'home', 'portal', 'chrome', 'categories', 'admin'];

/** @type {Record<string, string[]>} */
export const TARGET_SOURCE_FILES = {
  categories: [
    'index.html',
    'half-cuts/index.html',
    'engines/index.html',
    'gearboxes/index.html',
    'front-cuts/index.html',
    'chassis-parts/index.html',
    'js/half-cut-directory.js',
    'js/ebay-catalog-hub.js',
    'js/home-v4-hybrid.js',
  ],
  home: [
    'index.html',
    'css/home-v4-hybrid.css',
    'css/styles.css',
    'js/home-v4-hybrid.js',
    'js/components.js',
    'sw.js',
    'assets/home-v4-inventory-snapshot.json',
  ],
  portal: [
    'login/index.html',
    'css/login.css',
    'css/portal-app.css',
    'js/login.js',
    'js/buyer-portal.js',
    'js/supplier-dashboard.js',
    'js/v4-portal-shell.js',
    'js/main.js',
    'buyer-portal/index.html',
    'supplier-portal/dashboard.html',
    'supplier-portal.html',
  ],
  chrome: [
    'js/components.js',
    'js/config.js',
    'js/main.js',
    'js/public-i18n.js',
    'js/ebay-layout.js',
    'js/half-cut-directory.js',
    'js/ebay-catalog-hub.js',
    'css/ebay-layout.css',
    'css/styles.css',
    'half-cuts/index.html',
    'half-cuts/detail.html',
    'trucks/index.html',
    'trucks/detail.html',
    'machinery/index.html',
    'machinery/detail.html',
    'engines/index.html',
    'engines/ghana-used-engines-from-china.html',
    'engines/toyota-engines-for-ghana-importers.html',
    'engines/nigeria-used-engines-from-china.html',
    'engines/hyundai-kia-engines-for-nigeria-importers.html',
    'gearboxes/index.html',
    'front-cuts/index.html',
    'chassis-parts/index.html',
    'guides/index.html',
    'guides/buying-used-engines-from-china.html',
    'guides/fob-vs-cif-shipping-guide.html',
    'about.html',
    'contact.html',
    'ghana.html',
    'nigeria.html',
    'brands.html',
  ],
  admin: [
    'css/admin-v4.css',
    'js/components.js',
    'js/admin-common.js',
    'js/admin-inventory.js',
    'js/admin-inventory-hub.js',
    'js/admin-analytics.js',
    'js/admin-leads.js',
    'js/admin-apsales-progress.js',
    'admin/inventory.html',
    'admin/analytics.html',
    'admin/leads.html',
    'admin/apsales-progress.html',
  ],
  nginx: [
    'deploy/nginx-rate-limit.conf',
    'deploy/nginx-asia-power.com',
    'deploy/nginx-security.conf',
    'deploy/asiapower-trusted-upload-ips.map.example',
  ],
  api: [
    'deploy/inventory-site-server.js',
    'deploy/inventory-site.service',
    'deploy/health-watch.sh',
    'package.json',
    'package-lock.json',
    'server/lib',
  ],
  engines: ['engines'],
  apsales: [
    'scripts/apsales-growth-autopilot.py',
    'scripts/apsales-social-reply-watch.py',
    'scripts/apsales-record-distribution-action.py',
    'scripts/apsales-distribution-daily-digest.py',
    'scripts/apsales-maps-leads-run.py',
    'scripts/run-coach-llm-audit.py',
    'scripts/run-coach-structured.py',
    'scripts/run-coach-plan-completion-watch.py',
    'sales_coach',
    'coo_core/approval_gate.py',
    'coo_core/dispatcher.py',
    'docs/zijing-training/LIVE-RULES.md',
    'deploy/cron/apsales-sales-coach.cron',
    'customer_gateway/growth_autopilot.py',
    'customer_gateway/outreach_engine.py',
    'customer_gateway/distribution_progress.py',
    'customer_gateway/maps_prospect.py',
    'config/apbd_lead_markets.yaml',
    'config/apsales_maps_prospect.yaml',
    'agents/apbd',
  ],
  'apsales-openclaw': [
    'deploy/apsales-live-draft/bridge.mjs',
    'deploy/apsales-live-draft/apsales-whatsapp-session.mjs',
    'deploy/apsales-live-draft/evidence-hook.mjs',
    'deploy/apsales-live-draft/ghana-staff-handoff.mjs',
    'deploy/apsales-live-draft/apsales-parse-agent-reply.mjs',
    'deploy/apsales-live-draft/apsales-price-confirmation-gate.mjs',
    'deploy/apsales-live-draft/apsales-reusable-evidence.mjs',
    'deploy/apsales-live-draft/apsales-live-rules.mjs',
    'deploy/apsales-live-draft/apsales-internal-staff.mjs',
    'deploy/apsales-live-draft/apsales-closing-memory.mjs',
    'deploy/apsales-live-draft/apsales-soft-angle.mjs',
    'docs/zijing-training/LIVE-RULES.md',
    'server/lib/asiapower-evidence.js',
    'scripts/apsales-media-vin-ocr.py',
    'scripts/apsales-media-vin-intelligence.py',
    'scripts/apsales-media-stt.py',
    'scripts/apsales-classify-customer-intent.py',
    'scripts/deploy-production.mjs',
  ],
  finalize: [
    'deploy/inventory-site-scripts/backup-inventory-site.sh',
    'scripts/telegram-lead-reminder.js',
    'scripts/backfill-complete-halfcut-categories-2026-07-12.mjs',
    'scripts/setup-r2-cors.mjs',
  ],
};

/** @type {Record<string, string[]>} */
export const TARGET_REMOTE_PATHS = {
  categories: [
    '/root/.openclaw/workspace/inventory-site/public/index.html',
    '/root/.openclaw/workspace/inventory-site/public/half-cuts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/engines/index.html',
    '/root/.openclaw/workspace/inventory-site/public/gearboxes/index.html',
    '/root/.openclaw/workspace/inventory-site/public/front-cuts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/chassis-parts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/js/half-cut-directory.js',
    '/root/.openclaw/workspace/inventory-site/public/js/ebay-catalog-hub.js',
    '/root/.openclaw/workspace/inventory-site/public/js/home-v4-hybrid.js',
  ],
  home: [
    '/root/.openclaw/workspace/inventory-site/public/index.html',
    '/root/.openclaw/workspace/inventory-site/public/css/home-v4-hybrid.css',
    '/root/.openclaw/workspace/inventory-site/public/css/styles.css',
    '/root/.openclaw/workspace/inventory-site/public/js/home-v4-hybrid.js',
    '/root/.openclaw/workspace/inventory-site/public/js/components.js',
    '/root/.openclaw/workspace/inventory-site/public/sw.js',
    '/root/.openclaw/workspace/inventory-site/public/assets/home-v4-inventory-snapshot.json',
  ],
  portal: [
    '/root/.openclaw/workspace/inventory-site/public/login/index.html',
    '/root/.openclaw/workspace/inventory-site/public/css/login.css',
    '/root/.openclaw/workspace/inventory-site/public/css/portal-app.css',
    '/root/.openclaw/workspace/inventory-site/public/js/login.js',
    '/root/.openclaw/workspace/inventory-site/public/js/buyer-portal.js',
    '/root/.openclaw/workspace/inventory-site/public/js/supplier-dashboard.js',
    '/root/.openclaw/workspace/inventory-site/public/js/v4-portal-shell.js',
    '/root/.openclaw/workspace/inventory-site/public/js/main.js',
    '/root/.openclaw/workspace/inventory-site/public/buyer-portal/index.html',
    '/root/.openclaw/workspace/inventory-site/public/supplier-portal/dashboard.html',
    '/root/.openclaw/workspace/inventory-site/public/supplier-portal.html',
  ],
  chrome: [
    '/root/.openclaw/workspace/inventory-site/public/js/components.js',
    '/root/.openclaw/workspace/inventory-site/public/js/config.js',
    '/root/.openclaw/workspace/inventory-site/public/js/main.js',
    '/root/.openclaw/workspace/inventory-site/public/js/public-i18n.js',
    '/root/.openclaw/workspace/inventory-site/public/js/ebay-layout.js',
    '/root/.openclaw/workspace/inventory-site/public/js/half-cut-directory.js',
    '/root/.openclaw/workspace/inventory-site/public/js/ebay-catalog-hub.js',
    '/root/.openclaw/workspace/inventory-site/public/css/ebay-layout.css',
    '/root/.openclaw/workspace/inventory-site/public/css/styles.css',
    '/root/.openclaw/workspace/inventory-site/public/half-cuts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/half-cuts/detail.html',
    '/root/.openclaw/workspace/inventory-site/public/trucks/index.html',
    '/root/.openclaw/workspace/inventory-site/public/trucks/detail.html',
    '/root/.openclaw/workspace/inventory-site/public/machinery/index.html',
    '/root/.openclaw/workspace/inventory-site/public/machinery/detail.html',
    '/root/.openclaw/workspace/inventory-site/public/engines/index.html',
    '/root/.openclaw/workspace/inventory-site/public/engines/ghana-used-engines-from-china.html',
    '/root/.openclaw/workspace/inventory-site/public/engines/toyota-engines-for-ghana-importers.html',
    '/root/.openclaw/workspace/inventory-site/public/engines/nigeria-used-engines-from-china.html',
    '/root/.openclaw/workspace/inventory-site/public/engines/hyundai-kia-engines-for-nigeria-importers.html',
    '/root/.openclaw/workspace/inventory-site/public/gearboxes/index.html',
    '/root/.openclaw/workspace/inventory-site/public/front-cuts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/chassis-parts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/guides/index.html',
    '/root/.openclaw/workspace/inventory-site/public/guides/buying-used-engines-from-china.html',
    '/root/.openclaw/workspace/inventory-site/public/guides/fob-vs-cif-shipping-guide.html',
    '/root/.openclaw/workspace/inventory-site/public/about.html',
    '/root/.openclaw/workspace/inventory-site/public/contact.html',
    '/root/.openclaw/workspace/inventory-site/public/ghana.html',
    '/root/.openclaw/workspace/inventory-site/public/nigeria.html',
    '/root/.openclaw/workspace/inventory-site/public/brands.html',
  ],
  admin: [
    '/root/.openclaw/workspace/inventory-site/public/css/admin-v4.css',
    '/root/.openclaw/workspace/inventory-site/public/js/components.js',
    '/root/.openclaw/workspace/inventory-site/public/js/admin-common.js',
    '/root/.openclaw/workspace/inventory-site/public/js/admin-inventory.js',
    '/root/.openclaw/workspace/inventory-site/public/js/admin-inventory-hub.js',
    '/root/.openclaw/workspace/inventory-site/public/js/admin-analytics.js',
    '/root/.openclaw/workspace/inventory-site/public/js/admin-leads.js',
    '/root/.openclaw/workspace/inventory-site/public/js/admin-apsales-progress.js',
    '/root/.openclaw/workspace/inventory-site/public/admin/inventory.html',
    '/root/.openclaw/workspace/inventory-site/public/admin/analytics.html',
    '/root/.openclaw/workspace/inventory-site/public/admin/leads.html',
    '/root/.openclaw/workspace/inventory-site/public/admin/apsales-progress.html',
  ],
  nginx: [
    '/etc/nginx/conf.d/asiapower-rate-limit.conf',
    '/etc/nginx/sites-available/asia-power.com',
    '/etc/nginx/sites-enabled/asia-power.com',
    '/etc/nginx/conf.d/asiapower-security.conf',
  ],
  api: [
    '/root/.openclaw/workspace/inventory-site/server.js',
    '/root/.openclaw/workspace/inventory-site/lib',
    '/etc/systemd/system/inventory-site.service',
    '/usr/local/bin/asiapower-health-watch.sh',
    '/root/.openclaw/workspace/inventory-site/package.json',
    '/root/.openclaw/workspace/inventory-site/package-lock.json',
  ],
  engines: ['/root/.openclaw/workspace/inventory-site/public/engines'],
  apsales: [
    '/root/.openclaw/workspace/AsiaPower/scripts',
    '/root/.openclaw/workspace/AsiaPower/customer_gateway',
    '/root/.openclaw/workspace/AsiaPower/config/apbd_lead_markets.yaml',
    '/root/.openclaw/workspace/AsiaPower/config/apsales_maps_prospect.yaml',
    '/root/.openclaw/workspace/AsiaPower/agents/apbd',
  ],
  'apsales-openclaw': [
    '/root/.openclaw/extensions/apsales-live-draft/bridge.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/apsales-whatsapp-session.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/evidence-hook.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/ghana-staff-handoff.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/apsales-parse-agent-reply.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/apsales-internal-staff.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/apsales-closing-memory.mjs',
    '/root/.openclaw/extensions/apsales-live-draft/apsales-soft-angle.mjs',
    '/etc/systemd/system/apsales-whatsapp-bridge.service.d/openclaw-sales-agent.conf',
    '/root/.openclaw/workspace/AsiaPower/scripts/apsales-media-vin-ocr.py',
    '/root/.openclaw/workspace/AsiaPower/scripts/apsales-media-vin-intelligence.py',
    '/root/.openclaw/workspace/AsiaPower/scripts/apsales-media-stt.py',
    '/root/.openclaw/workspace/AsiaPower/server/lib/asiapower-evidence.js',
  ],
  finalize: [
    '/root/.openclaw/workspace/inventory-site/scripts',
    '/root/.openclaw/workspace/inventory-site/public/supplier-portal/upload-key.js',
  ],
};

export function gitOutput(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) return '';
  return (r.stdout || '').trim();
}

export function generateReleaseId(target, gitShort, date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `REL-${stamp}-${target}-${gitShort}`;
}

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) out.push(...walk(fp));
    else out.push(fp);
  }
  return out;
}

export function listChangedFiles(root, target) {
  const patterns = TARGET_SOURCE_FILES[target] || [];
  const files = new Set();
  for (const p of patterns) {
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) {
      for (const fp of walk(abs)) files.add(path.relative(root, fp));
    } else {
      files.add(p);
    }
  }
  const dirty = gitOutput(['status', '--porcelain', '--', ...patterns], root);
  const dirtySet = new Set();
  for (const line of dirty.split('\n').filter(Boolean)) {
    dirtySet.add(line.slice(3).trim());
  }
  return { planned: [...files].sort(), dirty: [...dirtySet].sort() };
}

/** Paths changed in working tree + unpushed commits (for cache-bust etc.). */
export function listGitChangedPaths(root) {
  const out = new Set();
  const porcelain = gitOutput(['status', '--porcelain'], root);
  for (const line of porcelain.split('\n').filter(Boolean)) {
    const raw = line.slice(3).trim();
    // rename: "old -> new"
    const arrow = raw.indexOf(' -> ');
    out.add(arrow >= 0 ? raw.slice(arrow + 4) : raw);
  }
  const upstream = gitOutput(['rev-parse', '--abbrev-ref', '@{u}'], root);
  const range = upstream ? `${upstream}...HEAD` : 'HEAD~1...HEAD';
  const names = gitOutput(['diff', '--name-only', range], root);
  for (const f of names.split('\n').filter(Boolean)) out.add(f);
  if (!out.size) {
    // clean + already pushed: still check files in HEAD commit
    const headNames = gitOutput(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], root);
    for (const f of headNames.split('\n').filter(Boolean)) out.add(f);
  }
  return [...out].sort();
}

/**
 * HEAD must already be on the remote tracking branch (pushed to GitHub).
 * Emergency bypass: DEPLOY_ALLOW_UNPUSHED=1 (logged as warn).
 */
function checkHeadPushedToOrigin(root) {
  const upstream = gitOutput(['rev-parse', '--abbrev-ref', '@{u}'], root);
  if (!upstream) {
    return {
      pushed: false,
      detail: 'no upstream tracking branch; set upstream or push first (commit → push GitHub → deploy)',
    };
  }
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', 'HEAD', '@{u}'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (ancestor.status === 0) {
    return { pushed: true, detail: `HEAD is on ${upstream}` };
  }
  const ahead = gitOutput(['rev-list', '--count', `@{u}..HEAD`], root) || '?';
  return {
    pushed: false,
    detail: `HEAD not on origin (${ahead} commit(s) ahead of ${upstream}); push GitHub before deploy`,
  };
}

export function runPreDeployValidation({ root, target, remote, allowDirty, yes, releaseId }) {
  /** @type {{name: string, status: 'pass'|'fail'|'warn', detail: string}[]} */
  const checks = [];

  const branch = gitOutput(['branch', '--show-current'], root) || 'unknown';
  const commit = gitOutput(['rev-parse', 'HEAD'], root) || 'unknown';
  const short = commit.slice(0, 7) || '0000000';
  const porcelain = gitOutput(['status', '--porcelain'], root);
  const isClean = porcelain.length === 0;
  // Emergency only: --allow-dirty alone is NOT enough (CEO 2026-07-10 red line).
  const allowDirtyEnv = process.env.DEPLOY_ALLOW_DIRTY === '1';
  const allowUnpushedEnv = process.env.DEPLOY_ALLOW_UNPUSHED === '1';

  if (isClean) {
    checks.push({ name: 'git_clean', status: 'pass', detail: 'working tree clean' });
  } else if (allowDirty && allowDirtyEnv) {
    console.warn('[release] EMERGENCY: DEPLOY_ALLOW_DIRTY=1 + --allow-dirty — dirty tree deploy (CEO red line; do not use routinely)');
    checks.push({
      name: 'git_clean',
      status: 'warn',
      detail: `dirty tree (${porcelain.split('\n').filter(Boolean).length} paths) — EMERGENCY allow-dirty+DEPLOY_ALLOW_DIRTY=1`,
    });
  } else if (allowDirty && !allowDirtyEnv) {
    checks.push({
      name: 'git_clean',
      status: 'fail',
      detail: 'dirty tree: --allow-dirty alone blocked; commit+push first, or emergency DEPLOY_ALLOW_DIRTY=1 + --allow-dirty',
    });
  } else {
    checks.push({
      name: 'git_clean',
      status: 'fail',
      detail: 'working tree not clean; commit → push GitHub → deploy (no routine --allow-dirty)',
    });
  }

  const pushCheck = checkHeadPushedToOrigin(root);
  if (pushCheck.pushed) {
    checks.push({ name: 'git_pushed', status: 'pass', detail: pushCheck.detail });
  } else if (allowUnpushedEnv) {
    console.warn(`[release] EMERGENCY: DEPLOY_ALLOW_UNPUSHED=1 — ${pushCheck.detail}`);
    checks.push({
      name: 'git_pushed',
      status: 'warn',
      detail: `EMERGENCY unpushed bypass: ${pushCheck.detail}`,
    });
  } else {
    checks.push({
      name: 'git_pushed',
      status: 'fail',
      detail: `${pushCheck.detail}; or emergency DEPLOY_ALLOW_UNPUSHED=1`,
    });
  }

  if (!VALID_TARGETS.includes(target)) {
    checks.push({ name: 'target', status: 'fail', detail: `invalid target ${target}` });
  } else {
    checks.push({ name: 'target', status: 'pass', detail: target });
  }

  const { planned, dirty } = listChangedFiles(root, target);
  checks.push({
    name: 'changed_files',
    status: planned.length ? 'pass' : 'warn',
    detail: planned.length ? `${planned.length} planned file(s)` : 'no source files resolved',
  });

  // Cache-bust: scan live HTML refs (no handwritten table). Warn if a
  // git-changed shared js/css is referenced with inconsistent ?v= across ≥2 pages.
  try {
    const gitChanged = listGitChangedPaths(root);
    const cacheBust = checkCacheBustConsistency({
      root,
      changedFiles: gitChanged,
    });
    checks.push({
      name: 'cache_bust_consistency',
      status: cacheBust.status,
      detail: cacheBust.detail,
    });
    if (cacheBust.status === 'warn' && cacheBust.inconsistencies?.length) {
      for (const inc of cacheBust.inconsistencies.slice(0, 5)) {
        const verLine = inc.versions
          .map((v) => `${v.version}×${v.count}`)
          .join(', ');
        console.warn(`[release] cache-bust WARN ${inc.asset}: ${verLine}`);
        for (const v of inc.versions.slice(0, 3)) {
          console.warn(`  ?v=${v.version} e.g. ${v.samplePages.slice(0, 3).join(', ')}`);
        }
      }
    }
  } catch (err) {
    checks.push({
      name: 'cache_bust_consistency',
      status: 'warn',
      detail: `cache-bust check error: ${err?.message || err}`,
    });
  }

  if (yes) {
    checks.push({ name: 'target_confirmation', status: 'pass', detail: '--yes flag set' });
  } else if (process.env.DEPLOY_CONFIRM === releaseId) {
    checks.push({ name: 'target_confirmation', status: 'pass', detail: 'DEPLOY_CONFIRM matches release ID' });
  } else {
    checks.push({
      name: 'target_confirmation',
      status: 'fail',
      detail: `set DEPLOY_CONFIRM=${releaseId} or pass --yes`,
    });
  }

  const backupMode = ['engines', 'apsales', 'finalize'].includes(target) ? 'data-only' : 'full';
  const backupCmd = backupMode === 'data-only'
    ? 'bash /root/.openclaw/workspace/inventory-site/scripts/backup-inventory-site.sh --data-only'
    : 'bash /root/.openclaw/workspace/inventory-site/scripts/backup-inventory-site.sh';
  const backupRun = spawnSync('ssh', ['-o', 'BatchMode=yes', remote, backupCmd], { encoding: 'utf8' });
  let backupPath = '';
  const backupOut = `${backupRun.stdout || ''}${backupRun.stderr || ''}`;
  const m = backupOut.match(/Created (\S+\.tar\.gz)/);
  if (m) backupPath = m[1];
  if (!backupPath) {
    const latest = spawnSync('ssh', ['-o', 'BatchMode=yes', remote,
      'ls -1t /root/.openclaw/workspace/inventory-site/backups/scheduled/*.tar.gz 2>/dev/null | head -1'],
      { encoding: 'utf8' });
    backupPath = (latest.stdout || '').trim();
  }
  checks.push({
    name: 'backup_check',
    status: backupRun.status === 0 && backupPath ? 'pass' : 'fail',
    detail: backupPath || backupOut.trim() || 'backup failed',
  });

  const failed = checks.filter((c) => c.status === 'fail');
  return {
    status: failed.length ? 'fail' : 'pass',
    checks,
    git: { branch, commit, short },
    changed_files: planned,
    dirty_files: dirty,
    backup_path: backupPath,
    backup_mode: backupMode,
  };
}

export function snapshotRemotePaths({ remote, releaseId, paths }) {
  const remoteReleaseDir = `/root/.openclaw/workspace/inventory-site/releases/${releaseId}`;
  const snapDir = `${remoteReleaseDir}/snapshots`;
  const pathList = paths.map((p) => `'${p.replace(/'/g, `'\\''`)}'`).join(' ');
  const script = `
set -e
mkdir -p '${snapDir}'
for p in ${pathList}; do
  if [ -e "$p" ]; then
    dest='${snapDir}'/"$(echo "$p" | sed 's|^/||' | tr '/' '_')"
    if [ -d "$p" ]; then
      mkdir -p "$dest"
      cp -a "$p/." "$dest/" 2>/dev/null || true
    else
      mkdir -p "$(dirname "$dest")"
      cp -a "$p" "$dest"
    fi
  fi
done
echo SNAPSHOT_OK
`;
  const r = spawnSync('ssh', ['-o', 'BatchMode=yes', remote, script], { encoding: 'utf8' });
  return r.status === 0 && (r.stdout || '').includes('SNAPSHOT_OK');
}

export async function runPostDeployValidation({ root, target, remote, baseUrl, releaseId = '' }) {
  /** @type {{name: string, status: 'pass'|'fail'|'skip'|'warn', detail: string}[]} */
  const checks = [];

  if (target === 'nginx' || target === 'api') {
    const ngx = spawnSync('ssh', ['-o', 'BatchMode=yes', remote, 'nginx -t 2>&1'], { encoding: 'utf8' });
    const out = `${ngx.stdout || ''}${ngx.stderr || ''}`.trim();
    checks.push({
      name: 'nginx_verification',
      status: ngx.status === 0 && out.includes('test is successful') ? 'pass' : 'fail',
      detail: out.split('\n').pop() || out || 'nginx -t failed',
    });
  } else {
    checks.push({ name: 'nginx_verification', status: 'skip', detail: 'not required' });
  }

  if (['nginx', 'api', 'engines', 'home'].includes(target)) {
    const verifyScript = path.join(root, 'scripts', 'verify-production.mjs');
    if (fs.existsSync(verifyScript)) {
      const verify = spawnSync('node', [verifyScript, baseUrl], { encoding: 'utf8', cwd: root });
      const out = `${verify.stdout || ''}${verify.stderr || ''}`.trim();
      checks.push({
        name: 'critical_url_check',
        status: verify.status === 0 ? 'pass' : 'fail',
        detail: verify.status === 0 ? 'verify-production passed' : out.split('\n').slice(-2).join(' | '),
      });
    } else {
      checks.push({ name: 'critical_url_check', status: 'fail', detail: 'verify-production.mjs missing' });
    }
  } else {
    checks.push({ name: 'critical_url_check', status: 'skip', detail: 'not required' });
  }

  const svc = spawnSync('ssh', ['-o', 'BatchMode=yes', remote,
    'systemctl is-active nginx inventory-site.service 2>/dev/null | tr "\\n" " "'],
    { encoding: 'utf8' });
  const svcOut = (svc.stdout || '').trim();
  checks.push({
    name: 'services_active',
    status: svcOut.split(/\s+/).every((s) => s === 'active') ? 'pass' : 'fail',
    detail: svcOut || 'service check failed',
  });

  // OPS-003: parser-based public validation for any customer-facing target
  const publicTargets = new Set(['nginx', 'api', 'engines', 'home', 'chrome', 'portal', 'categories', 'admin']);
  /** @type {any} */
  let publicReport = null;
  /** @type {any} */
  let purgeReport = null;

  if (publicTargets.has(target)) {
    // Stamp releaseId on remote config.js (no HTML/SEO rewrite)
    if (releaseId) {
      const stampCmd = `
CFG=/root/.openclaw/workspace/inventory-site/public/js/config.js
if [ -f "$CFG" ]; then
  if grep -q 'releaseId:' "$CFG"; then
    sed -i "s/releaseId: *['\\"'][^'\\"']*['\\"']/releaseId: '${releaseId}'/" "$CFG"
  else
    sed -i "s/const ASIAPOWER = {/const ASIAPOWER = {\\n  releaseId: '${releaseId}',/" "$CFG"
  fi
  if grep -q 'RELEASE_ID:' "$CFG"; then
    sed -i "s|/\\* RELEASE_ID: .* \\*/|/* RELEASE_ID: ${releaseId} */|" "$CFG"
  else
    echo "/* RELEASE_ID: ${releaseId} */" >> "$CFG"
  fi
  echo STAMP_OK
fi
`;
      const stamp = spawnSync('ssh', ['-o', 'BatchMode=yes', remote, stampCmd], { encoding: 'utf8' });
      checks.push({
        name: 'release_id_stamp',
        status: (stamp.stdout || '').includes('STAMP_OK') ? 'pass' : 'warn',
        detail: (stamp.stdout || '').includes('STAMP_OK')
          ? `stamped ${releaseId} into remote js/config.js`
          : `stamp skipped/failed: ${(stamp.stderr || stamp.stdout || '').slice(0, 160)}`,
      });
    }

    purgeReport = await attemptCloudflarePurge({ baseUrl });
    checks.push({
      name: 'cloudflare_purge',
      status: purgeReport.status === 'pass' ? 'pass' : 'warn',
      detail: purgeReport.detail,
    });

    // Brief wait so edge can refresh after successful purge
    if (purgeReport.status === 'pass') {
      await new Promise((r) => setTimeout(r, 2000));
    }

    publicReport = await runPublicPostReleaseValidation({
      baseUrl,
      releaseId,
    });

    for (const c of publicReport.checks) {
      checks.push({
        name: `public_${c.name}`,
        status: c.status === 'skip' ? 'skip' : c.status,
        detail: c.detail,
      });
    }

    const outDir = path.join(root, 'docs', 'tasks', 'ops-003');
    try {
      writeValidationReports(outDir, publicReport, purgeReport);
      // also archive under this release
      if (releaseId) {
        const relOut = path.join(root, 'releases', releaseId, 'ops-003');
        writeValidationReports(relOut, publicReport, purgeReport);
      }
      checks.push({
        name: 'ops003_reports',
        status: 'pass',
        detail: `wrote docs/tasks/ops-003/ (+ releases/${releaseId || 'n-a'}/ops-003/)`,
      });
    } catch (err) {
      checks.push({
        name: 'ops003_reports',
        status: 'warn',
        detail: String(err && err.message ? err.message : err),
      });
    }
  } else {
    checks.push({ name: 'public_post_release_validation', status: 'skip', detail: `target=${target} not public surface` });
  }

  const hardFail = checks.some((c) => c.status === 'fail');
  return {
    status: hardFail ? 'fail' : 'pass',
    checks,
    public_report: publicReport,
    cloudflare_purge: purgeReport,
  };
}

export function writeReleaseJson({ remote, release, localDir }) {
  fs.mkdirSync(localDir, { recursive: true });
  const localFile = path.join(localDir, 'release.json');
  fs.writeFileSync(localFile, `${JSON.stringify(release, null, 2)}\n`);
  const remoteDir = `/root/.openclaw/workspace/inventory-site/releases/${release.release_id}`;
  spawnSync('ssh', ['-o', 'BatchMode=yes', remote, `mkdir -p '${remoteDir}'`], { stdio: 'inherit' });
  spawnSync('rsync', ['-av', localFile, `${remote}:${remoteDir}/release.json`], { stdio: 'inherit' });
  return { localFile, remoteDir };
}

/** Default how many REL-* dirs to keep after each deploy (override with DEPLOY_KEEP_RELEASES). */
export function releaseKeepCount(explicit) {
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const n = Number.parseInt(String(process.env.DEPLOY_KEEP_RELEASES || '20'), 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/**
 * Keep the newest N REL-* directories under releasesRoot; delete the rest.
 * Pure filesystem helper — safe to unit-test against a temp dir.
 * @returns {{ kept: string[], deleted: string[], keep: number }}
 */
export function pruneReleaseDirs(releasesRoot, keep = null) {
  const keepN = releaseKeepCount(keep);
  if (!releasesRoot || !fs.existsSync(releasesRoot)) {
    return { kept: [], deleted: [], keep: keepN };
  }
  const entries = fs.readdirSync(releasesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^REL-/.test(d.name))
    .map((d) => {
      const full = path.join(releasesRoot, d.name);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(full).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { name: d.name, full, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));

  const kept = entries.slice(0, keepN).map((e) => e.name);
  const deleted = [];
  for (const entry of entries.slice(keepN)) {
    fs.rmSync(entry.full, { recursive: true, force: true });
    deleted.push(entry.name);
  }
  return { kept, deleted, keep: keepN };
}

/** Never throw — prune failure must not fail a completed deploy. */
export function pruneReleaseDirsSafe(releasesRoot, keep = null) {
  try {
    const result = pruneReleaseDirs(releasesRoot, keep);
    if (result.deleted.length) {
      console.log(`[release] pruned ${result.deleted.length} local release(s); kept ${result.kept.length} (max ${result.keep})`);
    }
    return result;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[release] local prune failed (non-fatal): ${detail}`);
    return { kept: [], deleted: [], keep: releaseKeepCount(keep), error: detail };
  }
}

/**
 * Prune remote inventory-site/releases/REL-* the same way (newest N by mtime).
 * Failures are logged only.
 */
export function pruneRemoteReleaseDirsSafe({ remote, keep = null } = {}) {
  const keepN = releaseKeepCount(keep);
  if (!remote) {
    return { kept: 0, deleted: 0, keep: keepN, skipped: true };
  }
  const script = `
set +e
DIR=/root/.openclaw/workspace/inventory-site/releases
KEEP=${keepN}
cd "$DIR" || { echo "missing_releases_dir"; exit 0; }
mapfile -t ALL < <(ls -1dt REL-* 2>/dev/null)
TOTAL=\${#ALL[@]}
if [ "$TOTAL" -le "$KEEP" ]; then
  echo "kept=$TOTAL deleted=0"
  exit 0
fi
DEL=("\${ALL[@]:$KEEP}")
for d in "\${DEL[@]}"; do
  rm -rf -- "$DIR/\$d"
done
echo "kept=$KEEP deleted=\${#DEL[@]}"
`;
  try {
    const r = spawnSync(
      'ssh',
      ['-o', 'ConnectTimeout=20', '-o', 'BatchMode=yes', remote, 'bash', '-s'],
      { input: script, encoding: 'utf8' },
    );
    const out = String(r.stdout || '').trim();
    if (r.status !== 0) {
      console.warn(`[release] remote prune failed (non-fatal): ${String(r.stderr || out).slice(0, 300)}`);
      return { keep: keepN, error: String(r.stderr || out).slice(0, 300) };
    }
    console.log(`[release] remote prune: ${out || 'ok'}`);
    return { keep: keepN, detail: out };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[release] remote prune failed (non-fatal): ${detail}`);
    return { keep: keepN, error: detail };
  }
}

export function printDeploymentSummary(release) {
  console.log('\n=== Deployment Summary ===');
  console.log(`Release ID:   ${release.release_id}`);
  console.log(`Target:       ${release.deploy_target}`);
  console.log(`Git commit:   ${release.git_commit}`);
  console.log(`Timestamp:    ${release.timestamp}`);
  console.log(`Validation:   ${release.validation?.post?.status || 'unknown'}`);
  console.log(`Backup:       ${release.recovery?.backup_archive || '—'}`);
  console.log(`Restore:      RESTORE_CONFIRM=${release.release_id} node scripts/release-restore.mjs ${release.release_id}`);
  console.log(`Release JSON: releases/${release.release_id}/release.json`);
  console.log('==========================\n');
}

export function buildReleaseRecord({
  releaseId, git, target, remote, timestamp, changedFiles, pre, post, backupPath, backupMode, localReleaseJson,
}) {
  return {
    release_id: releaseId,
    git_commit: git.commit,
    git_branch: git.branch,
    deploy_target: target,
    remote,
    timestamp,
    changed_files: changedFiles,
    validation: {
      pre: { status: pre.status, checks: pre.checks },
      post: post ? { status: post.status, checks: post.checks } : { status: 'pending', checks: [] },
      ops003_public: post?.public_report
        ? {
            status: post.public_report.status,
            fail_count: post.public_report.fail_count,
            expected_whatsapp: post.public_report.expected_whatsapp,
          }
        : null,
      cloudflare_purge: post?.cloudflare_purge
        ? { status: post.cloudflare_purge.status, detail: post.cloudflare_purge.detail }
        : null,
    },
    recovery: {
      backup_archive: backupPath,
      backup_mode: backupMode,
      snapshot_dir: `/root/.openclaw/workspace/inventory-site/releases/${releaseId}/snapshots`,
      restore_command: `RESTORE_CONFIRM=${releaseId} node scripts/release-restore.mjs ${releaseId}`,
      local_release_json: localReleaseJson,
    },
  };
}
