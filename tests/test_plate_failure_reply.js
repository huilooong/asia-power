'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('node:url');

async function loadHelpers() {
  const mod = path.resolve(__dirname, '../deploy/apsales-live-draft/apsales-human-visibility.mjs');
  return import(pathToFileURL(mod).href);
}

const failImg = { message_type: 'image', vin_decode: { status: 'failed', error: 'no_vin' } };
const t0 = Date.parse('2026-07-18T05:00:00.000Z');

test('plateFailureReply: no dealState asks for nameplate/VIN sticker (not blur wording)', async () => {
  const { plateFailureReply } = await loadHelpers();
  const reply = plateFailureReply(failImg, null);
  assert.match(reply, /nameplate\/VIN sticker/i);
  assert.match(reply, /not a general shot/i);
  assert.ok(!/couldn't read the plate clearly/i.test(reply));
  assert.ok(!/clearer photo/i.test(reply));
});

test('plateFailureReply: dealState.vin uses already-confirmed copy', async () => {
  const { plateFailureReply } = await loadHelpers();
  const reply = plateFailureReply(
    { message_type: 'image', vin_decode: { status: 'failed' } },
    { vin: 'JTMBD31V586098976', brand: 'Toyota', model: 'RAV4', year: '2008', engine_code: '2AZ-FE' },
  );
  assert.match(reply, /already have your vehicle confirmed/i);
  assert.match(reply, /Toyota/);
  assert.match(reply, /2AZ-FE/);
  assert.ok(!/nameplate\/VIN sticker/i.test(reply));
});

test('plateFailureReply: part_intent without vin uses parts-photo copy (not plate ask)', async () => {
  const { plateFailureReply } = await loadHelpers();
  const reply = plateFailureReply(
    { message_type: 'image', vin_decode: { status: 'uncertain' } },
    { part_intent: 'engine' },
  );
  assert.match(reply, /noted for your engine request/i);
  assert.ok(!/nameplate\/VIN sticker/i.test(reply));
});

test('plateFailureReply: body-part intent (windscreen) acknowledges part photo', async () => {
  const { plateFailureReply } = await loadHelpers();
  const reply = plateFailureReply(
    { message_type: 'image', vin_decode: { status: 'failed', error: 'no_vin' } },
    { part_intent: 'windscreen' },
  );
  assert.match(reply, /noted for your windscreen request/i);
  assert.match(reply, /get you a price/i);
  assert.ok(!/nameplate\/VIN sticker/i.test(reply));
});

test('plateFailureReply: part_intent wins over junk/confirmed vin on OCR fail', async () => {
  const { plateFailureReply } = await loadHelpers();
  const reply = plateFailureReply(
    { message_type: 'image', vin_decode: { status: 'failed' } },
    { part_intent: 'parts', vin: 'AAAYRWMZ42FJ4A777' },
  );
  assert.match(reply, /noted for your parts request/i);
  assert.ok(!/nameplate\/VIN sticker/i.test(reply));
  assert.ok(!/already have your vehicle confirmed/i.test(reply));
});

test('plateFailureReply: empty dealState (no part_intent, no vin) asks for nameplate', async () => {
  const { plateFailureReply } = await loadHelpers();
  const reply = plateFailureReply(failImg, {});
  assert.match(reply, /nameplate\/VIN sticker/i);
});

test('decidePlateFailureReply: 2nd failure in window is silence; OCR path still returns decision', async () => {
  const { decidePlateFailureReply, plateFailureAskCopy } = await loadHelpers();
  const first = decidePlateFailureReply(failImg, {}, t0);
  assert.equal(first.silence, false);
  assert.equal(first.reply, plateFailureAskCopy('primary'));
  assert.equal(first.dealPatch.plate_failure_streak, 1);
  assert.equal(first.dealPatch.last_plate_failure_reply_kind, 'primary');

  const second = decidePlateFailureReply(
    failImg,
    {
      last_plate_failure_reply_at: first.dealPatch.last_plate_failure_reply_at,
      plate_failure_streak: 1,
      last_plate_failure_reply_kind: 'primary',
    },
    t0 + 60_000,
  );
  assert.equal(second.silence, true);
  assert.equal(second.reply, null);
  assert.equal(second.dealPatch.plate_failure_streak, 2);

  const third = decidePlateFailureReply(
    failImg,
    {
      last_plate_failure_reply_at: first.dealPatch.last_plate_failure_reply_at,
      plate_failure_streak: 2,
      last_plate_failure_reply_kind: 'primary',
    },
    t0 + 120_000,
  );
  assert.equal(third.silence, false);
  assert.equal(third.reply, plateFailureAskCopy('escalate'));
  assert.equal(third.dealPatch.last_plate_failure_reply_kind, 'escalate');
  assert.match(third.reply, /type the chassis\/VIN/i);
});

test('decidePlateFailureReply: after window expires, primary ask again', async () => {
  const { decidePlateFailureReply, PLATE_FAILURE_DEDUP_MS } = await loadHelpers();
  const again = decidePlateFailureReply(
    failImg,
    {
      last_plate_failure_reply_at: new Date(t0).toISOString(),
      plate_failure_streak: 5,
      last_plate_failure_reply_kind: 'escalate',
    },
    t0 + PLATE_FAILURE_DEDUP_MS + 1,
  );
  assert.equal(again.silence, false);
  assert.match(again.reply, /nameplate\/VIN sticker/i);
  assert.equal(again.dealPatch.plate_failure_streak, 1);
  assert.equal(again.dealPatch.last_plate_failure_reply_kind, 'primary');
});

test('plateFailureResetPatch clears streak fields', async () => {
  const { plateFailureResetPatch } = await loadHelpers();
  assert.deepEqual(plateFailureResetPatch(), {
    plate_failure_streak: 0,
    last_plate_failure_reply_at: null,
    last_plate_failure_reply_kind: null,
  });
});

test('partIntentFromText: body-part list from CEO case maps to parts', async () => {
  const { partIntentFromText } = await loadHelpers();
  assert.equal(
    partIntentFromText('windscreen, driving mirror, side mirror, headlights'),
    'parts',
  );
  assert.equal(partIntentFromText('need a clearer grille photo'), 'grille');
  assert.equal(partIntentFromText('engine only please'), 'engine');
  assert.equal(partIntentFromText('hello how are you'), null);
});

test('plateFailureReply: success status returns null', async () => {
  const { plateFailureReply } = await loadHelpers();
  assert.equal(
    plateFailureReply({ message_type: 'image', vin_decode: { status: 'success' } }, { vin: 'X' }),
    null,
  );
});

test('bot outbound id echo is dropped; unknown fromMe is human', async () => {
  const {
    clearBotOutboundTracking,
    noteBotSend,
    isBotOutboundEcho,
  } = await loadHelpers();
  clearBotOutboundTracking();

  noteBotSend('+233543709670', 'Got it — Toyota / 2AZ-FE.', 'BOTMSG001');
  assert.equal(
    isBotOutboundEcho({
      fromMe: true,
      messageId: 'BOTMSG001',
      fromPhoneE164: '+233543709670',
      text: 'Got it — Toyota / 2AZ-FE.',
    }),
    true,
  );
  assert.equal(
    isBotOutboundEcho({
      fromMe: true,
      messageId: 'HUMANMSG999',
      fromPhoneE164: '+233543709670',
      text: 'Engine + gearbox 950 USD, shipping 280, about 2 months.',
    }),
    false,
  );
});

test('text+window fallback treats matching recent bot text as echo', async () => {
  const {
    clearBotOutboundTracking,
    noteBotSend,
    isBotOutboundEcho,
  } = await loadHelpers();
  clearBotOutboundTracking();
  noteBotSend('+233111', 'Same bot text', 'ID-A');
  // Simulate Baileys returning a different upsert id than sendText
  assert.equal(
    isBotOutboundEcho({
      fromMe: true,
      messageId: 'DIFFERENT-ID',
      fromPhoneE164: '+233111',
      text: 'Same bot text',
    }),
    true,
  );
});

test('nextTeamReplies keeps last N', async () => {
  const { nextTeamReplies } = await loadHelpers();
  let list = [];
  for (let i = 0; i < 12; i += 1) {
    list = nextTeamReplies(list, { text: `t${i}`, at: `2026-07-15T00:00:${String(i).padStart(2, '0')}Z` }, 10);
  }
  assert.equal(list.length, 10);
  assert.equal(list[0].text, 't2');
  assert.equal(list[9].text, 't11');
});

test('classifyFromMeMessage: bot echo vs team reply (no auto-reply path)', async () => {
  const {
    clearBotOutboundTracking,
    noteBotSend,
    classifyFromMeMessage,
    nextTeamReplies,
  } = await loadHelpers();
  clearBotOutboundTracking();
  noteBotSend('+233543709670', 'bot said this', 'WAMID-BOT');

  assert.equal(
    classifyFromMeMessage({
      fromMe: true,
      messageId: 'WAMID-BOT',
      fromPhoneE164: '+233543709670',
      text: 'bot said this',
    }),
    'bot_echo',
  );

  const human = {
    fromMe: true,
    messageId: 'WAMID-HUMAN',
    fromPhoneE164: '+233543709670',
    text: 'Engine + gearbox 950 USD',
  };
  assert.equal(classifyFromMeMessage(human), 'team_reply');

  // Simulate deal_state append — auto-reply must not run for team_reply class
  const team_replies = nextTeamReplies([], {
    text: human.text,
    at: '2026-07-15T00:38:04Z',
    message_id: human.messageId,
  });
  assert.equal(team_replies.length, 1);
  assert.equal(team_replies[0].text, 'Engine + gearbox 950 USD');
});
