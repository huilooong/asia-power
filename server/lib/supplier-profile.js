'use strict';

/**
 * Supplier profile completeness for portal registration / backfill.
 * New suppliers must register with these fields; legacy phone-only accounts must complete them.
 */

const REQUIRED_FIELDS = [
  { key: 'supplierName', label: '公司名称', aliases: ['companyName', 'company_name'] },
  { key: 'businessType', label: '业务类型', aliases: ['business_type'] },
  { key: 'contactPerson', label: '联系人', aliases: ['contact_person'] },
  { key: 'country', label: '国家/地区', aliases: ['supplierCountry'] },
  { key: 'email', label: '邮箱', aliases: [] },
  { key: 'address', label: '经营地址', aliases: ['businessAddress'] },
  { key: 'specialization', label: '主营品类', aliases: [] },
];

const OPTIONAL_FIELDS = [
  { key: 'brands', label: '经营品牌', aliases: [] },
  { key: 'monthlyCapacity', label: '月产能', aliases: ['monthly_capacity'] },
  { key: 'wechat', label: '微信', aliases: ['supplierWechat'] },
  { key: 'city', label: '城市', aliases: ['supplierCity'] },
];

const BUSINESS_TYPES = [
  'dismantling-yard',
  'auto-recycler',
  'reconditioner',
  'export-dealer',
  'other',
];

const SPECIALIZATIONS = [
  'engines',
  'gearboxes',
  'both',
  'full-vehicle',
  'half-cuts',
  'trucks',
  'other',
];

function pickField(source, field) {
  if (!source || typeof source !== 'object') return '';
  const keys = [field.key, ...(field.aliases || [])];
  for (const key of keys) {
    const value = source[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function missingProfileFields(user) {
  return REQUIRED_FIELDS
    .filter((field) => !pickField(user, field))
    .map((field) => ({ key: field.key, label: field.label }));
}

function isProfileComplete(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.profileComplete === true && missingProfileFields(user).length === 0) return true;
  return missingProfileFields(user).length === 0;
}

function publicSupplierProfile(user) {
  if (!user) return null;
  const missing = missingProfileFields(user);
  return {
    id: user.id,
    role: user.role,
    username: user.username,
    supplierName: user.supplierName || '',
    businessType: user.businessType || '',
    contactPerson: user.contactPerson || '',
    country: user.country || '',
    email: user.email || '',
    address: user.address || '',
    specialization: user.specialization || '',
    brands: user.brands || '',
    monthlyCapacity: user.monthlyCapacity || '',
    wechat: user.wechat || '',
    city: user.city || '',
    countryCode: user.countryCode || '',
    phone: user.phone || '',
    phoneNormalized: user.phoneNormalized || '',
    profileComplete: missing.length === 0,
    missingFields: missing,
    profileCompletedAt: user.profileCompletedAt || null,
  };
}

function sanitizeProfileInput(body = {}) {
  const out = {};
  for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
    const value = pickField(body, field);
    if (value) out[field.key] = value;
  }
  if (body.supplierName || body.companyName || body.company_name) {
    out.supplierName = String(body.supplierName || body.companyName || body.company_name).trim();
  }
  if (out.businessType && !BUSINESS_TYPES.includes(out.businessType)) {
    // allow free-text "other" variants but keep value
  }
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
    throw Object.assign(new Error('Valid email required'), { statusCode: 400 });
  }
  return out;
}

function assertRequiredProfile(body) {
  const profile = sanitizeProfileInput(body);
  const missing = REQUIRED_FIELDS.filter((field) => !profile[field.key]);
  if (missing.length) {
    const err = new Error(`请补全：${missing.map((f) => f.label).join('、')}`);
    err.statusCode = 400;
    err.missingFields = missing.map((f) => ({ key: f.key, label: f.label }));
    throw err;
  }
  return profile;
}

function applyProfileToUser(user, profile) {
  const next = { ...user };
  for (const [key, value] of Object.entries(profile)) {
    if (value != null && String(value).trim()) next[key] = String(value).trim();
  }
  if (profile.supplierName) next.supplierName = profile.supplierName;
  const complete = missingProfileFields(next).length === 0;
  next.profileComplete = complete;
  if (complete && !next.profileCompletedAt) {
    next.profileCompletedAt = new Date().toISOString();
  }
  next.profileUpdatedAt = new Date().toISOString();
  return next;
}

module.exports = {
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  BUSINESS_TYPES,
  SPECIALIZATIONS,
  missingProfileFields,
  isProfileComplete,
  publicSupplierProfile,
  sanitizeProfileInput,
  assertRequiredProfile,
  applyProfileToUser,
};
