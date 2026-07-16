'use strict';

/**
 * Part 2 — inquiry→confirm timestamps (data only, no display).
 * Synthetic: customer states part, later team quotes price → both stamps set.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

async function loadHelpers() {
  const mod = path.resolve(__dirname, '../deploy/apsales-live-draft/apsales-human-visibility.mjs');
  return import(pathToFileURL(mod).href);
}

test('withPartFirstRequestedAt stamps on first part_intent', async () => {
  const { withPartFirstRequestedAt } = await loadHelpers();
  const t0 = '2026-07-16T00:10:00.000Z';
  const out = withPartFirstRequestedAt({}, { part_intent: 'engine' }, t0);
  assert.equal(out.part_intent, 'engine');
  assert.equal(out.part_first_requested_at, t0);
});

test('withPartFirstRequestedAt stamps on first vin write', async () => {
  const { withPartFirstRequestedAt } = await loadHelpers();
  const t0 = '2026-07-16T00:11:00.000Z';
  const out = withPartFirstRequestedAt(
    { part_intent: 'engine' },
    { vin: 'JTMBD31V586098976' },
    t0,
  );
  assert.equal(out.vin, 'JTMBD31V586098976');
  assert.equal(out.part_first_requested_at, t0);
});

test('withPartFirstRequestedAt does not overwrite existing stamp', async () => {
  const { withPartFirstRequestedAt } = await loadHelpers();
  const prev = {
    part_intent: 'engine',
    part_first_requested_at: '2026-07-16T00:10:00.000Z',
  };
  const out = withPartFirstRequestedAt(
    prev,
    { engine_code: '2AZ-FE' },
    '2026-07-16T00:20:00.000Z',
  );
  assert.equal(out.engine_code, '2AZ-FE');
  assert.equal(out.part_first_requested_at, undefined);
});

test('looksLikeTeamPriceOrStockConfirm recognizes USD quote', async () => {
  const { looksLikeTeamPriceOrStockConfirm } = await loadHelpers();
  assert.equal(looksLikeTeamPriceOrStockConfirm('Engine + gearbox 950 USD'), true);
  assert.equal(looksLikeTeamPriceOrStockConfirm('Hi, how are you?'), false);
  assert.equal(looksLikeTeamPriceOrStockConfirm('EXW Shanghai, in stock'), true);
});

test('synthetic flow: inquiry then team quote → both timestamps', async () => {
  const {
    withPartFirstRequestedAt,
    withTeamConfirmedAt,
    nextTeamReplies,
  } = await loadHelpers();

  let state = {};
  const tAsk = '2026-07-16T01:00:00.000Z';
  const tQuote = '2026-07-16T03:30:00.000Z';

  const askPatch = withPartFirstRequestedAt(state, { part_intent: 'engine', engine_code: 'G4KE' }, tAsk);
  state = { ...state, ...askPatch };
  assert.equal(state.part_first_requested_at, tAsk);
  assert.ok(!state.team_confirmed_at);

  // Non-quote team chat must not confirm.
  let confirm = withTeamConfirmedAt(state, 'Please send VIN photo', tQuote);
  assert.deepEqual(confirm, {});

  const quoteText = 'G4KE engine available — 880 USD EXW';
  confirm = withTeamConfirmedAt(state, quoteText, tQuote);
  assert.equal(confirm.team_confirmed_at, tQuote);
  assert.equal(confirm.confirmation_status, 'team_quoted');
  assert.equal(confirm.source_channel, 'whatsapp_team');

  const team_replies = nextTeamReplies(state.team_replies, {
    text: quoteText,
    at: tQuote,
    message_id: 'WAMID-TEAM-1',
  });
  state = { ...state, team_replies, ...confirm };

  assert.equal(state.part_first_requested_at, tAsk);
  assert.equal(state.team_confirmed_at, tQuote);
  assert.ok(Date.parse(state.team_confirmed_at) > Date.parse(state.part_first_requested_at));
});
