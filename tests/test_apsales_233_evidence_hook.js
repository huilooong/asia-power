'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('+233 evidence-hook writes whatsapp turns with line=+233 and wa: digits', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apsales-233-ev-'));
  process.env.ASIAPOWER_ROOT = tmp;
  process.env.APSALES_EVIDENCE_ENABLED = 'true';

  const hookPath = path.resolve(__dirname, '../deploy/apsales-live-draft/evidence-hook.mjs');
  const hook = await import(hookPath);

  hook.recordReplyForEvidence({
    senderId: '+233591196641',
    text: 'Need G4KD engine',
    messageId: 'wamid.TEST233HOOK001',
    observedAt: '2026-07-14T12:00:00.000Z',
    messageType: 'text',
    originalReply: 'Got it — which port?',
    finalReply: 'Got it — which port?',
    reasonCode: 'openclaw_reply',
    genDecision: 'test-model',
    outboundWamid: 'wamid.OUT233',
    sent: true,
    line: '+233',
  });

  const turnsFile = path.join(tmp, 'data', 'evidence', 'whatsapp', 'turns.ndjson');
  assert.ok(fs.existsSync(turnsFile), 'turns.ndjson should exist');
  const lines = fs.readFileSync(turnsFile, 'utf8').trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const turn = JSON.parse(lines[0]);
  assert.equal(turn.channel, 'whatsapp');
  assert.equal(turn.line, '+233');
  assert.equal(turn.customer.customer_id, 'wa:233591196641');
  assert.equal(turn.customer.conversation_id, '233591196641');
  assert.equal(turn.customer.message, 'Need G4KD engine');
  assert.equal(turn.reply.text, 'Got it — which port?');
  assert.equal(turn.reply.sent, true);

  // Second inbound should patch previous pending turn (customer result)
  hook.recordInboundForEvidence({
    senderId: '+233591196641',
    text: 'Tema',
    messageId: 'wamid.TEST233HOOK002',
    observedAt: '2026-07-14T12:01:00.000Z',
    messageType: 'text',
  });
  const patchesFile = path.join(tmp, 'data', 'evidence', 'whatsapp', 'patches.ndjson');
  assert.ok(fs.existsSync(patchesFile), 'patches.ndjson should exist after follow-up inbound');
  const patch = JSON.parse(fs.readFileSync(patchesFile, 'utf8').trim().split('\n').filter(Boolean).pop());
  assert.equal(patch.type, 'evidence_patch');
  assert.equal(patch.evidence_id, turn.evidence_id);
  assert.equal(patch.channel, 'whatsapp');
});

test('toNormalized strips + from senderId', async () => {
  const hookPath = path.resolve(__dirname, '../deploy/apsales-live-draft/evidence-hook.mjs');
  const hook = await import(hookPath);
  const n = hook.toNormalized({
    senderId: '+233209664844',
    text: 'Hi',
    messageId: 'x',
    observedAt: '2026-07-14T00:00:00.000Z',
    messageType: 'text',
  });
  assert.equal(n.wa_id, '233209664844');
  assert.doesNotMatch(n.wa_id, /^\+/);
});
