import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  VISUAL_V1_SHARED_FILES,
  VISUAL_V1_VERSION,
  listVisualV1HtmlFiles,
} from '../scripts/lib/release-manager.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directorySource = fs.readFileSync(path.join(ROOT, 'js/half-cut-directory.js'), 'utf8');
const homeSource = fs.readFileSync(path.join(ROOT, 'js/home-v4-hybrid.js'), 'utf8');
const detailSource = fs.readFileSync(path.join(ROOT, 'js/half-cut-detail.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(ROOT, 'css/visual-consistency-v1.css'), 'utf8');
const i18nSource = fs.readFileSync(path.join(ROOT, 'js/public-i18n.js'), 'utf8');
const nginxSecuritySource = fs.readFileSync(path.join(ROOT, 'deploy/nginx-security.conf'), 'utf8');
const apiSecuritySource = fs.readFileSync(path.join(ROOT, 'server/lib/security-paths.js'), 'utf8');

function loadHalfCutUtils() {
  const window = {
    location: { pathname: '/' },
    PublicI18n: { t: (_key, fallback) => fallback },
  };
  class FakeRequest {
    open() {}
    send() { this.status = 404; }
  }
  vm.runInNewContext(directorySource, {
    window,
    console,
    XMLHttpRequest: FakeRequest,
    URL,
    URLSearchParams,
  }, { filename: 'half-cut-directory.js' });
  return window.HalfCutUtils;
}

test('YouTube inventory uses a guarded video thumbnail above the customer-photo fallback', () => {
  const utils = loadHalfCutUtils();
  const item = {
    stockId: 'HC-VIDEO-YT',
    brand: 'Toyota',
    model: 'Camry',
    videoUrl: 'https://youtu.be/abcdefghijk',
    photos: [{ url: '/uploads/photos/original-evidence.jpg' }],
  };
  const html = utils.renderListingVideoCover(item, 'ebay-card__photo');
  assert.match(html, /data-ap-video-cover="youtube"/);
  assert.match(html, /ap-media-cover__fallback[^>]+original-evidence\.jpg/);
  assert.match(html, /data-ap-youtube-thumb/);
  assert.match(html, /i\.ytimg\.com\/vi\/abcdefghijk\/hqdefault\.jpg/);
  assert.ok(html.indexOf('ap-media-cover__fallback') < html.indexOf('data-ap-youtube-thumb'));
  assert.match(html, /ap-media-cover__play/);
  assert.doesNotMatch(html, /<iframe/);
  assert.deepEqual(item.photos, [{ url: '/uploads/photos/original-evidence.jpg' }]);
});

test('failed YouTube thumbnails stay hidden while the same-origin evidence photo remains visible', () => {
  assert.match(cssSource, /\.ap-media-cover__video-thumb\s*\{[\s\S]*?opacity:\s*0/);
  assert.match(cssSource, /\.ap-media-cover__video-thumb\.is-ready\s*\{\s*opacity:\s*1/);
  assert.match(directorySource, /naturalWidth\s*>\s*0/);
  assert.match(homeSource, /naturalWidth\s*>\s*0/);
  assert.match(cssSource, /data-ap-video-cover="youtube"[\s\S]*?object-fit:\s*contain\s*!important/);
});

test('hosted MP4 cover is muted, lazy-bound and keeps the first photo as poster', () => {
  const utils = loadHalfCutUtils();
  const item = {
    stockId: 'HC-VIDEO-MP4',
    brand: 'Isuzu',
    model: 'Giga',
    video: { url: '/uploads/videos/walkaround.mp4', mimeType: 'video/mp4' },
    photos: [{ url: '/uploads/photos/evidence-1.jpg' }],
  };
  const html = utils.renderListingVideoCover(item, 'ebay-listing-row__photo');
  assert.match(html, /data-ap-video-cover="hosted"/);
  assert.match(html, /muted loop playsinline preload="metadata"/);
  assert.match(html, /poster="\/uploads\/photos\/evidence-1\.jpg"/);
  assert.match(directorySource, /IntersectionObserver/);
  assert.match(directorySource, /prefers-reduced-motion/);
  assert.match(directorySource, /navigator\.connection\?\.saveData/);
});

test('all customer photos use a 4:3 contain canvas without visual filtering', () => {
  const utils = loadHalfCutUtils();
  assert.equal(utils.listingPhotoUseContain({ vehicleCategory: 'passenger' }), true);
  assert.match(cssSource, /\.ap-media-canvas\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(cssSource, /\.ap-media-cover__visual\s*\{[\s\S]*?object-fit:\s*contain\s*!important/);
  assert.match(cssSource, /filter:\s*none\s*!important/);
});

test('homepage and detail share video-first media ordering', () => {
  assert.match(homeSource, /if \(youtubeId\)[\s\S]*?data-ap-video-cover="youtube"/);
  assert.match(homeSource, /if \(mime\)[\s\S]*?data-ap-cover-video/);
  assert.match(homeSource, /bindCoverVideos\(document\)/);
  assert.match(detailSource, /<div class="hc-item-detail__media-col">\s*\$\{videoSection\}\s*\$\{gallery\}/);
  assert.match(detailSource, /u\.bindListingCoverVideos\?\.\(root\)/);
});

test('media labels are explicit in English, Chinese, French and Arabic', () => {
  assert.match(i18nSource, /'home\.video': \{ en: 'Video', zh: '视频', fr: 'Vidéo', ar: 'فيديو' \}/);
  assert.match(i18nSource, /'hc\.video': \{ en: 'Video', zh: '视频', fr: 'Vidéo', ar: 'مقطع الفيديو'\}/);
  assert.match(i18nSource, /'hc\.vehicleVideo': \{ en: 'Vehicle video', zh: '车辆视频', fr: 'Vidéo du véhicule', ar: 'فيديو المركبة'\}/);
});

test('nginx and API CSP both allow only the required YouTube image and frame origins', () => {
  for (const source of [nginxSecuritySource, apiSecuritySource]) {
    assert.match(source, /img-src[^\n]+https:\/\/i\.ytimg\.com/);
    assert.match(source, /frame-src[^\n]+https:\/\/www\.youtube\.com[^\n]+https:\/\/www\.youtube-nocookie\.com/);
    assert.doesNotMatch(source, /frame-src 'none'/);
  }
});

test('site-wide release manifest and cache keys include every changed media renderer', () => {
  for (const file of [
    'js/brand-page.js',
    'js/ebay-catalog-hub.js',
    'js/half-cut-detail.js',
    'js/half-cut-directory.js',
    'js/home-v4-hybrid.js',
  ]) {
    assert.ok(VISUAL_V1_SHARED_FILES.includes(file), `release manifest missing ${file}`);
  }

  for (const rel of listVisualV1HtmlFiles(ROOT)) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const script of ['brand-page', 'ebay-catalog-hub', 'half-cut-detail', 'half-cut-directory', 'home-v4-hybrid']) {
      if (html.includes(`js/${script}.js?v=`)) {
        assert.ok(html.includes(`js/${script}.js?v=${VISUAL_V1_VERSION}`), `${rel}: ${script}`);
      }
    }
  }
});

test('media presentation diff does not touch inventory, uploads or API runtime outside the two reviewed lookup/security files', () => {
  const changed = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const protectedChanges = changed.filter((file) => /^(data|server|uploads)\//.test(file)
    && !['server/lib/vin/zh-en-seed.js', 'server/lib/security-paths.js'].includes(file));
  assert.deepEqual(protectedChanges, [], changed.join(', '));
  for (const source of [directorySource, homeSource, detailSource]) {
    assert.doesNotMatch(source, /photos\.(?:splice|shift|unshift|sort)\(/);
  }
});
