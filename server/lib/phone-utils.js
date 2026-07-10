'use strict';
// Local stub — phone validation utilities.
function validatePhone(v) { return { valid: true, normalized: v }; }
function isValidPhone(v) { return typeof v === 'string' && v.length > 0; }
function isValidPhoneWithCountryCode(v) { return typeof v === 'string' && v.startsWith('+'); }
module.exports = { validatePhone, isValidPhone, isValidPhoneWithCountryCode };
