'use strict';

const crypto = require('crypto');

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
  isAuthorizedSupplierRequest,
  assertSubmissionMediaUrls,
};
