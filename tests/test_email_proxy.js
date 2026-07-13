"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createEmailProxyStore, redactContacts } = require("../server/lib/email-proxy.js");

test("redactContacts strips email and whatsapp", () => {
  const text = "Call me +233201234567 or email buyer@test.com on WhatsApp +86 166 3880 1930";
  const out = redactContacts(text);
  assert.match(out, /\[contact redacted\]/);
  assert.doesNotMatch(out, /buyer@test\.com/);
});

test("ingestInbound creates thread and inbox file", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "email-proxy-"));
  const store = createEmailProxyStore({
    root: tmp,
    dataDir: path.join(tmp, "data"),
    secret: "test-secret",
  });
  const result = await store.ingestInbound({
    from: "buyer@example.com",
    to: "inquiry@asia-power.com",
    subject: "G4KJ quote",
    text: "Need 2 units. WhatsApp +233201234567",
  });
  assert.ok(result.thread.threadId.startsWith("em-"));
  assert.ok(result.thread.proxyReplyTo.includes("@"));
  assert.match(result.message.textRedacted, /\[contact redacted\]/);
  assert.ok(fs.existsSync(result.inboxPath));
  const health = store.health();
  assert.equal(health.total, 1);
  assert.equal(health.pendingApsales, 1);
});
