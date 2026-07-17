import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  const mod = path.resolve(__dirname, "../deploy/apsales-live-draft/apsales-soft-angle.mjs");
  return import(pathToFileURL(mod).href);
}

test("detectPossibleRepeat: holding phrase twice → hit", async () => {
  const { detectPossibleRepeat } = await load();
  const out = detectPossibleRepeat([
    "We are checking the price for the Lexus IS — team will confirm.",
    "Got it! We are working on confirming the price with the team.",
  ]);
  assert.equal(out.possible_repeat_detected, true);
  assert.ok(out.matched_phrases.length >= 1 || out.possible_repeat_detected);
});

test("detectPossibleRepeat: different content → miss", async () => {
  const { detectPossibleRepeat } = await load();
  const out = detectPossibleRepeat([
    "The 2SZ-FE engine is 900 USD EXW.",
    "Tema shipping is fine — how many units do you need?",
  ]);
  assert.equal(out.possible_repeat_detected, false);
});

test("detectPossibleRepeat: single reply → miss", async () => {
  const { detectPossibleRepeat } = await load();
  assert.equal(
    detectPossibleRepeat(["Team is still confirming the price."]).possible_repeat_detected,
    false,
  );
});

test("uncoveredClosingAngles: respects existing port/qty/payment_notes only", async () => {
  const { uncoveredClosingAngles } = await load();
  const empty = uncoveredClosingAngles({});
  assert.ok(empty.includes("where"));
  assert.ok(empty.includes("how_much"));
  assert.ok(empty.includes("how"));
  const partial = uncoveredClosingAngles({
    destination_port: "Tema",
    quantity: "2 units",
    payment_notes: "T/T",
    // closing-flow fields must not create a parallel closing_stage
    payment_status: "paid_in_full",
    fulfillment_stage: "video_sent",
  });
  assert.ok(!partial.includes("where"));
  assert.ok(!partial.includes("how_much"));
  assert.ok(!partial.includes("how"));
  assert.ok(partial.includes("why") || partial.includes("when"));
});

test("stampChatAngle / normalizeChatAngleUsed", async () => {
  const { stampChatAngle, normalizeChatAngleUsed } = await load();
  assert.equal(normalizeChatAngleUsed("how_much"), "how_much");
  assert.equal(normalizeChatAngleUsed("none"), "");
  const patch = stampChatAngle({}, "where", "2026-07-17T03:00:00.000Z", { dryRun: true });
  assert.equal(patch.last_chat_angle, "where");
  assert.equal(patch.last_chat_angle_dry_run, true);
});
