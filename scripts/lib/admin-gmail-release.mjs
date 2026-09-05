import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const ADMIN_GMAIL_FILES = [
 ['js/admin-leads.js','public/js/admin-leads.js','b3da6a34c5b70408f04cc2df3b5e731ab480a142606a73777bad6334e58aa112'],
 ['admin/leads.html','public/admin/leads.html','f94c65ccb229f6bfd927882e80570da7268a6c94b037b700c451ec8110e1a04c'],
];
const SITE = '/root/.openclaw/workspace/inventory-site';
export const ADMIN_GMAIL_REMOTE_PATHS = ADMIN_GMAIL_FILES.map(([, dest]) => `${SITE}/${dest}`);

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, { input, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status})`);
}

export function buildAdminGmailInstallScript(releaseId, hashes) {
  if (!/^REL-[A-Za-z0-9-]+$/.test(releaseId)) throw new Error('Invalid release ID');
  if (hashes.length !== ADMIN_GMAIL_FILES.length || hashes.some(h => !/^[a-f0-9]{64}$/.test(h))) throw new Error('Invalid hashes');
  const checks = ADMIN_GMAIL_FILES.map(([, dest, before], i) => `test "$(sha256sum "$REL/staging/${i}" | cut -d ' ' -f1)" = '${hashes[i]}'\n` +
    (before ? `test "$(sha256sum "$SITE/${dest}" | cut -d ' ' -f1)" = '${before}'` : `test ! -e "$SITE/${dest}"`)).join('\n');
  const restore = ADMIN_GMAIL_FILES.map(([, dest, before]) => before
    ? `cp -a "$REL/snapshots/${SITE.slice(1).replaceAll('/', '_')}_${dest.replaceAll('/', '_')}" "$SITE/${dest}"`
    : `if [ -e "$SITE/${dest}" ]; then mv "$SITE/${dest}" "$REL/rolled-back-new-file"; fi`).join('\n');
  const install = ADMIN_GMAIL_FILES.map(([, dest], i) => `cp "$REL/staging/${i}" "$SITE/${dest}.admin-gmail.tmp"\nmv "$SITE/${dest}.admin-gmail.tmp" "$SITE/${dest}"`).join('\n');
  return `set -euo pipefail
SITE='${SITE}'
REL="$SITE/releases/${releaseId}"
${checks}
# The shared Release Manager has already backed up and snapshotted these files.
rollback() {
  trap - ERR
  set +e
  ${restore}
  echo ADMIN_GMAIL_ROLLED_BACK >&2
  exit 1
}
trap rollback ERR
${install}
node --check "$SITE/public/js/admin-leads.js"
trap - ERR
echo ADMIN_GMAIL_INSTALLED
`;
}

export function deployAdminGmail({root, remote, releaseId}) {
  const hashes = ADMIN_GMAIL_FILES.map(([source]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex'));
  run('ssh', ['-o','BatchMode=yes',remote,'mkdir','-p',`${SITE}/releases/${releaseId}/staging`]);
  ADMIN_GMAIL_FILES.forEach(([source], i) => run('rsync', ['-a',path.join(root,source),`${remote}:${SITE}/releases/${releaseId}/staging/${i}`]));
  run('ssh', ['-o','BatchMode=yes',remote,'bash','-s'], buildAdminGmailInstallScript(releaseId, hashes));
}
