import test from "node:test";
import assert from "node:assert/strict";

import {
  isStandardAfricaSeaFreightStatement,
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
  assert.equal(isPureQualificationQuestion("我们需要确认具体是哪个品牌或车型，这样才能匹配V8发动机。"), true);
  assert.equal(isPureQualificationQuestion("For a gearbox, I would need your VIN or the year and engine code."), true);
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

const deliveryContext = (customerMessage, requestedFacts = ["delivery"]) => ({
  customerMessage,
  requestedFacts,
  evidence: {
    hasInventoryMatch: false,
    hasConfirmedQuote: false,
    hasConfirmedDelivery: false,
  },
});

test("2026-07-20 real standard sea-freight replies are released", () => {
  const cases = [
    {
      replyText: "We will check stock with the team. Our items ship from China and usually take 45-60 days by sea. What part are you looking for—engine, gearbox, or half-cut?",
      requestedFacts: ["inventory", "delivery"],
    },
    {
      replyText: "Our products ship from China by sea and usually take 45-60 days. To confirm the price and delivery timeframe, please provide your vehicle's year and VIN, or the specific engine code.",
      requestedFacts: ["price", "delivery"],
    },
  ];
  for (const { replyText, requestedFacts } of cases) {
    const out = priceConfirmationGate({
      preGenerationContext: deliveryContext("When can you deliver to Ghana?", requestedFacts),
      modelNeedsPriceConfirmation: true,
      replyText,
    });
    assert.equal(out.hold, false, replyText);
    assert.equal(out.standardDeliveryExempt, true);
    assert.equal(out.reason, "qualification_question");
  }
});

test("2026-07-18 Guangzhou/7-working-day final answer remains held", () => {
  const replyText = "Ready-stock engines: within 7 working days to Guangzhou port after sourcing confirmation.";
  assert.equal(isStandardAfricaSeaFreightStatement(replyText, "Delivery to USA"), false);
  const out = priceConfirmationGate({
    preGenerationContext: deliveryContext("[Email] Verify TikTok MarketingAPI. Destination USA."),
    modelNeedsPriceConfirmation: false,
    replyText,
  });
  assert.equal(out.hold, true);
  assert.match(out.reason, /^missing_private_business_evidence:delivery/);
});

test("45-60 day standard phrase remains held when customer states Dubai", () => {
  const replyText = "Our products ship from China by sea and usually take 45-60 days.";
  const out = priceConfirmationGate({
    preGenerationContext: deliveryContext("Please deliver this engine to Dubai, UAE."),
    modelNeedsPriceConfirmation: false,
    replyText,
  });
  assert.equal(out.hold, true);
  assert.equal(out.standardDeliveryExempt, false);
});

test("standard phrase cannot mask a second 7-working-day SLA", () => {
  const replyText = "China sea freight takes 45-60 days; ready stock reaches Guangzhou port in 7 working days.";
  const out = priceConfirmationGate({
    preGenerationContext: deliveryContext("Deliver to Ghana"),
    modelNeedsPriceConfirmation: false,
    replyText,
  });
  assert.equal(out.hold, true);
  assert.equal(out.standardDeliveryExempt, false);
});
