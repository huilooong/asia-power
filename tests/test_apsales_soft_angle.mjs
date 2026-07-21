import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
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

test("uncoveredClosingAngles: third-stage angles require vehicle anchor and part", async () => {
  const { uncoveredClosingAngles } = await load();
  const empty = uncoveredClosingAngles({});
  assert.deepEqual(empty, ["why", "when"]);
  assert.deepEqual(uncoveredClosingAngles({ part_intent: "engine" }), ["why", "when"]);
  assert.deepEqual(uncoveredClosingAngles({ brand: "Toyota", year: "2012" }), ["why", "when"]);
  const ready = uncoveredClosingAngles({ year: "2012", part_intent: "engine" });
  assert.ok(ready.includes("where"));
  assert.ok(ready.includes("how"));
  assert.ok(ready.includes("how_much"));
  const partial = uncoveredClosingAngles({
    frame_no: "WOSURGL50-115858",
    part_intent: "engine",
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

test("2026-07-21 Evidence replay exposes closing angles without repeat trigger", async () => {
  const { uncoveredClosingAngles, detectPossibleRepeat } = await load();
  const rows = JSON.parse(fs.readFileSync(
    new URL("./fixtures/apsales-5w2h-real-replay-2026-07-21.json", import.meta.url),
    "utf8",
  ));
  for (const row of rows) {
    assert.equal(detectPossibleRepeat(row.recent_agent_replies).possible_repeat_detected, false, row.evidence_id);
    const angles = uncoveredClosingAngles(row.deal_state);
    for (const expected of row.expected_uncovered) {
      assert.ok(angles.includes(expected), `${row.evidence_id}: ${expected}`);
    }
    for (const covered of row.expected_covered) {
      assert.ok(!angles.includes(covered), `${row.evidence_id}: ${covered}`);
    }
  }
});

test("exit signal remains ineligible for a soft-angle prompt", async () => {
  const { isSoftAngleExitSignal } = await load();
  assert.equal(isSoftAngleExitSignal("Maybe later, I am busy now"), true);
  assert.equal(isSoftAngleExitSignal("稍后再说"), true);
  assert.equal(isSoftAngleExitSignal("Let's talk later"), true);
  assert.equal(isSoftAngleExitSignal("Wait, not now"), true);
  assert.equal(
    isSoftAngleExitSignal("Even wit that I needed a reduction because it's business am doing, but you later came up with night pricd"),
    false,
  );
  assert.equal(isSoftAngleExitSignal("How long is the wait time for shipping"), false);
  assert.equal(isSoftAngleExitSignal("Please quote for two engines"), false);
});

test("stampChatAngle / normalizeChatAngleUsed", async () => {
  const { stampChatAngle, normalizeChatAngleUsed } = await load();
  assert.equal(normalizeChatAngleUsed("how_much"), "how_much");
  assert.equal(normalizeChatAngleUsed("none"), "");
  const patch = stampChatAngle({}, "where", "2026-07-17T03:00:00.000Z", { dryRun: true });
  assert.equal(patch.last_chat_angle, "where");
  assert.equal(patch.last_chat_angle_dry_run, true);
});
