#!/usr/bin/env node
/**
 * Release Manager (OPS-005) — pre/post validation, release.json, recovery metadata.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const VALID_TARGETS = ['nginx', 'api', 'engines', 'apsales', 'finalize', 'home', 'portal', 'chrome', 'categories', 'admin'];

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
    'gearboxes/index.html',
    'front-cuts/index.html',
    'chassis-parts/index.html',
    'about.html',
    'contact.html',
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
    'customer_gateway/growth_autopilot.py',
    'customer_gateway/outreach_engine.py',
    'customer_gateway/distribution_progress.py',
  ],
  finalize: [
    'deploy/inventory-site-scripts/backup-inventory-site.sh',
    'scripts/telegram-lead-reminder.js',
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
    '/root/.openclaw/workspace/inventory-site/public/gearboxes/index.html',
    '/root/.openclaw/workspace/inventory-site/public/front-cuts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/chassis-parts/index.html',
    '/root/.openclaw/workspace/inventory-site/public/about.html',
    '/root/.openclaw/workspace/inventory-site/public/contact.html',
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

export async function runPostDeployValidation({ root, target, remote, baseUrl }) {
  /** @type {{name: string, status: 'pass'|'fail'|'skip', detail: string}[]} */
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

  return { status: checks.some((c) => c.status === 'fail') ? 'fail' : 'pass', checks };
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
