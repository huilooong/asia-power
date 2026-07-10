'use strict';

const crypto = require('crypto');
const { clientIp } = require('./rate-limit');

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.SUPPLIER_GATE === '1';
}

function supplierUploadKey() {
  return process.env.SUPPLIER_UPLOAD_KEY || '';
}

function hasValidSupplierKey(req) {
  const expected = supplierUploadKey();
  if (!expected) return false;
  const header = String(req.headers['x-supplier-key'] || '');
  if (!header || header.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

function trustedSupplierUploadIps() {
  const raw = process.env.TRUSTED_SUPPLIER_UPLOAD_IPS || '';
  return new Set(
    raw.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean),
  );
}

function isTrustedSupplierUploadIp(req) {
  const allowed = trustedSupplierUploadIps();
  if (!allowed.size) return false;
  return allowed.has(clientIp(req));
}

/** CEO / 汽修宝批量工作站：有效 key + IP 在白名单内，才跳过 upload 限流。 */
function isTrustedBatchUploader(req) {
  return hasValidSupplierKey(req) && isTrustedSupplierUploadIp(req);
}

function isAuthorizedSupplierRequest(req, allowUpload) {
  if (typeof allowUpload === 'function' && allowUpload(req)) return true;
  if (!isProduction()) return true;
  if (!supplierUploadKey()) return false;
  return hasValidSupplierKey(req);
}

const PENDING_URL_RE = /^\/uploads\/pending\/(photos|videos)\/[a-zA-Z0-9._-]+(\?access=[a-f0-9]+&exp=\d+)?$/;
const PUBLIC_URL_RE = /^\/uploads\/(photos|videos)\/[a-zA-Z0-9._-]+$/;

function assertSubmissionMediaUrls(submission) {
  const urls = [];
  for (const photo of submission.photos || []) {
    const url = typeof photo === 'string' ? photo : photo?.url;
    if (url) urls.push(url);
  }
  const videoUrl = submission.video?.url || submission.videoUrl;
  if (videoUrl) urls.push(videoUrl);
  for (const url of urls) {
    const pathOnly = String(url).split('?')[0];
    const full = String(url);
    const ok = PENDING_URL_RE.test(full) || PUBLIC_URL_RE.test(pathOnly);
    if (!ok) {
      throw new Error('Media must be uploaded via the AsiaPower upload API');
    }
  }
}

module.exports = {
  isProduction,
  supplierUploadKey,
  hasValidSupplierKey,
  isTrustedSupplierUploadIp,
  isTrustedBatchUploader,
  isAuthorizedSupplierRequest,
  assertSubmissionMediaUrls,
};
