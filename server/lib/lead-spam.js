'use strict';

function isHoneypotTriggered(body) {
  return Boolean(String(body.company_website || body.website || '').trim());
}

function isGibberishBlob(text) {
  const value = String(text || '').trim();
  if (value.length < 12) return false;
  if (/\s/.test(value)) return false;
  if (!/^[A-Za-z0-9]+$/.test(value)) return false;
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value)) return false;

  const vowels = (value.match(/[aeiouAEIOU]/g) || []).length;
  if (vowels / value.length < 0.2) return true;
  if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(value)) return true;
  return false;
}

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'example',
  'test.com',
  'test.test',
  'localhost',
  'invalid',
]);

function isPlaceholderOrTestEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value.includes('@')) return false;

  const [, domain] = value.split('@');
  if (!domain) return false;

  if (PLACEHOLDER_EMAIL_DOMAINS.has(domain)) return true;
  if (domain.endsWith('.example') || domain.endsWith('.test') || domain.endsWith('.invalid')) return true;
  return false;
}

function isSuspiciousEmail(email) {
  if (isPlaceholderOrTestEmail(email)) return true;

  const value = String(email || '').trim().toLowerCase();
  if (!value.includes('@')) return false;

  const [local, domain] = value.split('@');
  if (!local || !domain) return false;

  if (domain.includes('gmail.')) {
    const dots = (local.match(/\./g) || []).length;
    if (dots >= 3) return true;
    if (isGibberishBlob(local.replace(/\./g, ''))) return true;
  }

  if (isGibberishBlob(local.replace(/[._+-]/g, ''))) return true;
  return false;
}

function gibberishFieldCount(body) {
  const fields = [
    body.name,
    body.company,
    body.vehicle_details || body.vehicleDetails,
    body.message,
  ];
  return fields
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter(isGibberishBlob)
    .length;
}

function contactSpamReason(body) {
  if (isHoneypotTriggered(body)) {
    return 'Submission blocked. Please clear hidden autofill fields and try again, or contact us on WhatsApp.';
  }
  if (body.email && isPlaceholderOrTestEmail(body.email)) {
    return 'Please use a real email address you can receive mail at.';
  }
  if (body.email && isSuspiciousEmail(body.email)) {
    return 'Please check your email address and try again.';
  }

  const gibberishCount = gibberishFieldCount(body);
  if (gibberishCount >= 2) {
    return 'Please enter readable enquiry details and try again.';
  }

  const name = String(body.name || '').trim();
  const vehicle = String(body.vehicle_details || body.vehicleDetails || '').trim();
  if (isGibberishBlob(name) && isGibberishBlob(vehicle)) {
    return 'Please enter readable name and vehicle details.';
  }

  return '';
}

function halfCutSpamReason(body) {
  if (isHoneypotTriggered(body)) {
    return 'Submission blocked. Please try again or use the contact form.';
  }
  if (body.email && isPlaceholderOrTestEmail(body.email)) {
    return 'Please use a real email address you can receive mail at.';
  }
  return '';
}

function productSpamReason(body) {
  return halfCutSpamReason(body);
}

function isContactSpam(body) {
  return Boolean(contactSpamReason(body));
}

function isHalfCutSpam(body) {
  return Boolean(halfCutSpamReason(body));
}

function isProductSpam(body) {
  return Boolean(productSpamReason(body));
}

function isLeadSpam(body) {
  return isContactSpam(body);
}

module.exports = {
  isContactSpam,
  isHalfCutSpam,
  isLeadSpam,
  contactSpamReason,
  halfCutSpamReason,
  productSpamReason,
  isProductSpam,
  isGibberishBlob,
  isSuspiciousEmail,
  isPlaceholderOrTestEmail,
  isHoneypotTriggered,
};
