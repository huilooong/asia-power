'use strict';

const crypto = require('crypto');
const path = require('path');
const { loadJson, saveJsonAtomic } = require('./json-store');

const ORDER_STATUSES = ['Inquiry', 'Quoted', 'DepositPaid', 'Shipped', 'Settled', 'Cancelled'];
const DEFAULT_DEPOSIT_RATIO = 0.3;

function createOrderStore(dataDir) {
  const ordersFile = path.join(dataDir, 'buyer-orders.json');

  function loadOrders() {
    const data = loadJson(ordersFile, []);
    return Array.isArray(data) ? data : [];
  }

  function saveOrders(orders) {
    saveJsonAtomic(ordersFile, orders);
  }

  function id(prefix = 'ord') {
    return `AP-${prefix.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  function publicOrder(order) {
    if (!order) return null;
    return {
      id: order.id,
      buyerId: order.buyerId,
      stockId: order.stockId,
      slug: order.slug || '',
      title: order.title || '',
      exwUsd: order.exwUsd,
      depositRatio: order.depositRatio,
      depositUsd: order.depositUsd,
      currency: order.currency || 'USD',
      status: order.status,
      stripeSessionId: order.stripeSessionId || '',
      stripePaymentIntentId: order.stripePaymentIntentId || '',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      quotedAt: order.quotedAt || null,
      depositPaidAt: order.depositPaidAt || null,
      termsAcceptedAt: order.termsAcceptedAt || null,
    };
  }

  function listForBuyer(buyerId) {
    return loadOrders()
      .filter((o) => o.buyerId === buyerId)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .map(publicOrder);
  }

  function listAll() {
    return loadOrders()
      .slice()
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .map(publicOrder);
  }

  function getById(orderId) {
    return loadOrders().find((o) => o.id === orderId) || null;
  }

  function createOrder(input) {
    const exwUsd = Number(input.exwUsd);
    if (!Number.isFinite(exwUsd) || exwUsd <= 0) throw new Error('exwUsd required');
    const stockId = String(input.stockId || '').trim();
    if (!stockId) throw new Error('stockId required');
    const buyerId = String(input.buyerId || '').trim();
    if (!buyerId) throw new Error('buyerId required');

    const ratio = Number.isFinite(Number(input.depositRatio))
      ? Number(input.depositRatio)
      : DEFAULT_DEPOSIT_RATIO;
    if (ratio <= 0 || ratio > 1) throw new Error('depositRatio must be between 0 and 1');

    const depositUsd = Number.isFinite(Number(input.depositUsd))
      ? Number(Number(input.depositUsd).toFixed(2))
      : Number((exwUsd * ratio).toFixed(2));

    const now = new Date().toISOString();
    const status = ORDER_STATUSES.includes(input.status) ? input.status : 'Quoted';
    const order = {
      id: input.id || id('ORD'),
      buyerId,
      stockId,
      slug: String(input.slug || '').trim(),
      title: String(input.title || stockId).trim(),
      exwUsd: Number(exwUsd.toFixed(2)),
      depositRatio: ratio,
      depositUsd,
      currency: 'USD',
      status,
      leadId: input.leadId || '',
      createdAt: now,
      updatedAt: now,
      quotedAt: status === 'Quoted' || status === 'DepositPaid' ? now : null,
      depositPaidAt: null,
      termsAcceptedAt: null,
      stripeSessionId: '',
      stripePaymentIntentId: '',
      notes: String(input.notes || '').trim(),
    };

    const orders = loadOrders();
    orders.unshift(order);
    saveOrders(orders);
    return publicOrder(order);
  }

  function updateOrder(orderId, patch) {
    const orders = loadOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index < 0) throw new Error('Order not found');
    const was = orders[index];
    const next = { ...was, ...patch, id: was.id, updatedAt: new Date().toISOString() };
    if (patch.status && !ORDER_STATUSES.includes(patch.status)) {
      throw new Error(`Invalid status: ${patch.status}`);
    }
    orders[index] = next;
    saveOrders(orders);
    return publicOrder(next);
  }

  function markDepositPaid(orderId, { stripeSessionId, stripePaymentIntentId } = {}) {
    return updateOrder(orderId, {
      status: 'DepositPaid',
      depositPaidAt: new Date().toISOString(),
      stripeSessionId: stripeSessionId || '',
      stripePaymentIntentId: stripePaymentIntentId || '',
    });
  }

  return {
    ORDER_STATUSES,
    DEFAULT_DEPOSIT_RATIO,
    loadOrders,
    listForBuyer,
    listAll,
    getById,
    createOrder,
    updateOrder,
    markDepositPaid,
    publicOrder,
  };
}

module.exports = {
  createOrderStore,
  ORDER_STATUSES,
  DEFAULT_DEPOSIT_RATIO,
};
