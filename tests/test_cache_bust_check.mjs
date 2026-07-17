'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'node:url';
import {
  extractCacheBustRefs,
  findInconsistentSharedAssets,
  scanCacheBustRefs,
  checkCacheBustConsistency,
} from '../scripts/lib/cache-bust-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** SEO guides incident commit: shared chrome JS changed, ?v= not unified. */
const SEO_GUIDES_INCIDENT_COMMIT = 'c45c556a9';

test('extractCacheBustRefs parses js/css ?v= from HTML', () => {
  const html = `
    <script src="../js/components.js?v=about-type-v2"></script>
    <link rel="stylesheet" href="/css/styles.css?v=v4">
    <script src="js/config.js?v=apcontact-002"></script>
  `;
  const refs = extractCacheBustRefs(html, 'brands/toyota.html');
  assert.ok(refs.some((r) => r.asset === 'js/components.js' && r.version === 'about-type-v2'));
  assert.ok(refs.some((r) => r.asset === 'css/styles.css' && r.version === 'v4'));
  assert.ok(refs.some((r) => r.asset === 'js/config.js' && r.version === 'apcontact-002'));
});

test('mock: inconsistent ?v= on changed shared asset → warn', () => {
  const refMap = new Map([
    [
      'js/fake-shared.js',
      [
        { page: 'a.html', version: 'v1' },
        { page: 'b.html', version: 'v1' },
        { page: 'c.html', version: 'v2' },
      ],
    ],
  ]);
  const result = findInconsistentSharedAssets(refMap, ['js/fake-shared.js']);
  assert.equal(result.status, 'warn');
  assert.equal(result.inconsistencies.length, 1);
  assert.equal(result.inconsistencies[0].asset, 'js/fake-shared.js');
  assert.equal(result.inconsistencies[0].versionCount, 2);
});

test('mock: all pages same ?v= → pass', () => {
  const refMap = new Map([
    [
      'js/fake-shared.js',
      [
        { page: 'a.html', version: 'v9' },
        { page: 'b.html', version: 'v9' },
        { page: 'c.html', version: 'v9' },
      ],
    ],
  ]);
  const result = findInconsistentSharedAssets(refMap, ['js/fake-shared.js']);
  assert.equal(result.status, 'pass');
  assert.equal(result.inconsistencies.length, 0);
});

test('mock: unchanged asset with drift is ignored', () => {
  const refMap = new Map([
    [
      'js/fake-shared.js',
      [
        { page: 'a.html', version: 'v1' },
        { page: 'b.html', version: 'v2' },
      ],
    ],
  ]);
  const result = findInconsistentSharedAssets(refMap, ['js/other.js']);
  assert.equal(result.status, 'pass');
});

test('scanCacheBustRefs reads temp HTML tree', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-bust-scan-'));
  fs.mkdirSync(path.join(tmp, 'js'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'index.html'),
    '<script src="js/shared.js?v=aaa"></script>',
  );
  fs.writeFileSync(
    path.join(tmp, 'about.html'),
    '<script src="js/shared.js?v=bbb"></script>',
  );
  const map = scanCacheBustRefs(tmp);
  const refs = map.get('js/shared.js');
  assert.ok(refs);
  assert.equal(refs.length, 2);
  const check = findInconsistentSharedAssets(map, ['js/shared.js']);
  assert.equal(check.status, 'warn');
});

/**
 * Build ref map for one asset from a historical git commit (real incident tree).
 */
function refMapFromGitGrep(root, commit, assetPath) {
  const escaped = assetPath.replace(/\./g, '\\.');
  const proc = spawnSync(
    'git',
    ['grep', '-nE', `${escaped}\\?v=[^"'\\s&]+`, commit, '--', '*.html'],
    { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  assert.equal(proc.status, 0, `git grep failed: ${proc.stderr || proc.stdout}`);
  /** @type {{ page: string, version: string }[]} */
  const refs = [];
  for (const line of (proc.stdout || '').split('\n').filter(Boolean)) {
    // commit:path:lineno:content  OR  path:lineno:content
    const parts = line.split(':');
    let page;
    let content;
    if (parts[0] === commit || parts[0].startsWith(commit.slice(0, 7))) {
      page = parts[1];
      content = parts.slice(3).join(':');
    } else {
      page = parts[0];
      content = parts.slice(2).join(':');
    }
    const m = content.match(new RegExp(`${escaped}\\?v=([^"'\\s&]+)`));
    if (!m) continue;
    refs.push({ page, version: m[1] });
  }
  return new Map([[assetPath, refs]]);
}

test('regression: SEO guides incident c45c556a9 would WARN on components.js', () => {
  const map = refMapFromGitGrep(ROOT, SEO_GUIDES_INCIDENT_COMMIT, 'js/components.js');
  const refs = map.get('js/components.js') || [];
  assert.ok(refs.length >= 50, `expected many HTML refs, got ${refs.length}`);

  const versions = new Set(refs.map((r) => r.version));
  assert.ok(
    versions.size >= 3,
    `incident had many ?v= values; got ${versions.size}: ${[...versions].slice(0, 8).join(', ')}`,
  );
  // Known histogram peaks from the real day
  assert.ok(
    [...versions].some((v) => v.includes('auth-nav') || v.includes('about-type')),
    'expected historical version tags from the incident',
  );

  const result = findInconsistentSharedAssets(map, ['js/components.js']);
  assert.equal(
    result.status,
    'warn',
    'check must catch the real SEO guides cache-bust miss',
  );
  assert.ok(result.inconsistencies[0].versionCount >= 3);
});

test('regression: SEO guides incident c45c556a9 would WARN on config.js', () => {
  const map = refMapFromGitGrep(ROOT, SEO_GUIDES_INCIDENT_COMMIT, 'js/config.js');
  const result = findInconsistentSharedAssets(map, ['js/config.js']);
  assert.equal(result.status, 'warn');
  assert.ok(result.inconsistencies[0].versionCount >= 2);
});

test('current tree: unified seo-guides cache keys → pass for components.js', () => {
  const result = checkCacheBustConsistency({
    root: ROOT,
    changedFiles: ['js/components.js', 'js/config.js'],
  });
  // After b39c765b3 bump, working tree should be consistent.
  assert.equal(
    result.status,
    'pass',
    `current tree should be unified; got: ${result.detail}`,
  );
});
