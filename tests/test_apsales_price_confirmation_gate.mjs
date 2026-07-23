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
  assert.equal(legacyCaughtCases.size, 8, "audited legacy reply-regex result: 8/16 cases");
});

test("P0: explicit price/delivery asks still hold without Layer-2 evidence", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const cases = await loadHistory();
  // Case 7 is a part listing without an explicit price ask — must NOT auto-hold.
  const priceLike = cases.filter((c) => c.case_id !== "7");
  for (const sample of priceLike) {
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
  const case7 = cases.find((c) => c.case_id === "7");
  const case7Result = priceConfirmationGate({
    preGenerationContext: context(
      buildPrivateBusinessFactContext,
      case7.customer_message,
      case7.deal_state,
    ),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(case7Result.hold, false, "part listing without price ask must not silent-hold");
});

test("P0: locked part+vehicle alone does not invent inventory request", async () => {
  const { classifyPrivateBusinessFactRequest, priceConfirmationGate, buildPrivateBusinessFactContext } =
    await loadGate();
  const deal = {
    part_intent: "engine",
    brand: "AUDI",
    model: "A4",
    year: "2005",
    vin: "WAUZZZ8E25A123456",
  };
  assert.deepEqual(classifyPrivateBusinessFactRequest("Yes. This is it.", deal), []);
  assert.deepEqual(
    classifyPrivateBusinessFactRequest("Can you share the engine code still?", deal),
    [],
  );
  const held = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: "Yes. This is it.",
      dealState: deal,
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(held.hold, false);
});

test("P0: How much still holds until team_quoted or inventory match", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const deal = {
    part_intent: "engine",
    brand: "AUDI",
    model: "A4",
    year: "2005",
  };
  const open = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: "How much",
      dealState: deal,
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(open.hold, true);

  const quoted = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: "How much",
      dealState: {
        ...deal,
        confirmation_status: "team_quoted",
        team_confirmed_at: "2026-07-22T09:02:00.816Z",
      },
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(quoted.hold, false);
});

test("P0: import/Ghana ask uses delivery class; team ETA unlocks", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const deal = { part_intent: "engine", brand: "AUDI", model: "A4", year: "2005" };
  const open = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: "Is it in Ghana or it will now be imported",
      dealState: deal,
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(open.hold, true);
  assert.match(open.reason, /delivery/);

  const withTeam = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: "Is it in Ghana or it will now be imported",
      dealState: {
        ...deal,
        team_replies: [{ text: "Need to import from China", at: "2026-07-22T09:41:37Z" }],
      },
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(withTeam.hold, false);
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
    modelNeedsPriceConfirmation: false,
  });
  const result = priceConfirmationGate({
    preGenerationContext,
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

test("Step 0: approximate inventory is not price-confirmation evidence", async () => {
  const { buildPrivateBusinessFactContext, priceConfirmationGate } = await loadGate();
  const result = priceConfirmationGate({
    preGenerationContext: context(buildPrivateBusinessFactContext, "How much is this engine?", {}, []),
    approximateMatches: [{ stock_id: "SIMILAR-1", price_usd: 900 }],
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(result.hold, true);
  assert.match(result.reason, /missing_private_business_evidence/);
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

test("C-fix: FX / currency chitchat must not enter price hold", async () => {
  const {
    classifyPrivateBusinessFactRequest,
    isCurrencyExchangeAsk,
    buildPrivateBusinessFactContext,
    priceConfirmationGate,
  } = await loadGate();

  const fxSamples = [
    "How much is the rmb to the dollar",
    "What's the exchange rate today?",
    "rmb to the dollar please",
    "人民币兑美元多少",
  ];
  for (const msg of fxSamples) {
    assert.equal(isCurrencyExchangeAsk(msg), true, msg);
    assert.deepEqual(classifyPrivateBusinessFactRequest(msg), [], msg);
    const result = priceConfirmationGate({
      preGenerationContext: buildPrivateBusinessFactContext({
        customerMessage: msg,
        dealState: {},
        inventoryMatches: [],
      }),
      modelNeedsPriceConfirmation: false,
    });
    assert.equal(result.hold, false, `${msg} must not silent-hold`);
  }

  // Even if the model wrongly sets needs_price_confirmation on FX, do not hold.
  const fxWithModelFlag = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: "How much is the rmb to the dollar",
      dealState: {},
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: true,
  });
  assert.equal(fxWithModelFlag.hold, false);

  // Real parts pricing in USD must still hold without evidence.
  const partsPrice = "How much is the 2NZ engine in USD?";
  assert.equal(isCurrencyExchangeAsk(partsPrice), false);
  const held = priceConfirmationGate({
    preGenerationContext: buildPrivateBusinessFactContext({
      customerMessage: partsPrice,
      dealState: { part_intent: "engine" },
      inventoryMatches: [],
    }),
    modelNeedsPriceConfirmation: false,
  });
  assert.equal(held.hold, true);
  assert.match(held.reason, /missing_private_business_evidence/);
});
