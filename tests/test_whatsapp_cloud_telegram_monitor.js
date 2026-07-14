'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  maskWa,
  clip,
  formatInboundLines,
  formatOutboundLines,
} = require('../server/lib/whatsapp-cloud-telegram-monitor.js');

test('maskWa keeps last 4 digits only', () => {
  assert.equal(maskWa('19402375223'), '…5223');
  assert.equal(maskWa('+233 209 664 844'), '…4844');
  assert.equal(maskWa(''), '????');
});

test('formatInboundLines includes mode and clipped body', () => {
  const text = formatInboundLines(
    [{ wa_id: '19402375223', profile_name: 'Test', text: 'Hello AsiaPower', message_type: 'text' }],
    'live',
  );
  assert.match(text, /📲 WhatsApp 客户消息 · live/);
  assert.match(text, /…5223 \(Test\): Hello AsiaPower/);
});

test('formatOutboundLines shows reply result', () => {
  const text = formatOutboundLines({
    mode: 'live',
    decision: 'commercial_decision',
    waId: '2203393936',
    profileName: 'Buyer',
    inboundType: 'text',
    inboundText: 'Hello',
    replyText: 'Which destination port?',
    sent: true,
    riskBlocked: false,
  });
  assert.match(text, /🤖 子敬已回复 · live · commercial_decision/);
  assert.match(text, /…3936 \(Buyer\)/);
  assert.match(text, /回复: Which destination port\?/);
  assert.match(text, /结果: 发送成功/);
});

test('clip truncates long text', () => {
  assert.equal(clip('abc'), 'abc');
  assert.ok(clip('x'.repeat(400), 50).endsWith('…'));
  assert.ok(clip('x'.repeat(400), 50).length <= 50);
});
