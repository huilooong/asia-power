import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const SEO_ASSETS_FILES = [
  [
    "server/lib/catalog-list-prerender.js",
    "lib/catalog-list-prerender.js",
    "e3f777686ad018148df1d167500ec7660e4777639af2903576eba25b4f8be2fa"
  ],
  [
    "engines/1nz-fe.html",
    "public/engines/1nz-fe.html",
    "4c85717644640c9f8bb394f06fdd3d82290b5246bc4be0b260aabbc192203cf5"
  ],
  [
    "engines/4b11.html",
    "public/engines/4b11.html",
    "1323d22ef81171ad0a7c6c264a3610f12716cce93584c515f08ec33c4fe6d11d"
  ],
  [
    "engines/g6ba.html",
    "public/engines/g6ba.html",
    "d0124ca0024f2ec27833de10d2a60b044d0397d9ff1c72d4353e4a27a748f5c2"
  ],
  [
    "engines/k10b.html",
    "public/engines/k10b.html",
    "5da152c9152261446f30e5d82fd0483ae0753708800a706cdd7f081ec009142f"
  ],
  [
    "engines/k24z4.html",
    "public/engines/k24z4.html",
    "87656315b23ccecb93a475233478f0dd833fd351d736c3d8b5079a21c892f046"
  ],
  [
    "engines/kia-k2-g4fc-half-cut-guide.html",
    "public/engines/kia-k2-g4fc-half-cut-guide.html",
    "478d392482b4e85ec2318f731e261d365a9a0b0169cea627e93d0f46ed98098b"
  ],
  [
    "engines/l15a7.html",
    "public/engines/l15a7.html",
    "a58df7779b0e90352e3211c229f4f795d1b5a4b2953237362f31e564f69560ae"
  ],
  [
    "engines/m271-951.html",
    "public/engines/m271-951.html",
    "485f1294ecff4522e80c748e473df8e493e3c122287d66090f8c8850864c12d9"
  ],
  [
    "engines/r18a1.html",
    "public/engines/r18a1.html",
    "408f416a1049f87d12e026b116410e4815a452c377d7b33d6ac56589565b130b"
  ],
  [
    "guides/ghana-auto-spare-parts-import-guide.html",
    "public/guides/ghana-auto-spare-parts-import-guide.html",
    "f28c5b06eb0751fdb8733edebf3cc657a3cecf68fa517f9d4db506cf22238ceb"
  ],
  [
    "guides/guide-import-moteur-cote-ivoire.html",
    "public/guides/guide-import-moteur-cote-ivoire.html",
    "52aa7c268b61b5ec9b9bbb2f2a4904b917c438df6a9f1230bdfa9c0462adc563"
  ],
  [
    "js/half-cut-detail.js",
    "public/js/half-cut-detail.js",
    "34e98f8b0736de2c989f5a2d172c222e53ec0a513378b8f0e1a4b3ffe4b5c20a"
  ],
  [
    "server/lib/half-cut-seo.js",
    "lib/half-cut-seo.js",
    "d7604b9754a8b7514dd4358b9717fb6d52285634706317bd6e7cd7d9e59a9932"
  ],
  [
    "half-cuts/detail.html",
    "public/half-cuts/detail.html",
    "10412e7c848a477b14da5fc1fe33446ed0adcb01085f16abc0503ab01145c6a0"
  ],
  [
    "trucks/detail.html",
    "public/trucks/detail.html",
    "82df426e750cb6db0a5bfb39f7984c94d876f7ef21c85bca90fb80e47860b3f0"
  ],
  [
    "machinery/detail.html",
    "public/machinery/detail.html",
    "2d2afd5df7d46790d057bf5a7c8e532e3e1fe85afe5182f5c33ea66e2fcc0abd"
  ],
  [
    "used-cars/detail.html",
    "public/used-cars/detail.html",
    "75ff36ce2a2564854469f8a636db5bf99d1bdd995e6cfbe94bf1628829bdc232"
  ]
];
const SITE = '/root/.openclaw/workspace/inventory-site';
export const SEO_ASSETS_REMOTE_PATHS = SEO_ASSETS_FILES.map(([, dest]) => `${SITE}/${dest}`);

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, { input, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status})`);
}

export function buildSeoAssetsInstallScript(releaseId, hashes) {
  if (!/^REL-[A-Za-z0-9-]+$/.test(releaseId)) throw new Error('Invalid release ID');
  if (hashes.length !== SEO_ASSETS_FILES.length || hashes.some(h => !/^[a-f0-9]{64}$/.test(h))) throw new Error('Invalid hashes');
  const checks = SEO_ASSETS_FILES.map(([, dest, before], i) => `test "$(sha256sum "$REL/staging/${i}" | cut -d ' ' -f1)" = '${hashes[i]}'\n` +
    (before ? `test "$(sha256sum "$SITE/${dest}" | cut -d ' ' -f1)" = '${before}'` : `test ! -e "$SITE/${dest}"`)).join('\n');
  const restore = SEO_ASSETS_FILES.map(([, dest, before]) => before
    ? `cp -a "$REL/snapshots/${SITE.slice(1).replaceAll('/', '_')}_${dest.replaceAll('/', '_')}" "$SITE/${dest}"`
    : `if [ -e "$SITE/${dest}" ]; then mv "$SITE/${dest}" "$REL/rolled-back-new-file"; fi`).join('\n');
  const install = SEO_ASSETS_FILES.map(([, dest], i) => `cp "$REL/staging/${i}" "$SITE/${dest}.seo015.tmp"\nmv "$SITE/${dest}.seo015.tmp" "$SITE/${dest}"`).join('\n');
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
  echo SEO_ASSETS_ROLLED_BACK >&2
  exit 1
}
trap rollback ERR
${install}
node --check "$SITE/lib/catalog-list-prerender.js"
node --check "$SITE/lib/half-cut-seo.js"
node --check "$SITE/public/js/half-cut-detail.js"
systemctl restart inventory-site.service
systemctl is-active --quiet inventory-site.service
# systemd active precedes the HTTP listener being ready; avoid transient 502 acceptance.
ready=0
for attempt in {1..30}; do
  if curl -fsS -A 'AsiaPower-Release-bot/1.0' http://127.0.0.1:8080/robots.txt >/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" = 1
trap - ERR
echo SEO_ASSETS_INSTALLED
`;
}

export function deploySeoAssets({root, remote, releaseId}) {
  const hashes = SEO_ASSETS_FILES.map(([source]) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex'));
  run('ssh', ['-o','BatchMode=yes',remote,'mkdir','-p',`${SITE}/releases/${releaseId}/staging`]);
  SEO_ASSETS_FILES.forEach(([source], i) => run('rsync', ['-a',path.join(root,source),`${remote}:${SITE}/releases/${releaseId}/staging/${i}`]));
  run('ssh', ['-o','BatchMode=yes',remote,'bash','-s'], buildSeoAssetsInstallScript(releaseId, hashes));
  run('ssh', ['-o','BatchMode=yes',remote,`cd ${SITE} && node - ${releaseId}`], fs.readFileSync(path.join(root,'scripts/repair-seo015-approved-media.cjs'),'utf8'));
}
