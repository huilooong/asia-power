#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { bootstrapEnv, requireServerLib, ROOT } = require('./telegram-common');

bootstrapEnv();
const { notify, isEnabled } = requireServerLib('telegram-notify');

const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(ROOT, 'backups/scheduled');
const TZ = process.env.TZ || 'Africa/Accra';

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function localHour() {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
  }).format(new Date()));
}

function latestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('asia-power-backup-') && name.endsWith('.tar.gz'))
    .map((name) => ({
      name,
      mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] || null;
}

async function main() {
  if (!isEnabled()) {
    console.error('Telegram not configured');
    process.exit(1);
  }

  const submissions = loadJson(path.join(DATA_DIR, 'half-cut-submissions.json'), []);
  const approved = loadJson(path.join(DATA_DIR, 'half-cut-approved.json'), []);
  const leads = loadJson(path.join(DATA_DIR, 'contact-leads.json'), []);
  const pending = submissions.filter((s) => s.reviewStatus === 'pending');
  const backup = latestBackup();
  const hour = localHour();
  const backupStaleHours = backup
    ? (Date.now() - backup.mtime.getTime()) / (60 * 60 * 1000)
    : Infinity;

  const lines = [
    `⏱ Asia-Power hourly report (${TZ})`,
    `Pending half-cuts: ${pending.length}`,
    `Approved inventory: ${approved.length}`,
    `User leads (contact + half-cut): ${Array.isArray(leads) ? leads.length : 0}`,
    `Latest backup: ${backup ? `${backup.name} (${backup.mtime.toISOString()})` : 'none found'}`,
  ];

  if (backupStaleHours > 36) {
    lines.push(`⚠️ Backup stale: ${backup ? `${Math.round(backupStaleHours)}h old` : 'never run'} — check cron /var/log/asiapower-backup.log`);
  }

  try {
    const { formatMetricsSummary, collectSystemMetrics } = requireServerLib('system-metrics');
    lines.push('', '🖥 Server:', formatMetricsSummary(collectSystemMetrics()));
  } catch (err) {
    lines.push('', `🖥 Server: unavailable (${err.message})`);
  }

  if (pending.length) {
    lines.push('');
    lines.push('Pending submissions:');
    for (const sub of pending.slice(0, 5)) {
      lines.push(`- ${sub.submissionId}: ${sub.brand || '—'} ${sub.model || ''}`.trim());
    }
  }

  await notify(lines.join('\n'));
  console.log(`Hourly report sent (${hour}:00 ${TZ}).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
