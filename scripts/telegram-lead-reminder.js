#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { bootstrapEnv, requireServerLib, ROOT } = require('./telegram-common');

bootstrapEnv();
const { createContactLeadStore } = requireServerLib('contact-leads');
const { notifyLeadReminder } = requireServerLib('half-cut-notifications');
const { isEnabled } = requireServerLib('telegram-notify');

const LEADS_FILE = path.join(ROOT, 'data', 'contact-leads.json');
const STATE_FILE = path.join(ROOT, 'data', 'telegram-lead-reminder-state.json');
const store = createContactLeadStore(LEADS_FILE);

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { lastRunAt: null };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastRunAt: null };
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

  const due = store.dueReminders();
  let sent = 0;

  for (const lead of due) {
    notifyLeadReminder(lead);
    store.updateLead(lead.id, { reminderSentAt: new Date().toISOString() });
    sent += 1;
  }

  saveState({ lastRunAt: new Date().toISOString(), reminded: sent });
  console.log(`Lead reminder complete. Notified ${sent} lead(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
