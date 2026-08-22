import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/brand-display.js'), 'utf8');

function loadBrandDisplay(initialLang = 'en') {
  let lang = initialLang;
  const document = {
    body: null,
    readyState: 'loading',
    documentElement: { lang: 'en' },
    addEventListener() {},
  };
  const window = {
    location: { pathname: '/' },
    PublicI18n: { getLang: () => lang },
  };
  const sandbox = {
    window,
    document,
    MutationObserver: class {},
    NodeFilter: { SHOW_TEXT: 4 },
    console,
  };
  vm.runInNewContext(SOURCE, sandbox, { filename: 'brand-display.js' });
  window.AsiaPowerBrandDisplay.setTestLang = (next) => { lang = next; };
  return window.AsiaPowerBrandDisplay;
}

test('automotive make tokens render uppercase while model casing remains intact', () => {
  const api = loadBrandDisplay();
  assert.equal(api.uppercaseBrandTokens('Toyota Yaris 1ZR-FE'), 'TOYOTA Yaris 1ZR-FE');
  assert.equal(api.uppercaseBrandTokens('Mercedes-Benz C-Class'), 'MERCEDES-BENZ C-Class');
  assert.equal(api.uppercaseBrandTokens('Shacman X3000 and Isuzu ELF'), 'SHACMAN X3000 and ISUZU ELF');
});

test('brand display processing changes visible text nodes only', () => {
  const api = loadBrandDisplay();
  const inventory = { brand: 'Toyota', slug: 'toyota-yaris', title: 'Toyota Yaris' };
  const textNode = {
    nodeType: 3,
    nodeValue: inventory.title,
    parentElement: {
      closest(selector) { return selector.includes('[data-brand]') ? {} : null; },
      querySelectorAll() { return []; },
    },
  };
  assert.equal(api.processRoot(textNode), 1);
  assert.equal(textNode.nodeValue, 'TOYOTA Yaris');
  assert.deepEqual(inventory, { brand: 'Toyota', slug: 'toyota-yaris', title: 'Toyota Yaris' });
});

test('metadata and structured-data containers are explicitly excluded', () => {
  assert.match(SOURCE, /'script', 'style', 'noscript'/);
  assert.match(SOURCE, /processRoot\(document\.body\)/);
  assert.doesNotMatch(SOURCE, /document\.title\s*=/);
  assert.doesNotMatch(SOURCE, /querySelectorAll\(['"]script\[type=/);
});

test('unknown live inventory makes can be registered without touching source data', () => {
  const api = loadBrandDisplay();
  const item = { brand: 'Example Motors' };
  assert.equal(api.registerBrand(item.brand), true);
  assert.equal(api.uppercaseBrandTokens('Example Motors Atlas'), 'EXAMPLE MOTORS Atlas');
  assert.equal(item.brand, 'Example Motors');
});

test('FANGCHENGBAO is deterministic in all four languages and never becomes 方城堡', () => {
  const api = loadBrandDisplay();
  assert.equal(api.officialBrandName('Fangchengbao', 'en'), 'FANGCHENGBAO');
  assert.equal(api.officialBrandName('Fang Cheng Bao', 'fr'), 'FANGCHENGBAO');
  assert.equal(api.officialBrandName('FANGCHENGBAO', 'ar'), 'FANGCHENGBAO');
  assert.equal(api.officialBrandName('方程豹', 'zh'), '方程豹');
  assert.equal(api.localizeBrandTokens('2025 Fangchengbao BAO 5', 'zh'), '2025 方程豹 BAO 5');
  assert.doesNotMatch(SOURCE, /方城堡/);
});

test('language switching is lossless and never re-translates a rendered brand', () => {
  const api = loadBrandDisplay('en');
  const textNode = {
    nodeType: 3,
    nodeValue: '2025 Fangchengbao BAO 5',
    parentElement: {
      closest(selector) { return selector.includes('[data-brand]') ? {} : null; },
      querySelectorAll() { return []; },
    },
  };
  api.processRoot(textNode);
  assert.equal(textNode.nodeValue, '2025 FANGCHENGBAO BAO 5');
  api.setTestLang('zh');
  api.processRoot(textNode);
  assert.equal(textNode.nodeValue, '2025 方程豹 BAO 5');
  api.setTestLang('fr');
  api.processRoot(textNode);
  assert.equal(textNode.nodeValue, '2025 FANGCHENGBAO BAO 5');
  api.setTestLang('ar');
  api.processRoot(textNode);
  assert.equal(textNode.nodeValue, '2025 FANGCHENGBAO BAO 5');
});

test('Chinese localization is limited to make/product contexts, not ordinary prose', () => {
  const api = loadBrandDisplay('zh');
  const proseNode = {
    nodeType: 3,
    nodeValue: 'A man checks the seat and tank; dosage is 5 mg.',
    parentElement: {
      closest() { return null; },
      querySelectorAll() { return []; },
    },
  };
  api.processRoot(proseNode);
  assert.equal(proseNode.nodeValue, 'A MAN checks the SEAT and TANK; dosage is 5 MG.');
  assert.doesNotMatch(proseNode.nodeValue, /曼恩|西雅特|坦克|名爵/);
});

test('every make observed in the production inventory snapshot has four controlled names', () => {
  const api = loadBrandDisplay();
  const liveMakes = [
    'Audi', 'Beiben', 'BMW', 'Buick', 'BYD', 'Cadillac', 'CAMC', 'Changan',
    'Changan Kuayue', 'Chery', 'Chevrolet', 'Chrysler', 'Citroën', 'Denza',
    'Dodge', 'Dongfanghong', 'Dongfeng', 'Fangchengbao', 'FAW', 'Ford', 'Geely',
    'GMC', 'Great Wall', 'Haval', 'Hino', 'Honda', 'Hongyan', 'HOWO', 'Hyundai',
    'Hyundai Trucks', 'Isuzu', 'JAC', 'Jeep', 'Jinbei', 'JMC', 'Kia', 'Land Rover',
    'Lexus', 'Liebao', 'Lonking', 'Lovol', 'MAN', 'Maxus', 'Mazda', 'Mercedes-Benz',
    'MG', 'Mitsubishi', 'Nissan', 'Peugeot', 'Roewe', 'Sany', 'Shaanxi Auto',
    'Shacman', 'Sinotruk', 'Suzuki', 'Tank', 'Toyota', 'Volkswagen', 'Volvo', 'Wuling',
  ];
  for (const make of liveMakes) {
    const en = api.officialBrandName(make, 'en');
    assert.ok(api.OFFICIAL_BRAND_NAMES[en], `uncontrolled live make: ${make}`);
    for (const lang of ['en', 'zh', 'fr', 'ar']) {
      assert.ok(api.officialBrandName(make, lang), `${make}:${lang}`);
    }
    assert.equal(api.officialBrandName(make, 'fr'), en, `${make}:fr trademark`);
    assert.equal(api.officialBrandName(make, 'ar'), en, `${make}:ar trademark`);
  }
});
