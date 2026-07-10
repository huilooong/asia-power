'use strict';

/**
 * Normalize phone numbers for supplier/buyer identity matching.
 * Keeps digits only; strips leading 00; optional default country code for CN mobiles.
 */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(phone, countryCode = '') {
  let digits = digitsOnly(phone);
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);

  const cc = digitsOnly(countryCode);
  if (cc && !digits.startsWith(cc)) {
    // CN local 11-digit mobile without country code
    if (cc === '86' && /^1\d{10}$/.test(digits)) {
      digits = `86${digits}`;
    } else if (!digits.startsWith(cc) && digits.length <= 11) {
      digits = `${cc}${digits}`;
    }
  }

  // Bare CN mobile
  if (/^1\d{10}$/.test(digits)) digits = `86${digits}`;

  return digits;
}

function phonesMatch(a, b, countryCodeA = '', countryCodeB = '') {
  const left = normalizePhone(a, countryCodeA);
  const right = normalizePhone(b, countryCodeB);
  if (!left || !right) return false;
  if (left === right) return true;
  // Compare last 11 digits for CN numbers stored inconsistently
  const tail = (v) => (v.length > 11 ? v.slice(-11) : v);
  return tail(left) === tail(right);
}

function displayPhone(normalized, countryCode = '') {
  const digits = normalizePhone(normalized, countryCode);
  if (!digits) return '';
  if (digits.startsWith('86') && digits.length === 13) {
    return `+86 ${digits.slice(2)}`;
  }
  return `+${digits}`;
}

module.exports = {
  digitsOnly,
  normalizePhone,
  phonesMatch,
  displayPhone,
};
