'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('supplier dashboard exposes a self-service referral-code view', () => {
  const html = read('supplier-portal/dashboard.html');
  const js = read('js/supplier-dashboard.js');

  assert.match(html, /id="show-referral-btn"/);
  assert.match(html, /id="referral-panel"/);
  assert.match(html, /id="copy-referral-code"/);
  assert.match(html, /supplier-dashboard\.js\?v=supplier-referral-v1/);
  assert.match(js, /\/api\/supplier\/referral-code/);
  assert.match(js, /navigator\.clipboard/);
  assert.match(js, /referral-panel/);
});

test('supplier registration explains both accepted code types', () => {
  const html = read('login/index.html');
  const js = read('js/login.js');

  assert.match(html, /Referral code \/ AsiaPower admission code/);
  assert.match(html, /supplier referral code is reusable/i);
  assert.match(html, /AsiaPower admission code is phone-bound/i);
  assert.match(html, /login\.js\?v=supplier-referral-v1/);
  assert.match(js, /推荐人邀请码 \/ AsiaPower 准入码/);
});

test('admin inventory renders referral attribution and account directory', () => {
  const html = read('admin/inventory.html');
  const js = read('js/admin-supplier-invites.js');

  assert.match(html, /admin-supplier-invites\.js\?v=supplier-referral-v1/);
  assert.match(js, /\/api\/admin\/supplier-referrals/);
  assert.match(js, /新供应商是谁邀请的/);
  assert.match(js, /supplier-referral-events/);
  assert.match(js, /supplier-referral-directory/);
});

test('personal referral codes are loaded at runtime, not embedded in UI assets', () => {
  const files = [
    'supplier-portal/dashboard.html',
    'js/supplier-dashboard.js',
    'login/index.html',
    'js/login.js',
    'admin/inventory.html',
    'js/admin-supplier-invites.js',
  ];
  const source = files.map(read).join('\n');
  const embeddedCodes = source.match(/AP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/g) || [];
  assert.deepEqual(embeddedCodes.filter((code) => code !== 'AP-XXXX-XXXX'), []);
});
