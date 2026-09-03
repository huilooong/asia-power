'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { EventEmitter } = require('events');

const { buildPromotionSnapshot, createNativeEnrichmentController, sanitizeRunOptions } = require('../server/lib/apbd-admin');

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apbd-admin-'));
  const campaignDir = path.join(root, 'runtime/apbd/solo_trade/campaigns/solo-test');
  const dbDir = path.join(root, 'runtime/apbd/leads/db');
  fs.mkdirSync(campaignDir, { recursive: true });
  fs.mkdirSync(dbDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts-placeholder'), '');
  fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify({
    campaign_id: 'solo-test', name: 'Toyota engines', brief: { target_markets: ['Venezuela'] },
    leads: [{
      lead_id: 'lead-1', apbd_company_id: 'company-1', company: 'Example Motors', city: 'Valencia',
      website: 'https://example.test/', public_email: 'private@example.test', api_key: 'secret-key',
      contacts: [{ value: 'private@example.test' }], source_urls: ['https://example.test/'],
      provider_enrichment: { hunter: { contacts_found: 1, new_contacts: 1, result: { contacts: [{ email: 'private@example.test', status: 'valid' }] } } },
      score: { overall_score: 52, grade: 'C', confidence: 70, notes: ['Evidence found'] }, activities: [], status: 'researched',
    }],
  }));
  fs.writeFileSync(path.join(dbDir, 'companies.json'), JSON.stringify({ companies: [{
    id: 'company-1', native_enrichment: { version: 'apbd-native-enrichment-v1', outreach_sent: false, summary: { public_emails_checked: 1, official_domain_emails: 1, role_mailboxes: 1, send_eligible: 0 } },
  }] }));
  return root;
}

test('promotion snapshot exposes evidence counts but redacts contacts and keys', () => {
  const snapshot = buildPromotionSnapshot(fixtureRoot());
  const raw = JSON.stringify(snapshot);
  assert.equal(snapshot.summary.totalLeads, 1);
  assert.equal(snapshot.native.publicEmailsChecked, 1);
  assert.equal(snapshot.leads[0].native.sendEligible, 0);
  assert.ok(!raw.includes('private@example.test'));
  assert.ok(!raw.includes('secret-key'));
});

test('run options reject command injection shapes and out-of-range work', () => {
  assert.deepEqual(sanitizeRunOptions({ country: 've', city: 'Valencia', limit: 10, workers: 3 }), { country: 'VE', city: 'Valencia', limit: 10, workers: 3 });
  assert.throws(() => sanitizeRunOptions({ country: 'VE;rm', limit: 10, workers: 3 }), /ISO-2/);
  assert.throws(() => sanitizeRunOptions({ country: 'VE', city: 'x\n--evil', limit: 10, workers: 3 }), /invalid city/);
  assert.throws(() => sanitizeRunOptions({ country: 'VE', limit: 1000, workers: 3 }), /1-100/);
});

test('controller spawns fixed script without a shell and records no-send state', () => {
  const root = fixtureRoot();
  const script = path.join(root, 'scripts/apbd_leads_native_enrich.py');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, '#!/usr/bin/env python3\n');
  let captured;
  const fakeSpawn = (bin, args, opts) => {
    captured = { bin, args, opts };
    const child = new EventEmitter();
    child.pid = process.pid;
    return child;
  };
  const controller = createNativeEnrichmentController(root, { spawnProcess: fakeSpawn });
  const state = controller.start({ country: 'VE', city: 'Valencia', limit: 5, workers: 2 });
  assert.equal(state.status, 'running');
  assert.equal(state.outreachSent, false);
  assert.equal(captured.opts.shell, false);
  assert.ok(captured.args.includes(script));
  assert.ok(!captured.args.some((arg) => String(arg).includes(';')));
});

test('local and production servers expose the same authenticated APBD routes', () => {
  const local = fs.readFileSync(path.join(__dirname, '../server/half-cut-local-server.js'), 'utf8');
  const production = fs.readFileSync(path.join(__dirname, '../deploy/inventory-site-server.js'), 'utf8');
  for (const route of [
    '/api/admin/apbd/solo-trade',
    '/api/admin/apbd/native-enrichment/status',
    '/api/admin/apbd/native-enrichment/run',
  ]) {
    assert.ok(local.includes(route), `local route missing: ${route}`);
    assert.ok(production.includes(route), `production route missing: ${route}`);
  }
  assert.ok(local.includes('auth.requireAdmin(req, res)'));
  assert.ok(production.includes('requireAdmin(req, res)'));
});
