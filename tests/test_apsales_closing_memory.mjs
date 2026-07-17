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
