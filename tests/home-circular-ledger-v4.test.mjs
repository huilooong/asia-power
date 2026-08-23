import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/home-v4-hybrid.css', import.meta.url), 'utf8');
const homeJs = fs.readFileSync(new URL('../js/home-v4-hybrid.js', import.meta.url), 'utf8');
const i18nJs = fs.readFileSync(new URL('../js/public-i18n.js', import.meta.url), 'utf8');

function loadI18n(search) {
  const storage = new Map();
  const context = {
    window: {
      location: { pathname: '/', search },
      addEventListener() {},
      dispatchEvent() {},
    },
    document: {
      body: null,
      addEventListener() {},
      documentElement: { lang: 'en', dir: 'ltr', classList: { toggle() {} } },
    },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    navigator: { language: 'en' },
    URLSearchParams,
    CustomEvent: class CustomEvent {},
    console,
  };
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.navigator = context.navigator;
  vm.runInNewContext(i18nJs, context, { filename: 'public-i18n.js' });
  return context.window.PublicI18n;
}

test('production homepage preserves required business and release contracts', () => {
  assert.match(html, /data-release-i18n-contract="home\.v4\.hero\.title"/);
  assert.doesNotMatch(html, /pwa-install\.(?:js|css)/);
  for (const marker of [
    '/api/half-cuts/public', 'home-v4-hybrid', 'circular-ledger', 'cat-grid',
    'rail-half', 'rail-engines', 'rail-trucks', 'rail-machinery', 'rail-used',
    'data-mnav-toggle', 'data-mnav-drawer', 'data-ap-auth-slot', 'pwa-app-v6c',
    'engine-card-label.js', 'nav-list-direct-v1',
  ]) assert.ok(html.includes(marker), `missing ${marker}`);
  assert.equal((html.match(/<form class="procurement-search"/g) || []).length, 1);
  assert.doesNotMatch(html, /home-v5-redesign|hero-powertrain-redesign/);
});

test('circular ledger uses live evidence and keeps video-first media resilience', () => {
  for (const marker of [
    'selectLedgerItems', 'renderLedger', 'evidenceCount', 'coverMedia',
    'data-ap-video-cover="hosted"', 'data-ap-video-cover="youtube"',
    'bindCoverVideos', "fetch('/api/half-cuts/public'", 'translate="no"',
  ]) assert.ok(homeJs.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(homeJs, /ENGINE_RATIO|priceUsd\s*\*\s*0\.65/);
  assert.doesNotMatch(homeJs, /110<|24<h|24<em>h/);
});

test('official make-name boundary is explicit and Latin makes are uppercase', () => {
  assert.match(homeJs, /FANGCHENGBAO:\s*'方程豹'/);
  assert.match(homeJs, /DENZA:\s*'腾势'/);
  assert.match(homeJs, /TOYOTA:\s*'丰田'/);
  assert.match(homeJs, /toLocaleUpperCase\('en-US'\)/);
  assert.match(homeJs, /registered international[\s\S]*machine-translating/);
});

test('new homepage copy is complete in EN, ZH, FR and AR', () => {
  const keys = [
    'home.circular.searchButton', 'home.circular.heroTitle', 'home.circular.heroLead',
    'home.circular.ledgerTitle', 'home.circular.cycleTitle', 'home.circular.routesTitle',
    'home.circular.evidenceTitle', 'home.circular.proofVerifiedText',
    'home.circular.footerNeedText',
  ];
  for (const lang of ['en', 'zh', 'fr', 'ar']) {
    const api = loadI18n(`?lang=${lang}`);
    assert.equal(api.getLang(), lang);
    for (const key of keys) assert.notEqual(api.t(key), key, `${lang} missing ${key}`);
    assert.equal(api.isRtl(lang), lang === 'ar');
  }
});

test('homepage shelf status uses the shared four-language status translator', () => {
  assert.match(homeJs, /PublicI18n\?\.translateStatus/);
  assert.match(homeJs, /inventoryStatusLabel\(item\.status\)/);
});

test('responsive and RTL layout rules cover ledger, search, routes and shelves', () => {
  for (const marker of [
    '@media (max-width: 1030px)', '@media (max-width: 680px)',
    'grid-template-areas: "media identity price"', 'html[dir="rtl"]',
    'scroll-snap-type: x proximity', 'touch-action: pan-x pan-y',
  ]) assert.ok(css.includes(marker), `missing ${marker}`);
});
