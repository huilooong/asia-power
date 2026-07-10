'use strict';

function normCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function normModel(value) {
  return String(value || '').trim().toLowerCase();
}

function isGenericGearboxCode(code) {
  const c = normCode(code);
  if (!c) return true;
  if (c.length <= 4 && /^(AT|MT|AMT|CVT|DCT|\d{1,2}AT|\d{1,2}MT|\d{1,2}DCT)$/.test(c)) return true;
  return false;
}

function gearboxTypeSuffix(code, drivetrain) {
  const c = String(code || '').trim().toUpperCase();
  if (/CVT/.test(c)) return 'CVT';
  if (/DCT/.test(c)) return 'DCT';
  if (/MT|\dMT|^M$|MANUAL/.test(c)) return 'MT';
  if (String(drivetrain || '').toUpperCase().includes('4')) return '4WD AT';
  if (/AT|AUTO|\dAT/.test(c)) return 'AT';
  return c || 'AT';
}

/** Factory code first; year + model + type only when code is generic or missing. */
function formatGearboxLabel(entry) {
  const code = String(entry?.code || '').trim();
  if (!isGenericGearboxCode(code)) return code;
  const year = entry?.year ? `${entry.year} ` : '';
  const model = String(entry?.model || '').trim();
  const type = gearboxTypeSuffix(code, entry?.drivetrain);
  return `${year}${model} ${type} Transmission`.trim();
}

function chassisEntryKey(entry) {
  return `${normModel(entry?.model)}:${entry?.year || ''}`;
}

function formatChassisLabel(entry) {
  const year = entry?.year ? `${entry.year} ` : '';
  const model = String(entry?.model || '').trim();
  return `${year}${model} Full Chassis Set`.trim();
}

function resolveGearboxCode(item) {
  const code = String(item?.transmissionCode || '').trim();
  if (code.length >= 2) return code;
  const drive = String(item?.drivetrain || '').toUpperCase();
  if (drive.includes('4')) return '4AT';
  return 'AT';
}

module.exports = {
  normCode,
  normModel,
  isGenericGearboxCode,
  gearboxTypeSuffix,
  formatGearboxLabel,
  chassisEntryKey,
  formatChassisLabel,
  resolveGearboxCode,
};
