#!/usr/bin/env node
'use strict';

const { bootstrapEnv, requireServerLib } = require('./telegram-common');

bootstrapEnv();
const { notify, isEnabled } = requireServerLib('telegram-notify');

async function main() {
  const message = process.argv.slice(2).join(' ') || 'Asia-Power Telegram notifications are active.';
  if (!isEnabled()) {
    console.error('Telegram not configured. Set ASIAPOWER_TELEGRAM_BOT_TOKEN and ASIAPOWER_TELEGRAM_CHAT_ID in .env');
    process.exit(1);
  }
  const result = await notify(message);
  if (!result.ok) {
    console.error('Telegram send failed:', result.error || result);
    process.exit(1);
  }
  console.log('Telegram message sent.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
