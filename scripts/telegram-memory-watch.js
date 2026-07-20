#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { bootstrapEnv, requireServerLib, ROOT } = require('./telegram-common');

bootstrapEnv();
const { notify, isEnabled } = requireServerLib('telegram-notify');
const metricsLib = requireServerLib('system-metrics');

const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'memory-alert-state.json');
const COOLDOWN_MS = Number(process.env.MEMORY_ALERT_COOLDOWN_MS || 30 * 60 * 1000);

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function shouldAlert(key, state) {
  const last = Number(state[key] || 0);
  return Date.now() - last >= COOLDOWN_MS;
}

async function main() {
  if (!isEnabled()) {
    console.error('Telegram not configured');
    process.exit(1);
  }

  const metrics = metricsLib.collectSystemMetrics();
  const alerts = metricsLib.evaluateAlerts(metrics);
  const state = loadState();
  const fresh = [];

  for (const alert of alerts) {
    const key = alert.split(':')[0];
    if (!shouldAlert(key, state)) continue;
    fresh.push(alert);
    state[key] = Date.now();
  }

  if (!fresh.length) {
    console.log('Memory watch OK — no alerts.');
    console.log(metricsLib.formatMetricsSummary(metrics));
    return;
  }

  const body = [
    '🚨 Asia-Power server pressure alert',
    '',
    ...fresh,
    '',
    metricsLib.formatMetricsSummary(metrics),
    '',
    'Uploads now go direct to R2; if this persists, check non-upload traffic or restart inventory-site.',
  ].join('\n');

  await notify(body);
  saveState(state);
  console.log('Memory alert sent.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
