'use strict';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const QQ_EMAIL_RE = /\b\d{5,12}@qq\.com\b/gi;
const QQ_NUM_RE = /\b[Qq]{2}[:\s]?\d{5,12}\b/g;
const CN_MOBILE_RE = /\b(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g;
const WECHAT_RE = /(?:微信|WeChat|wechat)[：:\s]*[\w.-]{4,}/gi;
const TEL_RE = /\b(?:电话|Tel|Phone|Mobile)[：:\s]*[\d\s+-]{7,}/gi;

function redactContactInfo(text) {
  let value = String(text || '');
  if (!value) return '';

  value = value.replace(EMAIL_RE, '[contact removed]');
  value = value.replace(QQ_EMAIL_RE, '[contact removed]');
  value = value.replace(QQ_NUM_RE, '[contact removed]');
  value = value.replace(CN_MOBILE_RE, '[contact removed]');
  value = value.replace(WECHAT_RE, '[contact removed]');
  value = value.replace(TEL_RE, '[contact removed]');

  return value.replace(/\s{2,}/g, ' ').trim();
}

function containsContactInfo(text) {
  const value = String(text || '');
  if (!value) return false;
  return EMAIL_RE.test(value)
    || QQ_EMAIL_RE.test(value)
    || QQ_NUM_RE.test(value)
    || CN_MOBILE_RE.test(value)
    || WECHAT_RE.test(value)
    || TEL_RE.test(value);
}

function redactPublicStrings(fields) {
  if (!fields || typeof fields !== 'object') return fields;
  const next = { ...fields };
  for (const key of ['title', 'shortDescription', 'originalVehicleName', 'description']) {
    if (typeof next[key] === 'string') next[key] = redactContactInfo(next[key]);
  }
  if (Array.isArray(next.includedParts)) {
    next.includedParts = next.includedParts
      .map((part) => redactContactInfo(part))
      .filter(Boolean);
  }
  return next;
}

module.exports = {
  redactContactInfo,
  containsContactInfo,
  redactPublicStrings,
};
