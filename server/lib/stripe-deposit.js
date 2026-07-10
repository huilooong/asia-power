'use strict';

const crypto = require('crypto');

/**
 * Stripe Checkout for buyer deposits.
 * Uses raw HTTPS to api.stripe.com (no stripe npm dependency required).
 * When STRIPE_SECRET_KEY is missing, demo mode returns simulated session URLs.
 */

function stripeEnabled() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim());
}

function demoMode() {
  return process.env.STRIPE_DEMO === '1' || !stripeEnabled();
}

async function stripeRequest(method, apiPath, body) {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');

  const url = `https://api.stripe.com${apiPath}`;
  const headers = {
    Authorization: `Bearer ${key}`,
  };
  let payload;
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams();
    flattenStripeParams(body, payload);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: payload ? payload.toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Stripe HTTP ${res.status}`;
    const err = new Error(msg);
    err.statusCode = res.status;
    err.stripe = data;
    throw err;
  }
  return data;
}

function flattenStripeParams(obj, params, prefix = '') {
  for (const [key, value] of Object.entries(obj || {})) {
    const full = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      flattenStripeParams(value, params, full);
    } else {
      params.append(full, String(value));
    }
  }
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  const header = String(signatureHeader || '');
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error('Invalid Stripe-Signature header');

  const toleranceSec = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SEC || 300);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) {
    throw new Error('Stripe webhook timestamp outside tolerance');
  }

  const signed = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Stripe webhook signature mismatch');
  }
  return JSON.parse(String(rawBody));
}

function createStripeDeposit({
  publicBaseUrl,
  orderStore,
  onDepositPaid,
}) {
  const base = () => String(publicBaseUrl || process.env.PUBLIC_BASE_URL || 'https://asia-power.com').replace(/\/$/, '');

  async function createCheckoutSession(order, { successUrl, cancelUrl, buyerEmail } = {}) {
    if (!order || order.status !== 'Quoted') {
      throw new Error('Order must be in Quoted status to pay deposit');
    }
    const amountCents = Math.round(Number(order.depositUsd) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      throw new Error('Deposit amount too small for Stripe');
    }

    if (demoMode()) {
      const sessionId = `cs_test_demo_${crypto.randomBytes(8).toString('hex')}`;
      orderStore.updateOrder(order.id, { stripeSessionId: sessionId });
      const success = successUrl || `${base()}/buyer-portal/?deposit=success&order=${encodeURIComponent(order.id)}`;
      return {
        id: sessionId,
        url: success + `&session_id=${sessionId}&demo=1`,
        demo: true,
        amountUsd: order.depositUsd,
      };
    }

    const session = await stripeRequest('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      success_url: successUrl || `${base()}/buyer-portal/?deposit=success&order=${encodeURIComponent(order.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${base()}/buyer-portal/?deposit=cancel&order=${encodeURIComponent(order.id)}`,
      client_reference_id: order.id,
      customer_email: buyerEmail || undefined,
      metadata: {
        orderId: order.id,
        stockId: order.stockId,
        type: 'deposit',
      },
      line_items: {
        0: {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Deposit 30% · ${order.stockId}`,
              description: order.title || order.stockId,
              metadata: {
                orderId: order.id,
                stockId: order.stockId,
              },
            },
          },
        },
      },
    });

    orderStore.updateOrder(order.id, { stripeSessionId: session.id });
    return {
      id: session.id,
      url: session.url,
      demo: false,
      amountUsd: order.depositUsd,
    };
  }

  async function handleWebhook(rawBody, signatureHeader) {
    let event;
    if (demoMode() && process.env.STRIPE_DEMO === '1') {
      event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } else {
      const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
      event = verifyWebhookSignature(rawBody, signatureHeader, secret);
    }

    if (event.type !== 'checkout.session.completed') {
      return { ok: true, ignored: true, type: event.type };
    }

    const session = event.data?.object || {};
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId) throw new Error('Webhook missing orderId');

    const order = orderStore.getById(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (order.status === 'DepositPaid') {
      return { ok: true, duplicate: true, order };
    }

    const paid = orderStore.markDepositPaid(orderId, {
      stripeSessionId: session.id || '',
      stripePaymentIntentId: session.payment_intent || '',
    });

    if (typeof onDepositPaid === 'function') {
      await onDepositPaid(paid, session);
    }

    return { ok: true, order: paid };
  }

  /** Complete a demo payment without Stripe (local / preview). */
  async function completeDemoPayment(orderId) {
    if (!demoMode()) throw new Error('Demo completion only when Stripe demo mode is on');
    const order = orderStore.getById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'DepositPaid') return order;
    const paid = orderStore.markDepositPaid(orderId, {
      stripeSessionId: order.stripeSessionId || `cs_test_demo_${Date.now()}`,
      stripePaymentIntentId: `pi_demo_${Date.now()}`,
    });
    if (typeof onDepositPaid === 'function') {
      await onDepositPaid(paid, { id: paid.stripeSessionId });
    }
    return paid;
  }

  return {
    stripeEnabled,
    demoMode,
    createCheckoutSession,
    handleWebhook,
    completeDemoPayment,
    verifyWebhookSignature,
  };
}

module.exports = {
  createStripeDeposit,
  stripeEnabled,
  demoMode,
  verifyWebhookSignature,
};
