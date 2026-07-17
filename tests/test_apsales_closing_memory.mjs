import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  const mod = path.resolve(__dirname, "../deploy/apsales-live-draft/apsales-closing-memory.mjs");
  return import(pathToFileURL(mod).href);
}

test("extractClosingFieldsFromText: port / qty / payment", async () => {
  const { extractClosingFieldsFromText } = await load();
  const port = extractClosingFieldsFromText("Ship to Tema please");
  assert.equal(port.destination_port, "Tema");
  const qty = extractClosingFieldsFromText("I need 2 units of the engine");
  assert.match(qty.quantity, /2\s*units/i);
  const pay = extractClosingFieldsFromText("Can I pay by T/T with 30% deposit?");
  assert.ok(pay.payment_notes);
  assert.deepEqual(extractClosingFieldsFromText("Just checking price"), {});
});

test("mergeClosingFields: keep first port/qty; refresh payment notes", async () => {
  const { mergeClosingFields } = await load();
  const prev = { destination_port: "Tema", quantity: "1 unit" };
  const patch = mergeClosingFields(prev, {
    destination_port: "Lagos",
    quantity: "2 units",
    payment_notes: "LC please",
  });
  assert.deepEqual(patch, { payment_notes: "LC please" });
});

test("stampBuyingIntentConfirmed: first stamp only", async () => {
  const { stampBuyingIntentConfirmed } = await load();
  assert.deepEqual(stampBuyingIntentConfirmed({}, false, "2026-07-17T00:00:00.000Z"), {});
  const first = stampBuyingIntentConfirmed({}, true, "2026-07-17T00:00:00.000Z");
  assert.equal(first.buying_intent_confirmed, true);
  assert.equal(first.buying_intent_confirmed_at, "2026-07-17T00:00:00.000Z");
  const again = stampBuyingIntentConfirmed(first, true, "2026-07-17T01:00:00.000Z");
  assert.equal(again.buying_intent_confirmed, true);
  assert.equal(again.buying_intent_confirmed_at, undefined);
});

test("shouldAlertHotDealStall: only full hot-stall combo", async () => {
  const { shouldAlertHotDealStall } = await load();
  const now = Date.parse("2026-07-17T12:00:00.000Z");
  const stallMs = 2 * 60 * 60 * 1000;
  const hot = {
    confirmation_status: "team_quoted",
    buying_intent_confirmed: true,
    buying_intent_confirmed_at: "2026-07-17T08:00:00.000Z",
    updated_at: "2026-07-17T09:00:00.000Z",
  };
  assert.equal(shouldAlertHotDealStall(hot, now, stallMs), true);
  assert.equal(
    shouldAlertHotDealStall({ ...hot, confirmation_status: "pending" }, now, stallMs),
    false,
  );
  assert.equal(
    shouldAlertHotDealStall({ ...hot, buying_intent_confirmed: false, buying_intent_confirmed_at: null }, now, stallMs),
    false,
  );
  assert.equal(
    shouldAlertHotDealStall({ ...hot, stall_alert_sent_at: "2026-07-17T11:00:00.000Z" }, now, stallMs),
    false,
  );
  assert.equal(
    shouldAlertHotDealStall({ ...hot, updated_at: "2026-07-17T11:30:00.000Z" }, now, stallMs),
    false,
  );
});

test("formatHotDealStallAlert: english ops copy", async () => {
  const { formatHotDealStallAlert } = await load();
  const text = formatHotDealStallAlert(
    {
      confirmation_status: "team_quoted",
      team_confirmed_at: "2026-07-17T08:00:00.000Z",
      buying_intent_confirmed_at: "2026-07-17T08:30:00.000Z",
      updated_at: "2026-07-17T09:00:00.000Z",
      destination_port: "Tema",
      quantity: "2 units",
      vin: "JTDBT123456789012",
      part_intent: "engine",
    },
    "+233249632526",
  );
  assert.match(text, /Hot deal may be stalling/i);
  assert.match(text, /\+233249632526/);
  assert.match(text, /Tema/);
  assert.ok(!/热单|客户号码/.test(text));
});

test("payment/fulfillment independent: paid_in_full does not skip inspection", async () => {
  const { applyDealProgressPatch } = await load();
  const at = "2026-07-17T10:00:00.000Z";
  let deal = {};
  deal = { ...deal, ...applyDealProgressPatch(deal, { payment_status: "paid_in_full" }, at) };
  assert.equal(deal.payment_status, "paid_in_full");
  assert.equal(deal.paid_in_full_at, at);
  assert.equal(deal.fulfillment_stage, undefined);
  deal = {
    ...deal,
    ...applyDealProgressPatch(deal, { fulfillment_stage: "sourcing" }, at),
  };
  assert.equal(deal.fulfillment_stage, "sourcing");
  deal = {
    ...deal,
    ...applyDealProgressPatch(deal, { fulfillment_stage: "video_sent" }, at),
  };
  assert.equal(deal.fulfillment_stage, "video_sent");
  assert.equal(deal.payment_status, "paid_in_full");
  deal = {
    ...deal,
    ...applyDealProgressPatch(deal, { fulfillment_stage: "inspection_scheduled" }, at),
  };
  assert.equal(deal.fulfillment_stage, "inspection_scheduled");
  assert.equal(deal.inspection_attempt_count, 1);
});

