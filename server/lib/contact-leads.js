'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_LEADS = 5000;
const REMINDER_AFTER_MS = 2 * 60 * 60 * 1000;

function trim(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function baseLead(body, meta = {}) {
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
    message: trim(body.message, 2000),
    stockId: trim(body.stockId || body.stock_id, 40),
    slug: trim(body.slug, 180),
    brand: trim(body.brand, 80),
    model: trim(body.model, 120),
    engineCode: trim(body.engineCode || body.engine_code, 40),
    transmissionCode: trim(body.transmissionCode || body.transmission_code, 40),
    listingStatus: trim(body.listingStatus || body.listing_status || body.status, 40),
    replyChannel: body.prefer_email_reply || body.preferEmailReply ? 'email' : 'whatsapp',
    page: trim(body.page || meta.page, 240),
    whatsappStatus: 'pending_send',
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
  return baseLead({ ...body, source: 'contact-form', intent: 'quote' }, meta);
}

function buildHalfCutLead(body, meta = {}) {
  return baseLead({ ...body, source: 'half-cut', intent: body.intent || 'price' }, meta);
}

function validateContactLead(lead) {
  const errors = [];
  if (!lead.name) errors.push('name is required');
  if (!lead.phone) errors.push('phone is required');
  if (!lead.country) errors.push('country is required');
  if (!lead.enquiryType) errors.push('enquiry_type is required');
  if (!lead.vehicleDetails) errors.push('vehicle_details is required');
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    errors.push('invalid email');
  }
  if (lead.replyChannel === 'email' && !lead.email) {
    errors.push('email is required when preferring email reply');
  }
  return errors;
}

function validateHalfCutLead(lead) {
  const errors = [];
  if (!lead.slug) errors.push('slug is required');
  if (!lead.stockId) errors.push('stockId is required');
  if (!lead.intent) errors.push('intent is required');
  return errors;
}

function createContactLeadStore(leadsFile) {
  function load() {
    if (!fs.existsSync(leadsFile)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save(leads) {
    fs.mkdirSync(path.dirname(leadsFile), { recursive: true });
    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
  }

  function appendLead(body, meta = {}, builder = buildContactLead, validator = validateContactLead) {
    const lead = builder(body, meta);
    const errors = validator(lead);
    if (errors.length) {
      const err = new Error(errors.join('; '));
      err.statusCode = 400;
      throw err;
    }
    const leads = load();
    leads.unshift(lead);
    if (leads.length > MAX_LEADS) leads.length = MAX_LEADS;
    save(leads);
    return lead;
  }

  function appendContactLead(body, meta = {}) {
    return appendLead(body, meta, buildContactLead, validateContactLead);
  }

  function appendHalfCutLead(body, meta = {}) {
    return appendLead(body, meta, buildHalfCutLead, validateHalfCutLead);
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
    if (patch.whatsappStatus === 'pending_send' || patch.whatsappStatus === 'sent' || patch.whatsappStatus === 'unknown') {
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
      const created = Date.parse(lead.createdAt || '');
      if (!Number.isFinite(created)) return false;
      return now - created >= afterMs;
    });
  }

  return {
    appendLead,
    appendContactLead,
    appendHalfCutLead,
    updateLead,
    deleteLead,
    listLeads,
    dueReminders,
    load,
  };
}

module.exports = {
  buildContactLead,
  buildHalfCutLead,
  validateContactLead,
  validateHalfCutLead,
  createContactLeadStore,
  REMINDER_AFTER_MS,
};
