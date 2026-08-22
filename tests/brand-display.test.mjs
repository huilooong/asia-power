import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js/brand-display.js'), 'utf8');

function loadBrandDisplay() {
  const document = {
    body: null,
    readyState: 'loading',
    addEventListener() {},
  };
  const window = { location: { pathname: '/' } };
  const sandbox = {
    window,
    document,
    MutationObserver: class {},
    NodeFilter: { SHOW_TEXT: 4 },
    console,
  };
  vm.runInNewContext(SOURCE, sandbox, { filename: 'brand-display.js' });
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
      closest() { return null; },
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

