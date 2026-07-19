'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadQuoteList() {
  const code = fs.readFileSync(
    path.join(__dirname, '../js/quote-list.js'),
    'utf8',
  );
  const store = new Map();
  const sandbox = {
    document: {
      addEventListener() {},
      querySelectorAll() { return []; },
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
  };
  sandbox.window = {
    addEventListener() {},
    dispatchEvent() { return true; },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.CustomEvent = sandbox.CustomEvent;
  // IIFE uses bare localStorage/document/window identifiers
  sandbox.localStorage = sandbox.localStorage;
  sandbox.document = sandbox.document;
  sandbox.CustomEvent = sandbox.CustomEvent;
  vm.runInNewContext(code, sandbox);
  return sandbox.window.QuoteList;
}

test('quote list add + bulk message includes stock and price', () => {
  const Q = loadQuoteList();
  Q.clear();
  Q.add({
    stockId: 'HC250583',
    brand: 'Haval',
    model: 'H6',
    year: 2013,
    priceUsd: 1800,
    pageUrl: 'https://asia-power.com/half-cuts/detail.html?slug=x',
  });
  Q.add({
    stockId: 'HC250507',
    brand: 'Honda',
    model: 'CR-V',
    partType: 'engine',
    partLabel: 'Engine',
    priceUsd: 942,
    priceNote: 'estimate',
  });
  assert.equal(Q.count(), 2);
  const msg = Q.buildBulkMessage();
  assert.match(msg, /HC250583/);
  assert.match(msg, /1800/);
  assert.match(msg, /HC250507/);
  assert.match(msg, /Engine/);
  assert.match(msg, /quote list inquiry/i);
});
