import test from "node:test";
import assert from "node:assert/strict";

import {
  isPureQualificationQuestion,
  priceConfirmationGate,
} from "../deploy/apsales-live-draft/apsales-price-confirmation-gate.mjs";
import { routePriceConfirmationHandoff } from "../deploy/apsales-live-draft/ghana-staff-handoff.mjs";

const missingPrice = {
  requestedFacts: ["price"],
  evidence: {
    hasInventoryMatch: false,
    hasConfirmedQuote: false,
    hasConfirmedDelivery: false,
  },
};

function gate(replyText, modelNeedsPriceConfirmation = false) {
  return priceConfirmationGate({
    preGenerationContext: missingPrice,
    modelNeedsPriceConfirmation,
    replyText,
  });
}

test("price request without evidence: VIN question is released even when model flag is true", () => {
  const out = gate("Please send the VIN, year, and engine code so I can check the correct option.", true);
  assert.equal(out.hold, false);
  assert.equal(out.reason, "qualification_question");
  assert.equal(out.asksForQualification, true);
});

test("qualification detection covers Chinese and conversational French", () => {
  assert.equal(isPureQualificationQuestion("请发一下车架号、年份和发动机代码？"), true);
  assert.equal(isPureQualificationQuestion("Pouvez-vous envoyer le numéro de châssis et l'année ?"), true);
});

test("specific price assertion without evidence is held and routed to Ghana", () => {
  const out = gate("The price is 900 USD and delivery takes 7 days.");
  assert.equal(out.hold, true);
  assert.match(out.reason, /^missing_private_business_evidence:/);
  assert.equal(out.replyHasForbiddenCommitment, true);
  assert.equal(routePriceConfirmationHandoff(out), "ghana_staff");
});

test("empty team-confirmation deferral remains held and routed to Ghana", () => {
  const out = gate("Our team is checking the price and will get back to you.", true);
  assert.equal(out.hold, true);
  assert.equal(out.replyIsEmptyDeferral, true);
  assert.match(out.reason, /^missing_private_business_evidence:/);
  assert.equal(routePriceConfirmationHandoff(out), "ghana_staff");
});

test("model-only hold with no private-business request stays on CEO route", () => {
  const out = priceConfirmationGate({
    preGenerationContext: { requestedFacts: [], evidence: {} },
    modelNeedsPriceConfirmation: true,
    replyText: "I need a team member to review this unusual case.",
  });
  assert.equal(out.hold, true);
  assert.equal(out.reason, "model_needs_price_confirmation");
  assert.equal(routePriceConfirmationHandoff(out), "ceo");
});

test("question containing the word quote is still released when it only asks for VIN", () => {
  const out = gate("Please send the VIN so I can quote the correct engine.");
  assert.equal(out.hold, false);
  assert.equal(out.asksForQualification, true);
});
