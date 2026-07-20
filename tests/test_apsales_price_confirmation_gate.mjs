import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function load() {
  return import(pathToFileURL(path.resolve(
    __dirname,
    "../deploy/apsales-live-draft/apsales-price-confirmation-gate.mjs",
  )).href);
}

test("Step 0: holds a team price promise when the model omitted its flag", async () => {
  const { priceConfirmationGate } = await load();
  assert.deepEqual(
    priceConfirmationGate({
      replyText: "I will check the price with our team and reply shortly.",
      modelNeedsPriceConfirmation: false,
    }),
    { hold: true, reason: "reply_promises_private_price_or_stock_confirmation" },
  );
});

test("Step 0: holds supplier-stock confirmation when the model omitted its flag", async () => {
  const { priceConfirmationGate } = await load();
  assert.equal(
    priceConfirmationGate({
      replyText: "Our supplier will confirm stock availability for this unit.",
      modelNeedsPriceConfirmation: false,
    }).hold,
    true,
  );
});

test("Step 0: preserves the explicit model flag as a second independent signal", async () => {
  const { priceConfirmationGate } = await load();
  assert.deepEqual(
    priceConfirmationGate({ replyText: "Please send the VIN.", modelNeedsPriceConfirmation: true }),
    { hold: true, reason: "model_needs_price_confirmation" },
  );
});

test("Step 0: does not hold a normal vehicle-qualification question", async () => {
  const { priceConfirmationGate } = await load();
  assert.deepEqual(
    priceConfirmationGate({
      replyText: "Please send the VIN or model year and engine code so I can match the right unit.",
      modelNeedsPriceConfirmation: false,
    }),
    { hold: false, reason: "" },
  );
});
