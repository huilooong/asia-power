import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALID_TARGETS,
  VISUAL_V1_SHARED_FILES,
  VISUAL_V1_VERSION,
  listChangedFiles,
  listVisualV1HtmlFiles,
  listVisualV1SourceFiles,
  parsePorcelainPath,
  resolveTargetRemotePaths,
} from '../scripts/lib/release-manager.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('visual-v1 manifest covers the full public display stack and exact internal cache shells', () => {
  const htmlFiles = listVisualV1HtmlFiles(ROOT);
  assert.ok(htmlFiles.length >= 199, `expected site-wide HTML coverage, got ${htmlFiles.length}`);
  for (const required of [
    'index.html',
    'half-cuts/index.html',
    'half-cuts/detail.html',
    'engines/index.html',
    'trucks/index.html',
    'machinery/index.html',
    'used-cars/detail.html',
    'brands/toyota.html',
    'login/index.html',
    'supplier-portal.html',
  ]) {
    assert.ok(htmlFiles.includes(required), `manifest missing ${required}`);
  }
  assert.ok(!htmlFiles.some((file) => file.startsWith('docs/')), 'docs evidence must not deploy');
});

test('every public V1 marker resolves to both presentation assets', () => {
  const htmlFiles = listVisualV1HtmlFiles(ROOT);
  let publicCount = 0;
  for (const rel of htmlFiles) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (!html.includes('data-visual-consistency-v1')) continue;
    publicCount += 1;
    assert.match(html, new RegExp(`visual-consistency-v1\\.css\\?v=${VISUAL_V1_VERSION}`), rel);
    assert.match(html, new RegExp(`brand-display\\.js\\?v=${VISUAL_V1_VERSION}`), rel);
  }
  assert.equal(publicCount, 188, 'public visual layer must cover all reviewed public shells');
});

test('admin and supplier upload tools receive cache keys but no public visual layer', () => {
  for (const rel of [
    'admin/inventory.html',
    'supplier-portal/half-cut-upload.html',
    'supplier-portal/truck-upload.html',
    'supplier-portal/export-used-car-upload.html',
  ]) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!html.includes('data-visual-consistency-v1'), `${rel} must keep its operational UI`);
    assert.ok(html.includes(`js/components.js?v=${VISUAL_V1_VERSION}`), `${rel} cache key`);
  }
});

test('shared component and path cache keys are consistent across the deployment manifest', () => {
  for (const rel of listVisualV1HtmlFiles(ROOT)) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (html.includes('js/components.js?v=')) {
      assert.ok(html.includes(`js/components.js?v=${VISUAL_V1_VERSION}`), rel);
    }
    if (html.includes('js/path-utils.js?v=')) {
      assert.ok(html.includes(`js/path-utils.js?v=${VISUAL_V1_VERSION}`), rel);
    }
  }
});

test('homepage mounts only the shared navigation and footer', () => {
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(home.includes('<div id="site-header"></div>'));
  assert.ok(home.includes('<div id="site-footer"></div>'));
  assert.ok(!home.includes('<nav class="ap-nav"'));
  assert.ok(!home.includes('<footer class="ap-footer"'));
});

test('quote-list shell is multilingual and uses the V1 quote-list cache key', () => {
  const html = fs.readFileSync(path.join(ROOT, 'quote-list.html'), 'utf8');
  const i18n = fs.readFileSync(path.join(ROOT, 'js/public-i18n.js'), 'utf8');
  assert.match(html, /data-i18n="quoteList\.title"/);
  assert.match(html, new RegExp(`js/quote-list\\.js\\?v=${VISUAL_V1_VERSION}`));
  for (const key of ['quoteList.title', 'quoteList.empty', 'quoteList.remove']) {
    assert.ok(i18n.includes(`'${key}'`), `missing ${key}`);
  }
});

test('all shared detail shells use the localized-detail cache key', () => {
  for (const rel of [
    'half-cuts/detail.html',
    'trucks/detail.html',
    'machinery/detail.html',
    'used-cars/detail.html',
  ]) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(html, /js\/half-cut-detail\.js\?v=site-visual-v1-20260822-1/, rel);
  }
});

test('release target has exact source/remote parity and a safe porcelain parser', () => {
  assert.ok(VALID_TARGETS.includes('visual-v1'));
  const sources = listVisualV1SourceFiles(ROOT);
  const remotes = resolveTargetRemotePaths(ROOT, 'visual-v1');
  assert.equal(sources.length, remotes.length);
  VISUAL_V1_SHARED_FILES.forEach((file) => assert.ok(sources.includes(file), file));
  assert.equal(parsePorcelainPath(' M index.html'), 'index.html');
  assert.equal(parsePorcelainPath('?? css/visual-consistency-v1.css'), 'css/visual-consistency-v1.css');
  assert.equal(parsePorcelainPath('R  old.html -> new.html'), 'new.html');
  const changed = listChangedFiles(ROOT, 'visual-v1');
  assert.ok(changed.planned.includes('index.html'));
  assert.ok(!changed.dirty.includes('ndex.html'));
});

test('production deploy implementation is exact-manifest rsync with no delete flag', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/deploy-production.mjs'), 'utf8');
  const section = source.slice(source.indexOf('function deployVisualV1()'), source.indexOf('function deployFinalize()'));
  assert.match(section, /listVisualV1SourceFiles\(ROOT\)/);
  assert.match(section, /\['-avR'/);
  assert.doesNotMatch(section, /--delete/);
  assert.match(section, /VISUAL_V1_MANIFEST_OK/);
  assert.match(section, /api\/half-cuts\/public/);
  assert.match(section, /127\.0\.0\.1:8080\/api\/half-cuts\/health/);
  assert.match(section, /127\.0\.0\.1:8080\/api\/half-cuts\/public/);
  assert.doesNotMatch(section, /127\.0\.0\.1:3000/);
});
