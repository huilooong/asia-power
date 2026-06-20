/**
 * Server-side public sanitization for half-cut inventory (no VIN / supplier PII).
 */
'use strict';

function maskVin(vin) {
  const value = String(vin || '').toUpperCase();
  if (value.length !== 17) return '';
  return `${value.slice(0, 10)}${'*'.repeat(4)}${value.slice(14)}`;
}

const SUPPLIER_FIELDS = [
  'vin',
  'decodedData',
  'decodeMethod',
  'decodeConfidence',
  'submissionId',
  'supplierName',
  'supplierPhone',
  'supplierWechat',
  'supplierCity',
  'approvedAt',
  'reviewStatus',
  'rejectReason',
  'reviewedAt',
  'approvedStockId',
  'approvedSlug',
];

function toPublicItem(item) {
  if (!item || typeof item !== 'object') return null;
  const copy = { ...item };
  for (const key of SUPPLIER_FIELDS) delete copy[key];
  if (item.vin) copy.maskedVin = maskVin(item.vin);
  return copy;
}

function toPublicList(items) {
  return (items || []).map(toPublicItem).filter(Boolean);
}

function stripSubmissionForStorage(submission) {
  return submission;
}

module.exports = {
  maskVin,
  toPublicItem,
  toPublicList,
  stripSubmissionForStorage,
};
