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

test('free-floating text with unknown last4 does not create pending send', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-quote-'));
  process.env.ASIAPOWER_TELEGRAM_CHAT_ID = '8918522756';
  process.env.ASIAPOWER_TELEGRAM_BOT_TOKEN = '0:test';
  process.env.WHATSAPP_TELEGRAM_DESK = 'on';
  const prevOpenAi = process.env.OPENAI_API_KEY;
  const prevOr = process.env.OPENROUTER_API_KEY;
  // Keep keys present-but-empty so loadEnv(AsiaPower) won't refill them.
  process.env.OPENAI_API_KEY = '';
  process.env.OPENROUTER_API_KEY = '';
  const { resetConfig } = require('../server/lib/telegram-notify.js');
  resetConfig();
  try {
    const result = await handleTelegramUpdate(root, {
      message: {
        chat: { id: 8918522756 },
        text: '给尾号9999回消息说有现货',
        from: { username: 'ceo' },
      },
    });
    assert.equal(result.handled, true);
    assert.ok(
      ['desk_resolve_fail', 'desk_fallback', 'desk_chat', 'plain_chat_help'].includes(result.reason),
      `unexpected reason ${result.reason}`,
    );
    assert.equal(fs.existsSync(path.join(root, 'data/whatsapp_cloud/telegram_quote/pending.json')), false);
  } finally {
    if (prevOpenAi) process.env.OPENAI_API_KEY = prevOpenAi;
    else delete process.env.OPENAI_API_KEY;
    if (prevOr) process.env.OPENROUTER_API_KEY = prevOr;
    else delete process.env.OPENROUTER_API_KEY;
  }
});

test('reply-to bound message accepts custom non-price text', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-quote-'));
  process.env.ASIAPOWER_TELEGRAM_CHAT_ID = '8918522756';
  process.env.ASIAPOWER_TELEGRAM_BOT_TOKEN = '0:test';
  const { resetConfig } = require('../server/lib/telegram-notify.js');
  resetConfig();
  registerBinding(root, '77', {
    wa_id: '233242814122',
    profile_name: 'Moses',
    phone_number_id: 'pnid',
    inbound_snippet: 'need gearbox',
  });
  const result = await handleTelegramUpdate(root, {
    message: {
      chat: { id: 8918522756 },
      text: 'We have stock. If you confirm we can arrange dismantling.',
      reply_to_message: { message_id: 77 },
      from: { username: 'ceo' },
    },
  });
  assert.equal(result.handled, true);
  assert.equal(result.reason, 'confirm_prompted');
  const pending = JSON.parse(
    fs.readFileSync(path.join(root, 'data/whatsapp_cloud/telegram_quote/pending.json'), 'utf8'),
  );
  const row = pending[result.pending_id];
  assert.equal(row.wa_id, '233242814122');
  assert.equal(row.kind, 'message');
  assert.match(row.outbound, /dismantling/);
});
