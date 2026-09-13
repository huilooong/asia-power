'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveBrandBrowseUrls } = require('../server/lib/half-cut-seo');

test('uses a real dedicated brand page when the file exists', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-brand-links-'));
  fs.mkdirSync(path.join(publicDir, 'brands'));
  fs.writeFileSync(path.join(publicDir, 'brands', 'toyota.html'), '<!doctype html>');
  const links = resolveBrandBrowseUrls({ brandSlug: 'toyota' }, '../', publicDir, '../half-cuts/');
  assert.deepEqual(links, {
    inventory: '../brands/toyota.html#halfcuts-inventory',
    engines: '../brands/toyota.html#engines',
    gearboxes: '../brands/toyota.html#gearboxes',
  });
});

test('falls back to working filtered catalogs when no brand page exists', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-brand-links-'));
  const links = resolveBrandBrowseUrls({ brandSlug: 'hyundai-trucks' }, '../', publicDir, '../trucks/');
  assert.deepEqual(links, {
    inventory: '../trucks/?brand=hyundai-trucks',
    engines: '../engines/?brand=hyundai-trucks',
    gearboxes: '../gearboxes/?brand=hyundai-trucks',
  });
});