test("inspection_failed resets stage to sourcing; payment unchanged", async () => {
  const { applyDealProgressPatch } = await load();
  const at = "2026-07-17T11:00:00.000Z";
  const prev = {
    payment_status: "inspection_fee_paid",
    inspection_fee_paid_at: "2026-07-17T09:00:00.000Z",
    fulfillment_stage: "inspection_scheduled",
    inspection_attempt_count: 1,
  };
  const patch = applyDealProgressPatch(
    prev,
    { fulfillment_stage: "inspection_failed", inspection_fail_reason: "cracked block" },
    at,
  );
  assert.equal(patch.fulfillment_stage, "sourcing");
  assert.equal(patch.payment_status, undefined);
  assert.equal(prev.payment_status, "inspection_fee_paid");
  assert.equal(patch.inspection_result_history?.length, 1);
  assert.equal(patch.inspection_result_history[0].result, "failed");
  // timestamps not overwritten
  const again = applyDealProgressPatch(
    { ...prev, ...patch },
    { payment_status: "inspection_fee_paid" },
    "2026-07-17T12:00:00.000Z",
  );
  assert.equal(again.inspection_fee_paid_at, undefined);
});

test("ready_to_ship only after inspection_passed + money in", async () => {
  const { applyDealProgressPatch } = await load();
  const at = "2026-07-17T12:00:00.000Z";
  const unpaidPassed = applyDealProgressPatch(
    { fulfillment_stage: "inspection_scheduled", payment_status: "unpaid" },
    { fulfillment_stage: "inspection_passed" },
    at,
  );
  assert.equal(unpaidPassed.fulfillment_stage, "inspection_passed");
  const paidThenPass = applyDealProgressPatch(
    { fulfillment_stage: "inspection_scheduled", payment_status: "paid_in_full" },
    { fulfillment_stage: "inspection_passed" },
    at,
  );
  assert.equal(paidThenPass.fulfillment_stage, "ready_to_ship");
  const passThenBalance = applyDealProgressPatch(
    { fulfillment_stage: "inspection_passed", payment_status: "inspection_fee_paid" },
    { payment_status: "balance_paid" },
    at,
  );
  assert.equal(passThenBalance.payment_status, "balance_paid");
  assert.equal(passThenBalance.fulfillment_stage, "ready_to_ship");
});

test("shouldNotifyBuyingIntentInstant: first time only", async () => {
  const { shouldNotifyBuyingIntentInstant } = await load();
  assert.equal(shouldNotifyBuyingIntentInstant({}, true), true);
  assert.equal(shouldNotifyBuyingIntentInstant({}, false), false);
  assert.equal(
    shouldNotifyBuyingIntentInstant({ buying_intent_confirmed_at: "x" }, true),
    false,
  );
  assert.equal(
    shouldNotifyBuyingIntentInstant({ buying_intent_confirmed_notified_at: "x" }, true),
    false,
  );
});

test("formatBuyingIntentInstantAlert includes customer message", async () => {
  const { formatBuyingIntentInstantAlert } = await load();
  const text = formatBuyingIntentInstantAlert({
    senderId: "+233249632526",
    customerMessage: "yes let's proceed, how do I pay?",
    dealState: { confirmation_status: "team_quoted", part_intent: "engine" },
  });
  assert.match(text, /Buying intent confirmed/i);
  assert.match(text, /\+233249632526/);
  assert.match(text, /how do I pay/);
});

test("shouldSendQuoteFollowup: 24h quiet + once", async () => {
  const { shouldSendQuoteFollowup } = await load();
  const now = Date.parse("2026-07-18T12:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;
  const base = {
    confirmation_status: "team_quoted",
    last_customer_message_at: "2026-07-17T11:00:00.000Z",
  };
  assert.equal(shouldSendQuoteFollowup(base, now, day), true);
  assert.equal(
    shouldSendQuoteFollowup({ ...base, buying_intent_confirmed: true }, now, day),
    false,
  );
  assert.equal(
    shouldSendQuoteFollowup({ ...base, quote_followup_sent_at: "x" }, now, day),
    false,
  );
  assert.equal(
    shouldSendQuoteFollowup(
      { ...base, last_customer_message_at: "2026-07-18T11:00:00.000Z" },
      now,
      day,
    ),
    false,
  );
});

test("buildQuoteFollowupMessage: concern-first, no urgency", async () => {
  const { buildQuoteFollowupMessage } = await load();
  const msg = buildQuoteFollowupMessage({ part_intent: "engine" }, new Date("2026-07-17T09:00:00Z"));
  assert.match(msg, /holding you back|price or shipping/i);
  assert.ok(!/urgent|last chance|hurry|limited/i.test(msg));
  assert.ok(!/^still (interested|considering)\??$/i.test(msg.trim()));
});

test("stampQuoteDeclineReason: once", async () => {
  const { stampQuoteDeclineReason, awaitingQuoteFollowupReply } = await load();
  assert.equal(
    awaitingQuoteFollowupReply({ quote_followup_sent_at: "x" }),
    true,
  );
  const first = stampQuoteDeclineReason({}, "price too high", "2026-07-17T12:00:00.000Z");
  assert.equal(first.quote_decline_reason, "price too high");
  assert.deepEqual(
    stampQuoteDeclineReason(first, "shipping time", "2026-07-17T13:00:00.000Z"),
    {},
  );
});

test("team text advances video/inspection", async () => {
  const { extractDealProgressFromTeamText } = await load();
  assert.equal(extractDealProgressFromTeamText("video sent to customer").fulfillment_stage, "video_sent");
  assert.equal(extractDealProgressFromTeamText("inspection failed reason: noise").fulfillment_stage, "inspection_failed");
  assert.equal(extractDealProgressFromTeamText("inspection fee paid $50").payment_status, "inspection_fee_paid");
});
