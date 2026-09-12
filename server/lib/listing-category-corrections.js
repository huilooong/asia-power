/**
 * CEO-confirmed + scan-found category corrections.
 * Dual-use OEMs (JAC / Volvo) cannot be wholesale passenger or truck.
 */
'use strict';

const STOCK_OVERRIDES = {
  // 2018 JAC S3 — standalone engine photos, $300. Not a truck cab / front clip.
  HC250613: {
    vehicleCategory: 'passenger',
    vehicleCondition: 'Engine Assembly',
    passengerPartType: 'engine',
    truckPartType: '',
    includedParts: ['Engine assembly'],
    shortDescription: '2018 JAC S3 HFC4GB2.3E engine assembly — supplier-verified listing via AsiaPower.',
  },
  // 2017 Volvo XC60 — half-cut parts list, $3900. Not a truck cab.
  HC250581: {
    vehicleCategory: 'passenger',
    vehicleCondition: 'Half Cut',
    passengerPartType: '',
    truckPartType: '',
    shortDescription: '2017 Volvo XC60 B4204T11 half-cut — supplier-verified listing via AsiaPower.',
  },
};

function stockIdOf(record) {
  return String(record?.stockId || record?.approvedStockId || '').trim().toUpperCase();
}

function isJacPassengerModel(brand, model, title) {
  if (!/jac|江淮/i.test(String(brand || ''))) return false;
  return /\b(s2|s3|s4|s5|s7|refine|瑞风|heyue|和悦|sehol|sihao|思皓)\b/i.test(`${model || ''} ${title || ''}`);
}

function isVolvoPassengerModel(brand, model, title) {
  if (!/volvo|沃尔沃/i.test(String(brand || ''))) return false;
  return /\b(xc[0-9]{2}|s[468]0|v[467]0|c[37]0)\b/i.test(`${model || ''} ${title || ''}`);
}

function isHyundaiCommercialTruck(brand, model, title, engineCode) {
  const brandText = String(brand || '');
  const blob = `${brandText} ${model || ''} ${title || ''} ${engineCode || ''}`;
  if (/hyundai\s*trucks/i.test(brandText) || /hyundai\s*trucks/i.test(blob)) return true;
  if (/hyundai/i.test(brandText) && (/\b(xcient|mighty|p440|trago)\b/i.test(blob) || /d6cf/i.test(blob))) {
    return true;
  }
  return false;
}

function isChanganCommercialTruck(brand, model, title) {
  const blob = `${brand || ''} ${model || ''} ${title || ''}`;
  return /kuayue|跨越|xinbao|新豹|神骐/i.test(blob);
}

function applyListingCategoryCorrection(record) {
  if (!record || typeof record !== 'object') return record;
  const override = STOCK_OVERRIDES[stockIdOf(record)];
  if (!override) return record;
  return { ...record, ...override };
}

function forceHyundaiCommercialTruckMeta(record) {
  if (!record || !isHyundaiCommercialTruck(record.brand, record.model, record.title, record.engineCode)) return null;
  if (String(record.vehicleCategory || '').trim() === 'truck') return null;
  const condition = String(record.vehicleCondition || '').trim();
  const title = String(record.title || '');
  const running = condition === 'Running Vehicle'
    || record.isExportUsedCar === true
    || /export used car/i.test(title);
  return {
    vehicleCategory: 'truck',
    truckPartType: running ? 'vehicle' : 'cab',
    passengerPartType: '',
    vehicleCondition: running ? 'Running Vehicle' : 'Driver Cab',
  };
}

module.exports = {
  STOCK_OVERRIDES,
  stockIdOf,
  isJacPassengerModel,
  isVolvoPassengerModel,
  isHyundaiCommercialTruck,
  isChanganCommercialTruck,
  applyListingCategoryCorrection,
  forceHyundaiCommercialTruckMeta,
};
