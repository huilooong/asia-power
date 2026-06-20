#!/usr/bin/env node
'use strict';

const { bootstrapEnv, requireServerLib } = require('./telegram-common');

bootstrapEnv();
const { notifyAsync } = requireServerLib('telegram-notify');

const reason = process.argv.slice(2).join(' ') || 'Backup failed';
notifyAsync(`🚨 Backup failure alert\n${reason}`);
console.log('Backup failure alert queued.');
