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

function noEvidenceContext(buildPrivateBusinessFactContext) {
  return buildPrivateBusinessFactContext({ dealState: {}, inventoryMatches: [] });
}

test("historical corpus records the audited legacy reply-regex baseline", async () => {
  const cases = await loadHistory();
  assert.equal(cases.length, 17, "16 independent cases plus the 16b repeated customer turn");
  const legacyCaughtCases = new Set(cases.filter((c) => c.legacy_reply_regex === "CAUGHT").map((c) => c.case_id));
  assert.equal(legacyCaughtCases.size, 8, "audited legacy reply regex result: 8/16 cases");
  console.log("historical replay baseline: legacy reply-regex 8/16 independent cases caught (17 messages retained as provenance)");
});

test("Step 0: unsupported concrete price assertion is held", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: noEvidenceContext(buildPrivateBusinessFactContext),
    replyText: "The price is 900 USD.",
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, true);
  assert.deepEqual(result.assertedFacts, ["price"]);
});

test("Step 0: unsupported concrete inventory and delivery assertions are held", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  for (const replyText of ["It is in stock.", "Delivery will arrive in 45 days."]) {
    assert.equal(priceConfirmationGate({
      preGenerationContext: noEvidenceContext(buildPrivateBusinessFactContext),
      replyText,
      modelNeedsPriceConfirmation: false,
    }).hold, true, replyText);
  }
});

test("Step 0: matching Layer 2 inventory evidence permits a concrete price", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      dealState: {},
      inventoryMatches: [{ stock_id: "HC1", price_usd: 900 }],
    }),
    replyText: "The price is 900 USD.",
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, false);
});

test("Step 0: unverified VIN technical inference is default-allowed", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      dealState: { vin: "WMMZC5C54DWP33784", provider_verification_status: "unverified" },
      inventoryMatches: [],
    }),
    replyText: "The VIN structure suggests the third character may be W; please confirm the VIN plate.",
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, false);
  assert.deepEqual(result.assertedFacts, []);
});

test("Step 0: unrelated transport reasoning is also default-allowed", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: noEvidenceContext(buildPrivateBusinessFactContext),
    replyText: "For this China-to-Ghana route, sea freight is generally the practical transport method; tell me your destination port.",
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, false);
  assert.deepEqual(result.assertedFacts, []);
});

test("Step 0: model metadata is retained but cannot widen the hard blacklist", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: noEvidenceContext(buildPrivateBusinessFactContext),
    replyText: "Please send the VIN plate so I can check the engine code.",
    modelNeedsPriceConfirmation: true,
  });
  assert.equal(result.hold, false);
  assert.equal(result.modelNeedsPriceConfirmation, true);
});
