#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { bootstrapEnv, requireServerLib, ROOT } = require('./telegram-common');

bootstrapEnv();
const { notify, isEnabled } = requireServerLib('telegram-notify');

const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(ROOT, 'backups/scheduled');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const TZ = process.env.TZ || 'Africa/Accra';

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isFile()) count += 1;
  }
  return count;
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

  const today = dayKey();
  const submissions = loadJson(path.join(DATA_DIR, 'half-cut-submissions.json'), []);
  const approved = loadJson(path.join(DATA_DIR, 'half-cut-approved.json'), []);
  const pending = submissions.filter((s) => s.reviewStatus === 'pending');
  const approvedToday = submissions.filter((s) => s.reviewStatus === 'approved' && s.reviewedAt && dayKey(new Date(s.reviewedAt)) === today);
  const rejectedToday = submissions.filter((s) => s.reviewStatus === 'rejected' && s.reviewedAt && dayKey(new Date(s.reviewedAt)) === today);
  const newToday = submissions.filter((s) => s.createdAt && dayKey(new Date(s.createdAt)) === today);
  const backup = latestBackup();
  const photoCount = countFiles(path.join(UPLOADS_DIR, 'photos'));
  const videoCount = countFiles(path.join(UPLOADS_DIR, 'videos'));

  const lines = [
    `📊 Asia-Power daily report (${today}, ${TZ})`,
    `New submissions today: ${newToday.length}`,
    `Approved today: ${approvedToday.length}`,
    `Rejected today: ${rejectedToday.length}`,
    `Pending now: ${pending.length}`,
    `Published inventory: ${approved.length}`,
    `Uploads: ${photoCount} photos, ${videoCount} videos`,
    `Latest backup: ${backup ? backup.name : 'none found'}`,
  ];

  try {
    const { createSiteAnalytics } = requireServerLib('site-analytics');
    const analytics = createSiteAnalytics(DATA_DIR, { timeZone: TZ });
    lines.push('', analytics.buildDailyReportText(today));
  } catch (err) {
    lines.push('', `🌐 Website traffic: unavailable (${err.message})`);
  }

  if (newToday.length) {
    lines.push('');
    lines.push('Today\'s submissions:');
    for (const sub of newToday.slice(-10)) {
      lines.push(`- ${sub.submissionId}: ${sub.brand || '—'} ${sub.model || ''}`.trim());
    }
  }

  await notify(lines.join('\n'));
  console.log(`Daily report sent for ${today}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
