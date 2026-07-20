import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadGate() {
  return import(pathToFileURL(path.resolve(
    __dirname,
    "../deploy/apsales-live-draft/apsales-price-confirmation-gate.mjs",
  )).href);
}

async function loadHistory() {
  return JSON.parse(await fs.readFile(path.join(
    __dirname,
    "fixtures/apsales-coach-fix-001-price-gate-history.json",
  ), "utf8"));
}

function context(buildPrivateBusinessFactContext, customerMessage, dealState = {}, inventoryMatches = []) {
  return buildPrivateBusinessFactContext({ customerMessage, dealState, inventoryMatches });
}

test("historical corpus records the audited legacy reply-regex baseline", async () => {
  const cases = await loadHistory();
  assert.equal(cases.length, 17, "16 independent cases plus the 16b repeated customer turn");
  const legacyCaughtCases = new Set(cases.filter((c) => c.legacy_reply_regex === "CAUGHT").map((c) => c.case_id));
  assert.equal(legacyCaughtCases.size, 8, "audited legacy reply regex result: 8/16 cases");
  console.log("historical replay baseline: legacy reply-regex 8/16 independent cases caught (17 messages retained as provenance)");
});

test("Step 0: all real price-handoff cases are held from request plus evidence", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const cases = await loadHistory();
  for (const sample of cases) {
    const result = priceConfirmationGate({
      preGenerationContext: context(
        buildPrivateBusinessFactContext,
        sample.customer_message,
        sample.deal_state,
      ),
      modelNeedsPriceConfirmation: false,
    });
    assert.equal(result.hold, true, `${sample.evidence_id} should hold; got ${result.reason}`);
  }
  console.log("historical replay: legacy reply-regex 8/16 independent cases; request-and-evidence gate 16/16 cases, 17/17 messages held");
});

test("Step 0: model confirmation flag independently holds a non-numeric reply", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const preGenerationContext = context(
    buildPrivateBusinessFactContext,
    "Please read the VIN plate in this photo.",
    { vin: "WMMZC5C54DWP33784", provider_verification_status: "unverified" },
  );
  const withoutModelFlag = priceConfirmationGate({
    preGenerationContext,
    // This non-numeric waiting reply is deliberately not an input to the
    // request-and-evidence gate. The model flag must decide independently.
    replyText: "I will ask the team and come back to you.",
    modelNeedsPriceConfirmation: false,
  });
  const result = priceConfirmationGate({
    preGenerationContext,
    replyText: "I will ask the team and come back to you.",
    modelNeedsPriceConfirmation: true,
  });
  assert.equal(withoutModelFlag.hold, false);
  assert.equal(result.hold, true);
  assert.equal(result.reason, "model_needs_price_confirmation");
});

test("Step 0: real Layer 2 inventory evidence permits a price request", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: context(
      buildPrivateBusinessFactContext,
      "How much is this engine?",
      {},
      [{ stock_id: "HC1", price_usd: 900 }],
    ),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, false);
});

test("Step 0: unverified VIN technical inference is default-allowed", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: context(
      buildPrivateBusinessFactContext,
      "Please identify the engine from this VIN photo.",
      { vin: "WMMZC5C54DWP33784", provider_verification_status: "unverified" },
    ),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, false);
  assert.deepEqual(result.requestedFacts, []);
});

test("Step 0: unrelated transport reasoning is also default-allowed", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: context(
      buildPrivateBusinessFactContext,
      "Why is sea transport commonly used between China and Ghana?",
    ),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, false);
  assert.deepEqual(result.requestedFacts, []);
});
