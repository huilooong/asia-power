'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseQuoteInput,
  registerBinding,
  getBinding,
  handleTelegramUpdate,
} = require('../server/lib/whatsapp-cloud-telegram-quote.js');

test('parseQuoteInput accepts common CEO formats', () => {
  assert.deepEqual(parseQuoteInput('450').label, 'USD 450');
  assert.equal(parseQuoteInput('$450').amount, '450');
  assert.equal(parseQuoteInput('450 USD').currency, 'USD');
  assert.equal(parseQuoteInput('EXW 450').incoterm, 'EXW');
  assert.equal(parseQuoteInput('EXW $520 USD').label, 'EXW USD 520');
  assert.match(parseQuoteInput('450 USD | Hello Moses').outbound, /Hello Moses/);
  assert.equal(parseQuoteInput('hello there'), null);
  assert.equal(parseQuoteInput('send to last customer 450'), null);
});

test('binding is keyed by telegram message id only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-quote-'));
  registerBinding(root, '111', {
    wa_id: '233242814122',
    profile_name: 'Moses',
    phone_number_id: 'pnid1',
    inbound_snippet: 'Ok noted',
  });
  registerBinding(root, '222', {
    wa_id: '15551234567',
    profile_name: 'Other',
    phone_number_id: 'pnid2',
    inbound_snippet: 'price?',
  });
  assert.equal(getBinding(root, '111').wa_id, '233242814122');
  assert.equal(getBinding(root, '222').wa_id, '15551234567');
  assert.equal(getBinding(root, '999'), null);
});

test('free-floating telegram text is never handled as quote', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-quote-'));
  process.env.TELEGRAM_CHAT_ID = '8918522756';
  process.env.ASIAPOWER_TELEGRAM_CHAT_ID = '8918522756';
  const { resetConfig } = require('../server/lib/telegram-notify.js');
  resetConfig();
  const result = await handleTelegramUpdate(root, {
    message: {
      chat: { id: 8918522756 },
      text: '450 USD',
      from: { username: 'ceo' },
    },
  });
  assert.equal(result.handled, false);
  assert.equal(result.reason, 'not_reply');
});
