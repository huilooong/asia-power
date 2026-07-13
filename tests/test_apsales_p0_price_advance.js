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

test('APPROVAL_REQUEST leak is stripped / rewritten for VIN inbound', () => {
  const leaked =
    'Dear Customer,\n\nThank you for VIN LFBME3062EJB07697.\n\nBest regards,\nAsiaPower Sales Team\n' +
    'APPROVAL_REQUEST: action=external_message | risk=medium | why=Send draft';
  const r = applyRiskPolicy(leaked, 'LFBME3062EJB07697');
  assert.equal(r.reason_code, 'whatsapp_style_vin');
  assert.doesNotMatch(r.text, /APPROVAL_REQUEST|Dear Customer|Best regards/i);
  assert.match(r.text, /VIN|quantity|port/i);
});
