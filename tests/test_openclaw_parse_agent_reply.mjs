import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  const mod = path.resolve(__dirname, "../deploy/apsales-live-draft/apsales-parse-agent-reply.mjs");
  return import(pathToFileURL(mod).href);
}

test("parseAgentReply: pure JSON happy path", async () => {
  const { parseAgentReply } = await load();
  const out = parseAgentReply(
    '{"customer_reply":"Got it, Chief.","needs_price_confirmation":false}',
  );
  assert.equal(out.reply, "Got it, Chief.");
  assert.equal(out.needsPriceConfirmation, false);
  assert.equal(out.supportLineUnreachable, false);
});

test("parseAgentReply: support_line_unreachable true", async () => {
  const { parseAgentReply } = await load();
  const out = parseAgentReply(
    JSON.stringify({
      customer_reply:
        "Sorry about that — our team will reach out to you here on WhatsApp instead.",
      needs_price_confirmation: false,
      support_line_unreachable: true,
    }),
  );
  assert.equal(out.supportLineUnreachable, true);
  assert.equal(out.buyingIntentConfirmed, false);
  assert.ok(!/checked|verified|confirmed that/i.test(out.reply));
});

test("parseAgentReply: buying_intent_confirmed true", async () => {
  const { parseAgentReply } = await load();
  const out = parseAgentReply(
    JSON.stringify({
      customer_reply: "Great — I'll arrange pickup with our Ghana team.",
      needs_price_confirmation: false,
      support_line_unreachable: false,
      buying_intent_confirmed: true,
    }),
  );
  assert.equal(out.buyingIntentConfirmed, true);
  assert.equal(out.quoteDeclineReasonCaptured, "");
});

test("parseAgentReply: quote_decline_reason_captured string", async () => {
  const { parseAgentReply } = await load();
  const withReason = parseAgentReply(
    JSON.stringify({
      customer_reply: "Got it — thanks for sharing.",
      needs_price_confirmation: false,
      quote_decline_reason_captured: "price too high",
    }),
  );
  assert.equal(withReason.quoteDeclineReasonCaptured, "price too high");
  const empty = parseAgentReply(
    JSON.stringify({
      customer_reply: "Ok.",
      needs_price_confirmation: false,
      quote_decline_reason_captured: "",
    }),
  );
  assert.equal(empty.quoteDeclineReasonCaptured, "");
});

test("parseAgentReply: chat_angle_used", async () => {
  const { parseAgentReply } = await load();
  const out = parseAgentReply(
    JSON.stringify({
      customer_reply: "Still waiting on the team price — which port will you use?",
      needs_price_confirmation: true,
      chat_angle_used: "where",
    }),
  );
  assert.equal(out.chatAngleUsed, "where");
});

test("parseAgentReply: ```json fence happy path", async () => {
  const { parseAgentReply } = await load();
  const out = parseAgentReply(`\`\`\`json
{"customer_reply":"Yes — Accra pickup works.","needs_price_confirmation":false}
\`\`\``);
  assert.equal(out.reply, "Yes — Accra pickup works.");
});

test("parseAgentReply: prose before/after still extracts JSON (CEO 2026-07-15 case shape)", async () => {
  const { parseAgentReply } = await load();
  // Desensitized shape of openclaw_reply_not_json failures: model adds wrapper text.
  const sample = `Here's the reply:

\`\`\`json
{"customer_reply":"No, Chief. We already have your VIN. Your mechanic needs to confirm the gearbox pins.","needs_price_confirmation":false}
\`\`\`

Hope that helps.`;
  const out = parseAgentReply(sample);
  assert.match(out.reply, /already have your VIN/i);
});

test("parseAgentReply: bare object buried in prose", async () => {
  const { parseAgentReply } = await load();
  const sample =
    'Sure.\n{"customer_reply":"The 1280 covers engine and gearbox.","needs_price_confirmation":false}\nThanks.';
  const out = parseAgentReply(sample);
  assert.match(out.reply, /1280 covers engine/i);
});

test("parseAgentReply: no JSON still throws openclaw_reply_not_json with rawText", async () => {
  const { parseAgentReply } = await load();
  let caught;
  try {
    parseAgentReply("Sorry I cannot format that as JSON right now.");
  } catch (err) {
    caught = err;
  }
  assert.ok(caught);
  assert.equal(caught.message, "openclaw_reply_not_json");
  assert.match(String(caught.rawText || ""), /cannot format that as JSON/i);
});

test("parseAgentReply: empty customer_reply → openclaw_reply_invalid", async () => {
  const { parseAgentReply } = await load();
  assert.throws(
    () => parseAgentReply('{"customer_reply":"","needs_price_confirmation":false}'),
    (err) => err.message === "openclaw_reply_invalid",
  );
});

test("buildExceptionFallback: dealState.vin never re-asks VIN (CEO +233543709670)", async () => {
  const { buildExceptionFallback } = await load();
  const reply = buildExceptionFallback("ok chief", null, {
    vin: "JTMBD31V586098976",
    brand: "TOYOTA",
    model: "RAV4",
    engine_code: "2AZ-FE",
    part_intent: "gearbox",
  });
  assert.match(reply, /already have/i);
  assert.match(reply, /TOYOTA|2AZ-FE|gearbox/i);
  assert.ok(!/what VIN or model/i.test(reply));
  assert.ok(!/share the VIN/i.test(reply));
});

test("buildExceptionFallback: no dealState keeps stock/VIN ask", async () => {
  const { buildExceptionFallback } = await load();
  const reply = buildExceptionFallback("hello", null, null);
  assert.match(reply, /asia-power\.com/i);
  assert.match(reply, /VIN or model/i);
});
