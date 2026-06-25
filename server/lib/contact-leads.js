'use strict';

const path = require('path');
const crypto = require('crypto');
const { validatePhone, isValidPhone, isValidPhoneWithCountryCode } = require('./phone-utils');
const { isPlaceholderOrTestEmail } = require('./lead-spam');
const { loadJson, saveJsonAtomic } = require('./json-store');
const { createDataIntakeLog } = require('./data-intake-log');

const MAX_LEADS = 5000;
const REMINDER_AFTER_MS = 2 * 60 * 60 * 1000;

function trim(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function isValidEmail(email) {
  const value = String(email || '').trim();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phoneReachable(phone, country) {
  const value = String(phone || '').trim();
  if (!value) return false;
  return validatePhone(value, country).ok;
}

function resolveReplyChannel(body) {
  if (body.prefer_email_reply || body.preferEmailReply) return 'email';
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const country = String(body.country || '').trim();
  const phoneOk = phoneReachable(phone, country);
  const emailOk = isValidEmail(email);
  if (emailOk && !phoneOk) return 'email';
  if (phoneOk) return 'whatsapp';
  if (emailOk) return 'email';
  return 'whatsapp';
}

function reachableContactErrors(lead) {
  const phone = String(lead.phone || '').trim();
  const email = String(lead.email || '').trim();
  const country = String(lead.country || '').trim();
  const errors = [];

  const phoneCheck = phone ? validatePhone(phone, country) : null;
  const phoneOk = phoneCheck?.ok === true;
  const emailOk = email ? isValidEmail(email) : false;

  if (phoneOk || emailOk) return errors;

  if (!phone && !email) {
    errors.push('phone or email is required');
    return errors;
  }
  if (phone && phoneCheck && !phoneCheck.ok) errors.push(phoneCheck.error || 'invalid phone');
  if (email && !emailOk) errors.push('invalid email');
  if (email && emailOk && isPlaceholderOrTestEmail(email)) errors.push('invalid email');
  if (!errors.length) errors.push('phone or email is required');
  return errors;
}

function hasReachableContact(lead) {
  const phone = String(lead.phone || '').trim();
  const email = String(lead.email || '').trim();
  const country = String(lead.country || '').trim();
  if (phoneReachable(phone, country)) return true;
  return isValidEmail(email);
}

function baseLead(body, meta = {}) {
  const replyChannel = resolveReplyChannel(body);
  return {
    id: meta.id || `lead-${crypto.randomBytes(6).toString('hex')}`,
    createdAt: meta.createdAt || new Date().toISOString(),
    source: trim(body.source || meta.source || 'contact-form', 40),
    intent: trim(body.intent || meta.intent || 'quote', 40),
    name: trim(body.name, 120),
    company: trim(body.company, 120),
    email: trim(body.email, 160),
    phone: trim(body.phone, 40),
    country: trim(body.country, 80),
    enquiryType: trim(body.enquiry_type || body.enquiryType, 80),
    vehicleDetails: trim(body.vehicle_details || body.vehicleDetails, 2000),
    message: trim(body.message, 4000),
    stockId: trim(body.stockId || body.stock_id, 40),
    slug: trim(body.slug, 180),
    brand: trim(body.brand, 80),
    model: trim(body.model, 120),
    engineCode: trim(body.engineCode || body.engine_code, 40),
    transmissionCode: trim(body.transmissionCode || body.transmission_code, 40),
    listingStatus: trim(body.listingStatus || body.listing_status || body.status, 40),
    replyChannel,
    page: trim(body.page || meta.page, 240),
    whatsappStatus: replyChannel === 'email' ? 'not_applicable' : 'pending_send',
    replyStatus: 'open',
    reminderSentAt: null,
    clientIp: meta.ip || null,
    ipCountry: trim(meta.ipCountry, 80),
    ipCity: trim(meta.ipCity, 80),
    ipRegion: trim(meta.ipRegion, 80),
    ipCountryCode: trim(meta.ipCountryCode, 8),
  };
}

function buildContactLead(body, meta = {}) {
  return baseLead({
    ...body,
    source: trim(body.source, 40) || 'contact-form',
    intent: trim(body.intent, 40) || 'quote',
    prefer_email_reply: body.prefer_email_reply ?? body.preferEmailReply ?? true,
  }, meta);
}

function buildHalfCutLead(body, meta = {}) {
  return baseLead({ ...body, source: 'half-cut', intent: body.intent || 'price' }, meta);
}

function buildGeneralWhatsappLead(body, meta = {}) {
  return baseLead({ ...body, source: 'whatsapp-intent', intent: body.intent || 'whatsapp' }, meta);
}

function validateGeneralWhatsappLead(lead) {
  const errors = [];
  if (!lead.name) errors.push('name is required');
  errors.push(...reachableContactErrors(lead));
  return errors;
}

function buildProductLead(body, meta = {}) {
  const category = trim(body.productCategory || body.category, 40);
  const product = trim(body.product || body.productCode, 120);
  const brandSlug = trim(body.brandSlug, 80);
  return baseLead({
    ...body,
    source: 'product-catalog',
    intent: body.intent || 'price',
    enquiryType: category,
    vehicleDetails: `${category}: ${product}`.trim(),
    slug: trim(body.slug || `${brandSlug}-${product}`.toLowerCase().replace(/\s+/g, '-'), 180),
    model: product,
  }, meta);
}

function validateContactLead(lead) {
  const errors = [];
  if (!lead.name) errors.push('name is required');
  if (!lead.email) errors.push('email is required');
  else if (!isValidEmail(lead.email)) errors.push('invalid email');
  else if (isPlaceholderOrTestEmail(lead.email)) errors.push('invalid email');
  const phone = String(lead.phone || '').trim();
  if (phone) {
    const phoneCheck = validatePhone(phone, lead.country);
    if (!phoneCheck.ok) errors.push(phoneCheck.error || 'invalid phone');
  }
  if (!lead.country) errors.push('country is required');
  if (!lead.enquiryType) errors.push('enquiry_type is required');
  if (!lead.vehicleDetails) errors.push('vehicle_details is required');
  return errors;
}

function validateHalfCutLead(lead) {
  const errors = [];
  if (!lead.slug) errors.push('slug is required');
  if (!lead.stockId) errors.push('stockId is required');
  if (!lead.intent) errors.push('intent is required');
  errors.push(...reachableContactErrors(lead));
  return errors;
}

const PRODUCT_CATEGORIES = new Set(['engine', 'gearbox', 'chassis']);

function validateProductLead(lead) {
  const errors = [];
  if (!PRODUCT_CATEGORIES.has(lead.enquiryType)) errors.push('product category is required');
  if (!lead.model) errors.push('product is required');
  if (!lead.brand) errors.push('brand is required');
  if (!lead.intent) errors.push('intent is required');
  errors.push(...reachableContactErrors(lead));
  return errors;
}

function createContactLeadStore(leadsFile) {
  const intakeLog = createDataIntakeLog(path.dirname(leadsFile));

  function load() {
    try {
      const data = loadJson(leadsFile, [], { createIfMissing: true });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[contact-leads] load failed:', err.message);
      return [];
    }
  }

  function save(leads) {
    saveJsonAtomic(leadsFile, leads);
  }

  function archiveOverflow(leads) {
    if (leads.length <= MAX_LEADS) return leads;
    const overflow = leads.slice(MAX_LEADS);
    for (const lead of overflow) {
      try {
        intakeLog.append('lead-archived', lead);
      } catch (err) {
        console.error('[contact-leads] archive intake failed:', err.message);
      }
    }
    return leads.slice(0, MAX_LEADS);
  }

  function appendLead(body, meta = {}, builder = buildContactLead, validator = validateContactLead) {
    const lead = builder(body, meta);
    const errors = validator(lead);
    if (errors.length) {
      const err = new Error(errors.join('; '));
      err.statusCode = 400;
      throw err;
    }
    try {
      intakeLog.append('user-lead', lead);
    } catch (err) {
      console.error('[contact-leads] intake log failed:', err.message);
      const logErr = new Error('Lead storage temporarily unavailable — please try again or contact us on WhatsApp.');
      logErr.statusCode = 503;
      throw logErr;
    }
    const leads = load();
    leads.unshift(lead);
    save(archiveOverflow(leads));
    return lead;
  }

  function appendContactLead(body, meta = {}) {
    return appendLead(body, meta, buildContactLead, validateContactLead);
  }

  function appendHalfCutLead(body, meta = {}) {
    return appendLead(body, meta, buildHalfCutLead, validateHalfCutLead);
  }

  function appendProductLead(body, meta = {}) {
    return appendLead(body, meta, buildProductLead, validateProductLead);
  }

  function appendGeneralWhatsappLead(body, meta = {}) {
    return appendLead(body, meta, buildGeneralWhatsappLead, validateGeneralWhatsappLead);
  }

  function updateLead(id, patch = {}) {
    const leads = load();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index < 0) {
      const err = new Error('lead not found');
      err.statusCode = 404;
      throw err;
    }
    const current = leads[index];
    const next = { ...current };
    if (patch.replyStatus === 'replied' || patch.replyStatus === 'open') {
      next.replyStatus = patch.replyStatus;
    }
    if (patch.whatsappStatus === 'pending_send' || patch.whatsappStatus === 'sent' || patch.whatsappStatus === 'unknown' || patch.whatsappStatus === 'not_applicable') {
      next.whatsappStatus = patch.whatsappStatus;
    }
    if (patch.reminderSentAt) next.reminderSentAt = patch.reminderSentAt;
    next.updatedAt = new Date().toISOString();
    leads[index] = next;
    save(leads);
    return next;
  }

  function deleteLead(id) {
    const leads = load();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index < 0) {
      const err = new Error('lead not found');
      err.statusCode = 404;
      throw err;
    }
    const [removed] = leads.splice(index, 1);
    save(leads);
    return removed;
  }

  function listLeads() {
    return load();
  }

  function dueReminders(now = Date.now(), afterMs = REMINDER_AFTER_MS) {
    return load().filter((lead) => {
      if (lead.replyStatus === 'replied') return false;
      if (lead.reminderSentAt) return false;
      if (!lead.phone && !lead.email) return false;
      if (!hasReachableContact(lead)) return false;
      const created = Date.parse(lead.createdAt || '');
      if (!Number.isFinite(created)) return false;
      return now - created >= afterMs;
    });
  }

  return {
    appendLead,
    appendContactLead,
    appendHalfCutLead,
    appendProductLead,
    appendGeneralWhatsappLead,
    updateLead,
    deleteLead,
    listLeads,
    dueReminders,
    load,
    intakeStats: () => intakeLog.stats(),
  };
}

module.exports = {
  buildContactLead,
  buildHalfCutLead,
  buildProductLead,
  buildGeneralWhatsappLead,
  validateContactLead,
  validateHalfCutLead,
  validateProductLead,
  validateGeneralWhatsappLead,
  createContactLeadStore,
  isValidPhone,
  isValidPhoneWithCountryCode,
  isValidEmail,
  hasReachableContact,
  REMINDER_AFTER_MS,
};
