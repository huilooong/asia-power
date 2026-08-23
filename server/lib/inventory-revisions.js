'use strict';

const crypto = require('crypto');

const IMMEDIATE_FIELDS = new Set(['priceUsd', 'inventoryStatus', 'status', 'listingVisibility']);
const REVIEW_FIELDS = new Set([
  'vin',
  'brand',
  'model',
  'year',
  'engineCode',
  'transmissionCode',
  'drivetrain',
  'mileage',
  'shortDescription',
  'notes',
  'origin',
  'originCountry',
  'vehicleCondition',
  'photos',
  'video',
  'videoUrl',
]);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function comparable(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function selectFields(raw, allowed) {
  const selected = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (!allowed.has(key) || value === undefined) continue;
    selected[key] = clone(value);
  }
  return selected;
}

function diffFields(base, proposed, fields = REVIEW_FIELDS) {
  const changes = [];
  for (const field of fields) {
    if (comparable(base?.[field]) === comparable(proposed?.[field])) continue;
    changes.push({ field, before: clone(base?.[field]), after: clone(proposed?.[field]) });
  }
  return changes;
}

function revisionId(stockId) {
  const stock = String(stockId || 'ITEM').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
  return `REV-${stock}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function buildRevision({ base, proposedEdits, actor, action = 'submit-review', previousRevision = null }) {
  const proposed = { ...clone(base), ...selectFields(proposedEdits, REVIEW_FIELDS) };
  const changes = diffFields(base, proposed);
  if (!changes.length) return null;
  const now = new Date().toISOString();
  const stockId = base.stockId || base.approvedStockId;
  return {
    ...proposed,
    submissionId: revisionId(stockId),
    submissionKind: 'inventory-revision',
    revisionOfStockId: stockId,
    approvedStockId: stockId,
    approvedSlug: base.slug || base.approvedSlug || '',
    baseUpdatedAt: base.updatedAt || base.approvedAt || null,
    revisionChanges: changes,
    previousRevisionId: previousRevision?.submissionId || '',
    reviewStatus: action === 'save-draft' ? 'draft' : 'pending',
    rejectReason: '',
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
    supplierId: actor?.id || base.supplierId || '',
    supplierName: actor?.supplierName || base.supplierName || '',
    supplierPhone: actor?.phone || base.supplierPhone || '',
    supplierPhoneNormalized: actor?.phoneNormalized || base.supplierPhoneNormalized || '',
    updatedBySupplierId: actor?.id || '',
  };
}

function latestForStock(submissions, stockId) {
  const target = String(stockId || '').toUpperCase();
  return (submissions || [])
    .filter((item) => item?.submissionKind === 'inventory-revision'
      && String(item.revisionOfStockId || item.approvedStockId || '').toUpperCase() === target)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] || null;
}

function publicRevisionSummary(revision) {
  if (!revision) return null;
  return {
    submissionId: revision.submissionId,
    revisionOfStockId: revision.revisionOfStockId,
    reviewStatus: revision.reviewStatus,
    rejectReason: revision.rejectReason || '',
    revisionChanges: Array.isArray(revision.revisionChanges)
      ? revision.revisionChanges.map((change) => ({ field: change.field }))
      : [],
    createdAt: revision.createdAt || null,
    updatedAt: revision.updatedAt || null,
    reviewedAt: revision.reviewedAt || null,
  };
}

module.exports = {
  IMMEDIATE_FIELDS,
  REVIEW_FIELDS,
  selectFields,
  diffFields,
  buildRevision,
  latestForStock,
  publicRevisionSummary,
};
