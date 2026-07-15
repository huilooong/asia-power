'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const mod = require(path.resolve(__dirname, '../server/lib/system-metrics.js'));

test('formatMetricsSummary: synthetic full metrics', () => {
  const text = mod.formatMetricsSummary({
    disk: { usedPct: 42, usedGb: 20, totalGb: 48 },
    memory: { usedPct: 61, usedMb: 2400, totalMb: 3900 },
    uptime: '3d 4h',
    services: { 'inventory-site': 'active', 'apsales-whatsapp-bridge': 'active' },
  });
  assert.match(text, /Disk: 42%/);
  assert.match(text, /Memory: 61%/);
  assert.match(text, /Uptime: 3d 4h/);
  assert.match(text, /inventory-site=active/);
  assert.match(text, /apsales-whatsapp-bridge=active/);
});

test('formatMetricsSummary: null fields → unknown, no throw', () => {
  const text = mod.formatMetricsSummary({ disk: null, memory: null, uptime: null, services: {} });
  assert.match(text, /Disk: unknown/);
  assert.match(text, /Memory: unknown/);
  assert.match(text, /Uptime: unknown/);
  assert.match(text, /Services: unknown/);
});

test('formatMetricsSummary: bad input → safe fallback', () => {
  const text = mod.formatMetricsSummary(null);
  assert.match(text, /Disk: unknown/);
});

test('collectSystemMetrics: does not throw', () => {
  const m = mod.collectSystemMetrics();
  assert.ok(m && typeof m === 'object');
  assert.ok(m.collectedAt);
  // On macOS CI, systemctl may be unknown — still must return an object
  assert.ok(m.services && typeof m.services === 'object');
});
