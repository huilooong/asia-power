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

test("parseAgentReply: refuse messages still throw openclaw_reply_not_json with rawText", async () => {
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

test("parseAgentReply: plain customer-facing text is recovered (2555 case)", async () => {
  const { parseAgentReply } = await load();
  const out = parseAgentReply(
    "We source from China, so the engine will be imported which takes about 45-60 days by sea cargo.",
  );
  assert.equal(out.plainTextRecovered, true);
  assert.match(out.reply, /45-60 days/i);
  assert.equal(out.needsPriceConfirmation, false);
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
  assert.match(reply, /on file|TOYOTA|RAV4|2AZ-FE/i);
  assert.ok(!/what VIN or model/i.test(reply));
  assert.ok(!/share the VIN/i.test(reply));
  assert.ok(!/what do you need next/i.test(reply));
});

test("buildExceptionFallback: no dealState keeps stock/VIN ask", async () => {
  const { buildExceptionFallback } = await load();
  const reply = buildExceptionFallback("hello", null, null);
  assert.match(reply, /asia-power\.com/i);
  assert.match(reply, /VIN or model/i);
});

test("buildExceptionFallback: answers How much from team_replies (2555)", async () => {
  const { buildExceptionFallback } = await load();
  const reply = buildExceptionFallback("How much", null, {
    brand: "AUDI",
    model: "A4",
    year: "2005",
    part_intent: "engine",
    vin: "WAUZZZ8E25A123456",
    confirmation_status: "team_quoted",
    team_confirmed_at: "2026-07-22T09:02:00Z",
    team_replies: [{ text: "750usd", at: "2026-07-22T09:02:00Z" }],
  });
  assert.match(reply, /750/i);
  assert.ok(!/what do you need next/i.test(reply));
});

test("buildExceptionFallback: answers import/Ghana without carousel", async () => {
  const { buildExceptionFallback } = await load();
  const reply = buildExceptionFallback(
    "Is it in Ghana or it will now be imported",
    null,
    {
      brand: "AUDI",
      model: "A4",
      year: "2005",
      part_intent: "engine",
      quantity: "Just one",
      team_replies: [{ text: "Need to import from China", at: "2026-07-22T09:41:37Z" }],
    },
  );
  assert.match(reply, /China|45/i);
  assert.ok(!/what do you need next/i.test(reply));
  assert.ok(!/Continuing the engine deal/i.test(reply));
});
