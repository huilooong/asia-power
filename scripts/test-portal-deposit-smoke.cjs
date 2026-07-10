#!/usr/bin/env node
/**
 * Smoke tests for portal-deposit-v1 core modules (no HTTP server required).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizePhone, phonesMatch } = require('../server/lib/phone-normalize');
const { createOrderStore } = require('../server/lib/buyer-orders');
const { createStripeDeposit } = require('../server/lib/stripe-deposit');

async function main() {
  assert.strictEqual(normalizePhone('16638801930', '+86'), '8616638801930');
  assert.strictEqual(normalizePhone('+86 166-3880-1930'), '8616638801930');
  assert.ok(phonesMatch('16638801930', '8616638801930', '+86'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-orders-'));
  const orders = createOrderStore(tmp);
  const order = orders.createOrder({
    buyerId: 'buy-1',
    stockId: 'HC250127',
    title: 'Lexus LX570',
    exwUsd: 5900,
  });
  assert.strictEqual(order.status, 'Quoted');
  assert.strictEqual(order.depositUsd, 1770);

  process.env.STRIPE_DEMO = '1';
  delete process.env.STRIPE_SECRET_KEY;
  let reserved = null;
  const stripe = createStripeDeposit({
    orderStore: orders,
    onDepositPaid: async (paid) => { reserved = paid.stockId; },
  });
  assert.ok(stripe.demoMode());
  const session = await stripe.createCheckoutSession(order);
  assert.ok(session.demo);
  assert.ok(session.id.startsWith('cs_test_demo_'));
  const paid = await stripe.completeDemoPayment(order.id);
  assert.strictEqual(paid.status, 'DepositPaid');
  assert.strictEqual(reserved, 'HC250127');

  console.log('OK portal-deposit-v1 smoke');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
