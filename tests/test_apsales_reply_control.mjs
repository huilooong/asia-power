import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readReplyControl, assertReplyAllowed } from "../deploy/apsales-live-draft/apsales-reply-control.mjs";
import { createHumanTakeover, trackedTransport } from "../deploy/apsales-live-draft/apsales-human-takeover.mjs";
import { turnPolicy, routedReply } from "../deploy/apsales-live-draft/apsales-turn-policy.mjs";

const customer = "+233555000111";
function sandbox(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-control-")); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
function change(root, action, target = customer) {
  const code = "import sys; from pathlib import Path; from customer_gateway.ai_reply_control import change_state; change_state(Path(sys.argv[1]),sys.argv[2],sys.argv[3],'test')";
  const result = spawnSync("python3", ["-c", code, root, action, target], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

test("Python control is enforced by Node: scope, restart and stale generation", (t) => {
  const root = sandbox(t);
  const ticket = readReplyControl(root, customer);
  const started = new Date().toISOString();
  change(root, "pause");
  assert.throws(() => assertReplyAllowed(root, customer, ticket, started), { code: "AI_REPLY_PAUSED" });
  assert.doesNotThrow(() => assertReplyAllowed(root, "+233555000222", null, started));
  change(root, "resume");
  assert.equal(readReplyControl(root, customer).paused, false);
  assert.throws(() => assertReplyAllowed(root, customer, ticket, started), { code: "AI_REPLY_PAUSED" });
  assert.throws(() => assertReplyAllowed(root, customer, null, started), { code: "AI_REPLY_PAUSED" });
  const fresh = new Date(Date.now() + 1000).toISOString();
  assert.doesNotThrow(() => assertReplyAllowed(root, customer, null, fresh));
  change(root, "pause", "all");
  assert.throws(() => assertReplyAllowed(root, "+233555000222", null, fresh), { code: "AI_REPLY_PAUSED" });
});

test("corrupt control fails closed", (t) => {
  const root = sandbox(t); change(root, "pause");
  fs.writeFileSync(path.join(root, "memory/customer_gateway/ai_reply_control.json"), "broken");
  assert.throws(() => assertReplyAllowed(root, customer, null, new Date().toISOString()), { code: "AI_REPLY_PAUSED" });
});

test("exact bot ids ignore echoes; same-text human and media pause immediately, including after restart", async (t) => {
  const root = sandbox(t);
  let pauses = 0;
  const create = () => createHumanTakeover({ workspace: root, pause: () => { pauses++; } });
  let takeover = create();
  const message = { fromMe: true, fromPhoneE164: customer, kind: "text", text: "Okay.", sentAtMs: Date.now() };
  const sock = trackedTransport({ sendMessage: async (jid, body, options) => {
    assert.equal(takeover.observe({ ...message, messageId: options.messageId }), false);
    return options.messageId;
  } }, { noteBotMessage: (id) => takeover.noteBotMessage(id) });
  const id = await sock.sendMessage("test", { text: "Okay." });
  takeover = create();
  assert.equal(takeover.observe({ ...message, messageId: id }), false);
  assert.equal(takeover.observe({ ...message, messageId: "human-same-text" }), true);
  assert.equal(takeover.observe({ ...message, kind: "media", messageId: "human-voice" }), true);
  assert.equal(pauses, 2);
  assert.equal(takeover.observe({ ...message, fromMe: false, messageId: "customer-command" }), false);
  assert.equal(takeover.observe({ ...message, sentAtMs: Date.now() - 3600000, messageId: "old" }), false);
});

test("final transport check blocks send even after async preparation", async (t) => {
  const root = sandbox(t); const ticket = readReplyControl(root, customer); const started = new Date().toISOString();
  let sends = 0;
  const sock = trackedTransport({ sendMessage: async () => { sends++; } }, { beforeSend: () => assertReplyAllowed(root, customer, ticket, started) });
  await Promise.resolve(); change(root, "pause");
  assert.throws(() => sock.sendMessage("test", { text: "pending answer" }), { code: "AI_REPLY_PAUSED" });
  assert.equal(sends, 0);
});

test("manual takeover persistence failure keeps customer blocked in process", (t) => {
  const root = sandbox(t);
  const takeover = createHumanTakeover({ workspace: root, pause: () => { throw Error("disk failure"); } });
  takeover.observe({ fromMe: true, fromPhoneE164: customer, kind: "media", sentAtMs: Date.now(), messageId: "h1" });
  assert.equal(takeover.failures.has(customer), true);
  assert.throws(() => readReplyControl(root, customer), { code: "AI_REPLY_PAUSED" });
  change(root, "resume");
  assert.equal(readReplyControl(root, customer).paused, false);
});

test("delayed human device sync since activation still pauses; historical messages do not", (t) => {
  const root = sandbox(t); let now = 1000000000000; let pauses = 0;
  const takeover = createHumanTakeover({ workspace: root, now: () => now, pause: () => pauses++ });
  now += 3600000;
  assert.equal(takeover.observe({ fromMe: true, fromPhoneE164: customer, kind: "text", sentAtMs: now - 600000, messageId: "delayed-human" }), true);
  assert.equal(pauses, 1);
});

test("real failures and alternate wording use current intent, not old gearbox state", () => {
  assert.equal(turnPolicy("acknowledgement", { last_outbound_cue: "offer_price_go_ahead" }).route, "model");
  assert.equal(turnPolicy("product_enquiry", { support_review_pending: true }).route, "model");
  const cases = [
    ["Type the closet landmark", "location"], ["The direction link", "location"],
    ["V2 Plaza | Tema, Greater Accra Region, GH", "location"], ["Where is your shop?", "location"],
    ["He said the engine you gave us is 2x2 but the car engine is 4x4", "after_sales"],
    ["The mechanic is saying there's a shaft attached to the gearbox", "after_sales"],
    ["You sent us the wrong part", "after_sales"], ["售后发动机装不上", "after_sales"],
    ["Okay", "acknowledgement"], ["Let me ask him and see", "acknowledgement"], ["Will get back pls", "acknowledgement"],
    ["Can I call you?", "contact"], ["Transmission oil", "fluid_enquiry"],
    ["Just letting you know what your child did at school today.", "non_business"],
    ["Need engine", "product_enquiry"], ["Best price?", "quotation"],
  ];
  const result = spawnSync("python3", ["-c", "import json,sys; from sales_coach.detectors import classify_customer_intent; print(json.dumps([classify_customer_intent(x) for x in json.load(sys.stdin)]))"], { input: JSON.stringify(cases.map(x => x[0])), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  cases.forEach(([text, intent], i) => {
    assert.equal(actual[i], intent, text);
    const policy = turnPolicy(actual[i], { part_intent: "gearbox" });
    if (!["product_enquiry", "quotation"].includes(intent)) assert.equal(policy.collectIdentity, false, text);
    if (policy.route !== "model") assert.doesNotMatch(routedReply(policy, false), /VIN|engine code/i, text);
  });
});
