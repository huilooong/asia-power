import test from "node:test";
import assert from "node:assert/strict";
import { routePriceConfirmationHandoff } from "../deploy/apsales-live-draft/ghana-staff-handoff.mjs";

test("routine unsupported price or inventory requests route to Ghana staff", () => {
  assert.equal(routePriceConfirmationHandoff({ reason: "missing_private_business_evidence:price", requestedFacts: ["price"] }), "ghana_staff");
  assert.equal(routePriceConfirmationHandoff({ reason: "missing_private_business_evidence:inventory", requestedFacts: ["inventory"] }), "ghana_staff");
});

test("model-only or unfamiliar holds remain CEO escalations", () => {
  assert.equal(routePriceConfirmationHandoff({ reason: "model_needs_price_confirmation", requestedFacts: [] }), "ceo");
  assert.equal(routePriceConfirmationHandoff({ reason: "missing_private_business_evidence:delivery", requestedFacts: ["delivery"] }), "ceo");
});
