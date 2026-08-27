import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TARGET_REMOTE_PATHS, TARGET_SOURCE_FILES } from '../scripts/lib/release-manager.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('secondary design tokens enforce the agreed visual hierarchy', () => {
  const css = read('css/sitewide-secondary-v1.css');
  assert.match(css, /--ap2-ink:\s*#151714/);
  assert.match(css, /--ap2-paper:\s*#f5f1e8/);
  assert.match(css, /--ap2-gold:\s*#b66d05/);
  assert.match(css, /--ap2-verified:\s*#17683d/);
  assert.match(css, /--ap2-whatsapp:\s*#25d366/);
  assert.match(css, /--ap2-max:\s*1500px/);
  assert.match(css, /\.hc-item-detail__btn--primary[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.ebay-sidebar\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /body\[data-page="quote-list"\]\s+\.quote-list-actions\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test('shared public shell uses one navigation, search band and footer', () => {
  const components = read('js/components.js');
  assert.match(components, /function renderEbayHeader\(/);
  assert.match(components, /ap-secondary-nav__links/);
  assert.match(components, /ap-secondary-search-band/);
  assert.match(components, /function renderEbayTrustFooter\(/);
  assert.match(components, /ap-secondary-footer__main/);
  assert.match(components, /sitewide-secondary-v1\.css/);
});

test('structured vehicle brands use official language-aware display names', () => {
  const i18n = read('js/public-i18n.js');
  const main = read('js/main.js');
  const brandPage = read('js/brand-page.js');
  const catalog = read('js/ebay-catalog-hub.js');
  const engineLabel = read('js/engine-card-label.js');

  assert.match(i18n, /fangchengbao:\s*\{\s*zh:\s*'方程豹',\s*global:\s*'FANGCHENGBAO'/);
  assert.match(i18n, /toyota:\s*\{\s*zh:\s*'丰田',\s*global:\s*'TOYOTA'/);
  assert.match(i18n, /function officialBrandName\(/);
  for (const source of [main, brandPage, catalog, engineLabel]) {
    assert.match(source, /officialBrandName/);
  }
  assert.doesNotMatch(i18n, /方城堡/);
});

test('catalog and detail actions preserve Get Quote as primary and WhatsApp as fast path', () => {
  const catalog = read('js/ebay-catalog-hub.js');
  const directory = read('js/half-cut-directory.js');
  const detail = read('js/half-cut-detail.js');

  assert.match(catalog, /t\('hc\.getQuote',\s*'Get Quote'\)/);
  assert.doesNotMatch(catalog, /\$\{watchHtml\}\$\{addHtml\}/);
  assert.match(directory, /nav\.requestQuote/);
  assert.match(directory, /WhatsApp/);
  assert.doesNotMatch(directory, /Request Photos/);
  assert.match(detail, /hc-item-detail__btn--primary/);
  assert.doesNotMatch(detail, /hc-item-detail__btn--facebook/);
});

test('representative public page families load the shared design with translation protection', () => {
  const files = [
    'about.html',
    'contact.html',
    'brands.html',
    'ghana.html',
    'half-cuts/index.html',
    'half-cuts/detail.html',
    'used-cars/detail.html',
    'trucks/index.html',
    'machinery/index.html',
    'engines/index.html',
    'engines/1nz-fe.html',
    'gearboxes/index.html',
    'guides/buying-used-engines-from-china.html',
    'brands/toyota.html',
    'privacy.html',
    'quote-list.html',
  ];

  for (const file of files) {
    const html = read(file);
    assert.match(html, /<meta name="google" content="notranslate">/, file);
    assert.match(html, /sitewide-secondary-v1\.css\?v=sitewide-secondary-v1/, file);
    assert.match(html, /js\/components\.js\?v=sitewide-secondary-v1/, file);
  }
});

test('editorial pages bypass the catalog sidebar wrapper', () => {
  const layout = read('js/ebay-layout.js');
  assert.match(layout, /\['about',\s*'contact',\s*'brands',\s*'privacy',\s*'quote-list'\]/);
  assert.match(layout, /publicPage\.startsWith\('brand-'\)/);
  assert.match(layout, /publicPage\.startsWith\('market-'\)/);
  assert.match(layout, /main\.dataset\.ebayShell\s*=\s*'editorial-full'/);
});

test('Release Manager covers every sitewide page family and rollback boundary', () => {
  const source = TARGET_SOURCE_FILES.chrome;
  const remote = TARGET_REMOTE_PATHS.chrome;
  const pageFamilies = [
    'half-cuts/index.html',
    'trucks/index.html',
    'machinery/index.html',
    'engines',
    'brands',
    'gearboxes/index.html',
    'front-cuts/index.html',
    'chassis-parts/index.html',
    'truck-heads/index.html',
    'tires/index.html',
    'guides/index.html',
    'js/powertrain-image-catalog.js',
    'assets/images/powertrain-photo-placeholder.svg',
    'assets/images/powertrain-models',
  ];

  for (const file of pageFamilies) {
    assert.ok(source.includes(file), `missing chrome source boundary: ${file}`);
    assert.ok(
      remote.includes(`/root/.openclaw/workspace/inventory-site/public/${file}`),
      `missing chrome rollback boundary: ${file}`,
    );
  }
});
