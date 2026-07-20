'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  heuristicIntent,
  resolveCustomer,
  listRecentCustomers,
} = require('../server/lib/whatsapp-cloud-telegram-desk.js');
const { registerBinding } = require('../server/lib/whatsapp-cloud-telegram-quote.js');

test('heuristicIntent detects last4 + stock/dismantle instruction', () => {
  const recent = [{ last4: '4122', wa_id: '233242814122', profile_name: 'Moses' }];
  const intent = heuristicIntent('给尾号4122的客户回消息，说有现货，他如果确定我们可以安排给他拆', recent);
  assert.equal(intent.action, 'propose_send');
  assert.equal(intent.last4, '4122');
  assert.match(intent.outbound, /stock/i);
  assert.match(intent.outbound, /dismantl/i);
});

test('resolveCustomer matches unique last4 from bindings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-desk-'));
  registerBinding(root, '9', {
    wa_id: '233242814122',
    profile_name: 'Moses',
    phone_number_id: 'pn',
    inbound_snippet: 'gearbox',
  });
  const recent = listRecentCustomers(root, 10);
  assert.equal(recent[0].last4, '4122');
  const hit = resolveCustomer(root, { last4: '4122' });
  assert.equal(hit.ok, true);
  assert.equal(hit.customer.wa_id, '233242814122');
});
