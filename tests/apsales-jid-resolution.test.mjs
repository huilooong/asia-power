import assert from "node:assert/strict";
import test from "node:test";

import { resolveObservedPhoneE164 } from "../deploy/apsales-live-draft/apsales-jid-resolution.mjs";

test("keeps direct phone JIDs on the synchronous path", async () => {
  let asyncCalls = 0;
  const result = await resolveObservedPhoneE164({
    fromJid: "233000000001@s.whatsapp.net",
    authDir: "/redacted/auth",
    lidLookup: {},
    jidToE164: () => "+233000000001",
    resolveJidToE164: async () => {
      asyncCalls += 1;
      return "+233000000099";
    },
  });

  assert.equal(result, "+233000000001");
  assert.equal(asyncCalls, 0);
});

test("resolves an anonymized LID through the live mapping", async () => {
  const lidLookup = { marker: "live-lid-mapping" };
  const result = await resolveObservedPhoneE164({
    fromJid: "100000000000001@lid",
    authDir: "/redacted/auth",
    lidLookup,
    jidToE164: () => null,
    resolveJidToE164: async (jid, options) => {
      assert.equal(jid, "100000000000001@lid");
      assert.equal(options.lidLookup, lidLookup);
      return "+233000000002";
    },
  });

  assert.equal(result, "+233000000002");
});

test("fails closed when a LID cannot be resolved", async () => {
  const result = await resolveObservedPhoneE164({
    fromJid: "100000000000002@lid",
    authDir: "/redacted/auth",
    lidLookup: {},
    jidToE164: () => null,
    resolveJidToE164: async () => {
      throw new Error("lookup unavailable");
    },
  });

  assert.equal(result, null);
});

test("does not reinterpret group JIDs as customer phone numbers", async () => {
  let asyncCalls = 0;
  const result = await resolveObservedPhoneE164({
    fromJid: "100000000000003@g.us",
    authDir: "/redacted/auth",
    lidLookup: {},
    jidToE164: () => null,
    resolveJidToE164: async () => {
      asyncCalls += 1;
      return "+233000000003";
    },
  });

  assert.equal(result, null);
  assert.equal(asyncCalls, 0);
});
