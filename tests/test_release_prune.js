'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('node:url');

async function loadPrune() {
  const modPath = path.resolve(__dirname, '../scripts/lib/release-manager.mjs');
  return import(pathToFileURL(modPath).href);
}

function touchDir(root, name, mtimeMs) {
  const full = path.join(root, name);
  fs.mkdirSync(full, { recursive: true });
  fs.writeFileSync(path.join(full, 'marker.txt'), name);
  fs.utimesSync(full, new Date(mtimeMs), new Date(mtimeMs));
  return full;
}

test('pruneReleaseDirs keeps newest N by mtime', async () => {
  const { pruneReleaseDirs } = await loadPrune();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-prune-'));
  const base = Date.now();
  touchDir(root, 'REL-old-1', base - 5000);
  touchDir(root, 'REL-old-2', base - 4000);
  touchDir(root, 'REL-mid', base - 3000);
  touchDir(root, 'REL-new-1', base - 2000);
  touchDir(root, 'REL-new-2', base - 1000);
  fs.mkdirSync(path.join(root, 'not-a-release'), { recursive: true });

  const result = pruneReleaseDirs(root, 2);
  assert.equal(result.keep, 2);
  assert.equal(result.kept.length, 2);
  assert.deepEqual(result.kept.sort(), ['REL-new-1', 'REL-new-2'].sort());
  assert.equal(result.deleted.length, 3);
  assert.ok(fs.existsSync(path.join(root, 'REL-new-1')));
  assert.ok(fs.existsSync(path.join(root, 'REL-new-2')));
  assert.ok(!fs.existsSync(path.join(root, 'REL-old-1')));
  assert.ok(fs.existsSync(path.join(root, 'not-a-release')), 'non-REL dirs untouched');
});

test('pruneReleaseDirsSafe swallows errors and does not throw', async () => {
  const { pruneReleaseDirsSafe } = await loadPrune();
  await assert.doesNotReject(async () => {
    const result = pruneReleaseDirsSafe('/tmp/this-path-should-not-matter-and-may-missing-xyz', 3);
    assert.ok(result);
    assert.equal(result.keep, 3);
  });
});

test('DEPLOY_KEEP_RELEASES env controls default keep count', async () => {
  const prev = process.env.DEPLOY_KEEP_RELEASES;
  process.env.DEPLOY_KEEP_RELEASES = '3';
  try {
    const { pruneReleaseDirs, releaseKeepCount } = await loadPrune();
    assert.equal(releaseKeepCount(), 3);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-prune-env-'));
    const base = Date.now();
    for (let i = 0; i < 5; i += 1) {
      touchDir(root, `REL-${i}`, base - (5 - i) * 1000);
    }
    const result = pruneReleaseDirs(root);
    assert.equal(result.kept.length, 3);
    assert.equal(result.deleted.length, 2);
  } finally {
    if (prev === undefined) delete process.env.DEPLOY_KEEP_RELEASES;
    else process.env.DEPLOY_KEEP_RELEASES = prev;
  }
});
