import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  const mod = path.resolve(__dirname, "../deploy/apsales-live-draft/apsales-deal-qualify.mjs");
  return import(pathToFileURL(mod).href);
}

test("A: Mercedes C180 diesel engine → must_qualify true (today's accident)", async () => {
  const { computeMustQualifyBeforePrice } = await load();
  // part_intent comes from partIntentFromText in bridge; here we set it as production would.
  assert.equal(computeMustQualifyBeforePrice({ part_intent: "engine" }), true);
  assert.equal(computeMustQualifyBeforePrice({ part_intent: "engine", vin: "WDB12345678901234" }), false);
  assert.equal(
    computeMustQualifyBeforePrice({ part_intent: "engine", year: "2007", engine_code: "1ND-TV" }),
    false,
  );
  assert.equal(computeMustQualifyBeforePrice({ part_intent: "engine", year: "2007" }), true);
});

test("A: year / engine_code extract from text", async () => {
  const { extractYearFromText, extractEngineCodeFromText, extractVehicleQualifyFromText } =
    await load();
  assert.equal(extractYearFromText("Honda Civic 2007 rétroviseur"), "2007");
  assert.equal(extractEngineCodeFromText("engine code 1ND-TV please"), "1ND-TV");
  assert.equal(extractEngineCodeFromText("2TR-FE motor"), "2TR-FE");
  assert.deepEqual(extractVehicleQualifyFromText("Civic 2007, code 1ZZ-FE"), {
    year: "2007",
    engine_code: "1ZZ-FE",
  });
});

test("C: inspection fee only engine/gearbox", async () => {
  const { computeInspectionFeeApplicable } = await load();
  assert.equal(computeInspectionFeeApplicable({ part_intent: "engine" }), true);
  assert.equal(computeInspectionFeeApplicable({ part_intent: "gearbox" }), true);
  assert.equal(computeInspectionFeeApplicable({ part_intent: "mirror" }), false);
  assert.equal(computeInspectionFeeApplicable({ part_intent: "half_cut" }), false);
  assert.equal(computeInspectionFeeApplicable({}), false);
});

test("D: ask quantity before firm quote; skip when already set or still qualifying", async () => {
  const { computeMustAskQuantityBeforePrice } = await load();
  assert.equal(
    computeMustAskQuantityBeforePrice(
      { part_intent: "engine", vin: "WDB12345678901234" },
      { inventoryMatches: [{ price_usd: 900 }] },
    ),
    true,
  );
  assert.equal(
    computeMustAskQuantityBeforePrice(
      { part_intent: "engine", vin: "WDB12345678901234", quantity: "2 units" },
      { inventoryMatches: [{ price_usd: 900 }] },
    ),
    false,
  );
  // Still must qualify first — do not ask quantity yet.
  assert.equal(
    computeMustAskQuantityBeforePrice({ part_intent: "engine" }, { inventoryMatches: [] }),
    false,
  );
  assert.equal(
    computeMustAskQuantityBeforePrice(
      {
        part_intent: "mirror",
        brand: "Honda",
        model: "Civic",
        year: "2007",
        engine_code: "R18A",
        confirmation_status: "team_quoted",
      },
      {},
    ),
    true,
  );
});
