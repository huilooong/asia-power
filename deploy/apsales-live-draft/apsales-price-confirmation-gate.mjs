/**
 * APSALES-COACH-FIX-001 / Step 0
 *
 * Layer 2 evidence is prepared before generation. The post-generation gate
 * has a deliberately small blacklist: only an asserted price, inventory state,
 * or delivery-time commitment needs that evidence. Everything else is allowed
 * by default. This is not a technical-fact whitelist.
 */

const ASSERTED_PRIVATE_FACT = Object.freeze({
  // A number with an explicit currency, or a bare number directly tied to a
  // price term. This catches the redline, not a customer asking for a price.
  price: /(?:[$€£¥]\s*\d{1,9}(?:[,.]\d{1,2})?|\b\d{1,9}(?:[,.]\d{1,2})?\s*(?:USD|GHS|CNY|RMB|EUR|GBP|XOF|CFA)\b|\b(?:price|prix|pre[cç]o|precio|价格|报价|سعر)\b.{0,18}\b\d{1,9}\b)/iu,
  // Specific availability states (positive or negative), not "we will check".
  inventory: /\b(?:in\s+stock|out\s+of\s+stock|available|unavailable|we\s+(?:have|do\s+not\s+have)|sold\s+out)\b|\b(?:en\s+stock|disponible|indisponible|rupture\s+de\s+stock)\b|\b(?:em\s+estoque|sem\s+estoque)\b|库存(?:有|无)|有货|没货|无货|现货|缺货|متوفر|غير\s+متوفر|نفد\s+المخزون/iu,
  // A concrete delivery date or duration commitment, not general route advice.
  delivery: /\b(?:arrive|arrival|delivery|deliver|ship(?:ped|ping)?|eta|livraison|arriv[eé]e|entrega|env[ií]o|到货|交期|送达|الوصول|توصيل)\b.{0,28}\b(?:\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,3}\s*(?:business\s+)?days?|\d{1,2}\s*weeks?)\b|(?:\d{1,3}\s*(?:天|周)|\d{1,3}\s*(?:يوم|أيام|أسبوع))/iu,
});

export function detectAssertedPrivateBusinessFacts(replyText) {
  const text = String(replyText || "");
  return Object.entries(ASSERTED_PRIVATE_FACT)
    .filter(([, pattern]) => pattern.test(text))
    .map(([fact]) => fact);
}

export function buildPrivateBusinessEvidence({ inventoryMatches, dealState = {} }) {
  const hasInventoryMatch = Array.isArray(inventoryMatches) && inventoryMatches.length > 0;
  const hasConfirmedQuote =
    String(dealState.confirmation_status || "") === "team_quoted" &&
    Boolean(dealState.team_confirmed_at);
  const hasConfirmedDelivery = Boolean(
    dealState.delivery_quote_confirmed_at ||
    dealState.shipping_quote_confirmed_at ||
    dealState.logistics_quote_confirmed_at,
  );
  return { hasInventoryMatch, hasConfirmedQuote, hasConfirmedDelivery };
}

/** Build this before model generation; it contains no model output. */
export function buildPrivateBusinessFactContext({ dealState, inventoryMatches }) {
  return {
    evidence: buildPrivateBusinessEvidence({ inventoryMatches, dealState }),
  };
}

/**
 * Determine the pre-send hold from pre-generation structured facts only.
 * `modelNeedsPriceConfirmation` remains a second, independent signal.
 */
export function priceConfirmationGate({
  preGenerationContext,
  replyText,
  modelNeedsPriceConfirmation,
}) {
  const assertedFacts = detectAssertedPrivateBusinessFacts(replyText);
  if (!assertedFacts.length) {
    return { hold: false, reason: "", assertedFacts, modelNeedsPriceConfirmation: Boolean(modelNeedsPriceConfirmation) };
  }

  const evidence = preGenerationContext?.evidence || {};
  const missingEvidence = assertedFacts.filter((fact) => {
    if (fact === "delivery") return !evidence.hasConfirmedDelivery;
    // Exact inventory match or a human-confirmed quote is real evidence for
    // price/availability. A model inference is never evidence here.
    return !(evidence.hasInventoryMatch || evidence.hasConfirmedQuote);
  });
  if (missingEvidence.length) {
    return {
      hold: true,
      reason: `missing_private_business_evidence:${missingEvidence.join(",")}`,
      assertedFacts,
      modelNeedsPriceConfirmation: Boolean(modelNeedsPriceConfirmation),
    };
  }
  return { hold: false, reason: "", assertedFacts, modelNeedsPriceConfirmation: Boolean(modelNeedsPriceConfirmation) };
}
