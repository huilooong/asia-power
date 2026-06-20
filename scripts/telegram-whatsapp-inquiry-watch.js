#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { bootstrapEnv, requireServerLib, ROOT } = require('./telegram-common');

bootstrapEnv();
const { notifyWhatsAppInquiry } = requireServerLib('half-cut-notifications');
const { isEnabled } = requireServerLib('telegram-notify');

const LEAD_LOG = process.env.ASIA_RULE_LEADS || '/root/.openclaw/workspaces/asia-support/rule-leads.ndjson';
const STATE_FILE = path.join(ROOT, 'data/telegram-whatsapp-state.json');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { offset: 0 };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { offset: 0 };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  if (!isEnabled()) {
    console.error('Telegram not configured');
    process.exit(1);
  }
  if (!fs.existsSync(LEAD_LOG)) {
    console.log('No WhatsApp lead log yet:', LEAD_LOG);
    return;
  }

  const state = loadState();
  const raw = fs.readFileSync(LEAD_LOG, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const fresh = lines.slice(state.offset || 0);
  let sent = 0;

  for (const line of fresh) {
    try {
      const row = JSON.parse(line);
      notifyWhatsAppInquiry(row);
      sent += 1;
    } catch {
      // skip malformed lines
    }
  }

  saveState({ offset: lines.length, updatedAt: new Date().toISOString() });
  console.log(`WhatsApp inquiry watch complete. Notified ${sent} new lead(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
