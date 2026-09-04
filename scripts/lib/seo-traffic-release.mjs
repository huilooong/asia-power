import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const SEO_TRAFFIC_FILES = [
  ['robots.txt', 'public/robots.txt', 'f52e0c74d18098ed5220de2b1f18742597dc03a2490f2b2268c1809864b8795f'],
  ['server/lib/analytics-request-filter.js', 'lib/analytics-request-filter.js', null],
  ['server/lib/site-analytics.js', 'lib/site-analytics.js', '39f30319a23b71fa59acb10b658b303c2ce8604d71bdd9525ac4f85769650227'],
  ['engines/g4kd.html', 'public/engines/g4kd.html', '99c49b8474b85c59f9acf38cee297dd525903a313a064d1e5bcb52ac45935907'],
];
const SITE = '/root/.openclaw/workspace/inventory-site';
export const SEO_TRAFFIC_REMOTE_PATHS = SEO_TRAFFIC_FILES.map(([, dest]) => `${SITE}/${dest}`);

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, { input, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status})`);
}

export function buildSeoTrafficInstallScript(releaseId, hashes) {
  if (!/^REL-[A-Za-z0-9-]+$/.test(releaseId)) throw new Error('Invalid release ID');
  if (hashes.length !== SEO_TRAFFIC_FILES.length || hashes.some(h => !/^[a-f0-9]{64}$/.test(h))) throw new Error('Invalid hashes');
  const checks = SEO_TRAFFIC_FILES.map(([, dest, before], i) => `test "$(sha256sum "$REL/staging/${i}" | cut -d ' ' -f1)" = '${hashes[i]}'\n` +
    (before ? `test "$(sha256sum "$SITE/${dest}" | cut -d ' ' -f1)" = '${before}'` : `test ! -e "$SITE/${dest}"`)).join('\n');
  const restore = SEO_TRAFFIC_FILES.map(([, dest, before]) => before
    ? `cp -a "$REL/snapshots/${SITE.slice(1).replaceAll('/', '_')}_${dest.replaceAll('/', '_')}" "$SITE/${dest}"`
    : `if [ -e "$SITE/${dest}" ]; then mv "$SITE/${dest}" "$REL/rolled-back-new-file"; fi`).join('\n');
  const install = SEO_TRAFFIC_FILES.map(([, dest], i) => `cp "$REL/staging/${i}" "$SITE/${dest}.seo014.tmp"\nmv "$SITE/${dest}.seo014.tmp" "$SITE/${dest}"`).join('\n');
  return `set -euo pipefail
SITE='${SITE}'
REL="$SITE/releases/${releaseId}"
${checks}
# The shared Release Manager has already backed up and snapshotted these files.
rollback() {
  trap - ERR
  set +e
  ${restore}
  systemctl restart inventory-site.service
  echo SEO_TRAFFIC_ROLLED_BACK >&2
  exit 1
}
trap rollback ERR
${install}
node --check "$SITE/lib/site-analytics.js"
node --check "$SITE/lib/analytics-request-filter.js"
systemctl restart inventory-site.service
systemctl is-active --quiet inventory-site.service
cd "$SITE"
node - <<'NODE'
const assert = require('assert/strict');
const {createSiteAnalytics} = require('./lib/site-analytics');
const a = createSiteAnalytics('/tmp/seo014-validation-unused');
assert.equal(a.shouldTrackPage('/?rest_route=%2Fbatch%2Fv1'), false);
assert.equal(a.shouldTrackPage('/half-cuts/?q=G4KD'), true);
assert.equal(a.shouldTrackPage('/?utm_source=google'), true);
NODE
trap - ERR
echo SEO_TRAFFIC_INSTALLED
`;
}

export function deploySeoTraffic({root, remote, releaseId}) {
  const hashes = SEO_TRAFFIC_FILES.map(([source]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex'));
  run('ssh', ['-o','BatchMode=yes',remote,'mkdir','-p',`${SITE}/releases/${releaseId}/staging`]);
  SEO_TRAFFIC_FILES.forEach(([source], i) => run('rsync', ['-a',path.join(root,source),`${remote}:${SITE}/releases/${releaseId}/staging/${i}`]));
  run('ssh', ['-o','BatchMode=yes',remote,'bash','-s'], buildSeoTrafficInstallScript(releaseId, hashes));
}
