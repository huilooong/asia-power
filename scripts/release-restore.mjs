#!/usr/bin/env node
/**
 * Restore a deployment by Release ID (OPS-005).
 *
 * Usage:
 *   RESTORE_CONFIRM=<RELEASE_ID> node scripts/release-restore.mjs <RELEASE_ID> [user@host]
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TARGET_REMOTE_PATHS } from './lib/release-manager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const releaseId = process.argv[2];
const REMOTE = process.argv[3] || 'root@159.65.86.24';

if (!releaseId || releaseId.startsWith('-')) {
  console.error('Usage: RESTORE_CONFIRM=<RELEASE_ID> node scripts/release-restore.mjs <RELEASE_ID> [user@host]');
  process.exit(1);
}

function loadRelease() {
  const localPath = path.join(ROOT, 'releases', releaseId, 'release.json');
  if (fs.existsSync(localPath)) {
    return { release: JSON.parse(fs.readFileSync(localPath, 'utf8')), source: localPath };
  }
  const r = spawnSync('ssh', ['-o', 'BatchMode=yes', REMOTE,
    `cat /root/.openclaw/workspace/inventory-site/releases/${releaseId}/release.json`],
    { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`Release not found: ${releaseId}`);
    process.exit(1);
  }
  return { release: JSON.parse(r.stdout), source: `remote:${releaseId}` };
}

const { release, source } = loadRelease();
console.log(`[restore] release=${releaseId} target=${release.deploy_target} from ${source}`);

if (process.env.RESTORE_CONFIRM !== releaseId) {
  console.error(`Refusing restore without RESTORE_CONFIRM=${releaseId}`);
  process.exit(1);
}

const target = release.deploy_target;
const snapDir = release.recovery?.snapshot_dir;
const paths = TARGET_REMOTE_PATHS[target] || [];

if (snapDir) {
  console.log('[restore] restoring from pre-deploy snapshots');
  for (const dest of paths) {
    const snapName = dest.replace(/^\//, '').replace(/\//g, '_');
    spawnSync('ssh', ['-o', 'BatchMode=yes', REMOTE, `
set -e
SNAP='${snapDir}/${snapName}'
DEST='${dest}'
if [ -e "$SNAP" ]; then
  if [ -d "$SNAP" ]; then
    mkdir -p "$DEST"
    rsync -a "$SNAP/" "$DEST/"
  else
    mkdir -p "$(dirname "$DEST")"
    cp -a "$SNAP" "$DEST"
  fi
  echo restored:$DEST
fi
`], { stdio: 'inherit' });
  }
}

if (release.recovery?.backup_archive) {
  console.log(`[restore] backup archive: ${release.recovery.backup_archive}`);
  console.log('[restore] for full site rollback see deploy/inventory-site-scripts/RESTORE.md');
}

if (target === 'nginx') {
  spawnSync('ssh', ['-o', 'BatchMode=yes', REMOTE, `
set -e
ln -sfn /etc/nginx/sites-available/asia-power.com /etc/nginx/sites-enabled/asia-power.com
nginx -t
systemctl reload nginx
`], { stdio: 'inherit' });
}

if (target === 'api') {
  spawnSync('ssh', ['-o', 'BatchMode=yes', REMOTE, `
set -e
node --check /root/.openclaw/workspace/inventory-site/server.js
systemctl restart inventory-site.service
systemctl is-active inventory-site.service
`], { stdio: 'inherit' });
}

console.log(`[restore] complete for ${releaseId}`);
