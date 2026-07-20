'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  maskWa,
  clipLabel,
  fullText,
  formatInboundMessage,
  formatOutboundLines,
  chunkTelegramText,
} = require('../server/lib/whatsapp-cloud-telegram-monitor.js');

test('maskWa keeps last 4 digits only', () => {
  assert.equal(maskWa('19402375223'), '…5223');
  assert.equal(maskWa('+233 209 664 844'), '…4844');
  assert.equal(maskWa(''), '????');
});

test('formatInboundMessage keeps full customer text (no summary clip)', () => {
  const long = 'A'.repeat(1200);
  const text = formatInboundMessage(
    { wa_id: '19402375223', profile_name: 'Test', text: long, message_type: 'text' },
    'live',
  );
  assert.match(text, /📲 WhatsApp 客户原文 · live/);
  assert.match(text, /客户: …5223 \(Test\)/);
  assert.ok(text.includes(long), 'must include full customer body');
  assert.ok(!text.includes('…A'), 'must not truncate with ellipsis mid-body');
  assert.match(text, /回复本条/);
});

test('formatOutboundLines keeps full customer + reply originals', () => {
  const customer = 'Hello AsiaPower, I need a gearbox for Corolla 2015 automatic.';
  const reply = Array.from({ length: 20 }, (_, i) => `Line ${i + 1} of the full reply.`).join('\n');
  const text = formatOutboundLines({
    mode: 'live',
    decision: 'commercial_decision',
    waId: '2203393936',
    profileName: 'Buyer',
    inboundType: 'text',
    inboundText: customer,
    replyText: reply,
    sent: true,
    riskBlocked: false,
  });
  assert.match(text, /🤖 子敬原文回复/);
  assert.ok(text.includes(customer));
  assert.ok(text.includes(reply));
  assert.match(text, /—— 客户原文 ——/);
  assert.match(text, /—— 子敬原文 ——/);
});

test('fullText preserves newlines', () => {
  assert.equal(fullText('  hi\nthere  '), 'hi\nthere');
});

test('clipLabel only shortens names', () => {
  assert.equal(clipLabel('abc'), 'abc');
  assert.ok(clipLabel('x'.repeat(80), 40).endsWith('…'));
});

test('chunkTelegramText splits overlimit', () => {
  const parts = chunkTelegramText('x'.repeat(5000), 3900);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((p) => p.length <= 3920));
});
