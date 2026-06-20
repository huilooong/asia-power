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

function isSuspiciousEmail(email) {
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

function isContactSpam(body) {
  if (isHoneypotTriggered(body)) return true;
  if (body.email && isSuspiciousEmail(body.email)) return true;

  const gibberishCount = gibberishFieldCount(body);
  if (gibberishCount >= 2) return true;

  const name = String(body.name || '').trim();
  const vehicle = String(body.vehicle_details || body.vehicleDetails || '').trim();
  if (isGibberishBlob(name) && isGibberishBlob(vehicle)) return true;

  return false;
}

module.exports = {
  isContactSpam,
  isGibberishBlob,
  isSuspiciousEmail,
  isHoneypotTriggered,
};
