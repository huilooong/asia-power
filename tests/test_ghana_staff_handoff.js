'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

async function load() {
  const mod = path.resolve(__dirname, '../deploy/apsales-live-draft/ghana-staff-handoff.mjs');
  return import(pathToFileURL(mod).href);
}

const CONTACT = '054 913 5916';

test('containsGhanaSupportContact: spaced local format', async () => {
  const { containsGhanaSupportContact } = await load();
  assert.equal(
    containsGhanaSupportContact('Please call our Accra team at 054 913 5916, Chief.', CONTACT),
    true,
  );
});

test('containsGhanaSupportContact: compact digits', async () => {
  const { containsGhanaSupportContact } = await load();
  assert.equal(containsGhanaSupportContact('Call 0549135916', CONTACT), true);
});

test('containsGhanaSupportContact: +233 prefix', async () => {
  const { containsGhanaSupportContact } = await load();
  assert.equal(containsGhanaSupportContact('WhatsApp +233 54 913 5916', CONTACT), true);
});

test('containsGhanaSupportContact: unrelated reply', async () => {
  const { containsGhanaSupportContact } = await load();
  assert.equal(containsGhanaSupportContact('Got it — Accra pickup works.', CONTACT), false);
});

test('buildHandoffSummary: only matching customer, last N turns', async () => {
  const { buildHandoffSummary } = await load();
  const fake = [
    {
      customer: { customer_id: 'wa:233111111111', message: 'other' },
      reply: { text: 'nope' },
    },
    {
      customer: { customer_id: 'wa:233543709670', message: 'need engine' },
      reply: { text: 'send VIN' },
    },
    {
      customer: { customer_id: 'wa:233543709670', message: 'Accra pickup?' },
      reply: { text: 'call 054 913 5916' },
    },
  ]
    .map((r) => JSON.stringify(r))
    .join('\n');

  const summary = await buildHandoffSummary({
    workspace: '/tmp',
    customerId: 'wa:233543709670',
    maxTurns: 4,
    readFile: async () => fake,
  });
  assert.ok(summary);
  assert.match(summary, /need engine/);
  assert.match(summary, /Accra pickup/);
  assert.match(summary, /子敬/);
  assert.ok(!/other/.test(summary));
});

test('notifyGhanaStaffIfHandingOff: hits contact → sendText to staff', async () => {
  const { notifyGhanaStaffIfHandingOff } = await load();
  const calls = [];
  const session = {
    sendText: async (to, text) => {
      calls.push({ to, text });
      return { messageId: 'wamid.test' };
    },
  };
  const out = await notifyGhanaStaffIfHandingOff({
    senderId: '+233543709670',
    replyText: 'Please contact 054 913 5916 for Accra pickup.',
    workspace: '/tmp',
    session,
    contactLocal: CONTACT,
    contactE164: '+233549135916',
  });
  assert.equal(out.notified, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, '+233549135916');
  assert.match(calls[0].text, /\+233543709670/);
});

test('notifyGhanaStaffIfHandingOff: miss → no send', async () => {
  const { notifyGhanaStaffIfHandingOff } = await load();
  let called = false;
  const out = await notifyGhanaStaffIfHandingOff({
    senderId: '+233543709670',
    replyText: 'Got it, Chief.',
    workspace: '/tmp',
    session: { sendText: async () => { called = true; } },
    contactLocal: CONTACT,
    contactE164: '+233549135916',
  });
  assert.equal(out.notified, false);
  assert.equal(called, false);
});

test('notifyGhanaStaffIfHandingOff: sendText throws → swallowed', async () => {
  const { notifyGhanaStaffIfHandingOff } = await load();
  const out = await notifyGhanaStaffIfHandingOff({
    senderId: '+233543709670',
    replyText: 'Call 0549135916',
    workspace: '/tmp',
    session: {
      sendText: async () => {
        throw new Error('wa_down');
      },
    },
    contactLocal: CONTACT,
    contactE164: '+233549135916',
  });
  assert.equal(out.notified, false);
  assert.match(String(out.error || ''), /wa_down/);
});
