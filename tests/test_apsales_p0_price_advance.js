'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyRiskPolicy } = require('../server/lib/whatsapp-cloud-sandbox.js');

test('price inquiries advance toward VIN/model, not refusal', () => {
  for (const inbound of ['How much?', 'Best price?', 'Quotation?', 'Price list?', 'Cheap?']) {
    const r = applyRiskPolicy('We cannot quote. Price is $5000 FOB.', inbound);
    assert.match(r.text, /VIN|engine code/i);
    assert.match(r.text, /pricing|quote|quotation/i);
    assert.doesNotMatch(r.text, /do not confirm stock or price|cannot quote/i);
    assert.doesNotMatch(r.text, /\$\s*\d|FOB\s*\d/i);
  }
});

test('non-price safe reply passes through', () => {
  const r = applyRiskPolicy('Hi\n\nWhat engine do you need?', 'Need G4KD');
  assert.equal(r.reason_code, 'ok');
  assert.match(r.text, /G4KD|engine/i);
});
