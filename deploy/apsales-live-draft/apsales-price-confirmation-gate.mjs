/**
 * APSALES-COACH-FIX-001 / Step 0 (+ 2026-07-22 P0 hold narrowing)
 *
 * This is a pre-send safety gate, but its inputs are fixed before generation:
 * customer request classification and Layer 2 evidence. It never tries to
 * infer risk from the model's free-form reply text.
 *
 * Blacklist boundary: only private business facts need evidence -- price,
 * inventory/availability, and delivery commitments. All other requests are
 * allowed by default. This is deliberately not a technical-fact whitelist.
 *
 * P0 (2026-07-22): do NOT treat "deal already has part + vehicle" as an
 * implicit inventory request. That over-hold silenced qualify/advance turns
 * (engine-code asks, Ghana/import asks) — see +233202102555.
 */

const PRIVATE_BUSINESS_REQUEST = Object.freeze({
  // Do NOT use bare \brate\b — it false-triggers "exchange rate" / FX chitchat.
  price: /\b(?:how\s*much|price|cost|quote|quotation|pricing|final\s+amount|price\s+rate)\b|\b(?:prix|combien|tarif|co[uû]t|devis)\b|\b(?:pre[cç]o|quanto|cota[cç][aã]o)\b|\b(?:precio|cu[aá]nto|cotizaci[oó]n)\b|价格|多少钱|报价|价钱|费用|سعر|كم\s*(?:سعر|ثمن)?/iu,
  inventory: /\b(?:in\s+stock|available|availability|have\s+it|can\s+you\s+source|stock)\b|\b(?:disponible|disponibilit[eé]|en\s+stock)\b|\b(?:dispon[ií]vel|estoque)\b|\b(?:disponible|existencia)\b|库存|有货|现货|能做|متوفر|مخزون/iu,
  delivery: /\b(?:delivery|deliver|shipping|ship(?:ping)?\s+time|freight|lead\s+time|arrival|arrive|eta|import(?:ed|ing)?|from\s+china|in\s+ghana)\b|\b(?:livraison|livrer|d[eé]lai|exp[eé]dition)\b|\b(?:entrega|envio|prazo)\b|\b(?:entrega|env[ií]o|plazo)\b|交期|多久到|运费|海运|发货|配送|进口|加纳|شحن|توصيل|موعد\s+الوصول/iu,
});

/** Currency / FX small-talk — not an AsiaPower parts price request. */
const FX_OR_CURRENCY_ASK =
  /\b(?:exchange\s+rate|forex|\bfx\b)\b|\b(?:rmb|cny|yuan|usd|dollars?|ghs|cedis?|euros?|gbp|英镑|美元|人民币|塞地)\b(?:[^.!?\n]{0,48})\b(?:to|vs\.?|versus|against|into|兑换|兑|对)\b(?:[^.!?\n]{0,24})\b(?:the\s+)?(?:rmb|cny|yuan|usd|dollars?|ghs|cedis?|euros?|gbp|英镑|美元|人民币|塞地)\b|\b(?:how\s*much|what(?:\s+is|\s+'s)?)\b[^.!?\n]{0,40}\b(?:rmb|cny|yuan)\b[^.!?\n]{0,40}\b(?:dollar|usd|ghs|cedi)\b|人民币.*(?:美元|美金)|汇率|兑换率/iu;

/** Product / fitment cues — keeps "how much for the engine in USD" as a real price ask. */
const PARTS_OR_PRODUCT_CUE =
  /\b(?:engine|gearbox|transmission|half[\s-]?cut|vin|chassis|stock|hc\s*\d|apk|toyota|honda|nissan|mitsubishi|montero|kia|forte|ford|bmw|audi|mazda|suzuki|hyundai|part(?:s)?|battery|turbo)\b|发动机|变速箱|半切|底盘号/iu;

/**
 * True when the customer is asking FX / currency conversion, not part pricing.
 * Example that must not enter the price gate: "How much is the rmb to the dollar".
 */
export function isCurrencyExchangeAsk(customerMessage) {
  const text = String(customerMessage || "").trim();
  if (!text) return false;
  if (PARTS_OR_PRODUCT_CUE.test(text)) return false;
  return FX_OR_CURRENCY_ASK.test(text);
}

/**
 * Classify only requests for facts unique to our business from THIS message.
 * A locked part+vehicle on deal_state is NOT enough to invent an inventory
 * request — that caused silent holds on qualify questions.
 */
export function classifyPrivateBusinessFactRequest(customerMessage, dealState = {}) {
  void dealState;
  const text = String(customerMessage || "");
  const requestedFacts = new Set(
    Object.entries(PRIVATE_BUSINESS_REQUEST)
      .filter(([, pattern]) => pattern.test(text))
      .map(([fact]) => fact),
  );

  // FX / currency chitchat often contains "how much" — strip the false price class.
  if (requestedFacts.has("price") && isCurrencyExchangeAsk(text)) {
    requestedFacts.delete("price");
  }

  return [...requestedFacts];
}

export function buildPrivateBusinessEvidence({ inventoryMatches, dealState = {} }) {
  const hasInventoryMatch = Array.isArray(inventoryMatches) && inventoryMatches.length > 0;
  const hasConfirmedQuote =
    String(dealState.confirmation_status || "") === "team_quoted" &&
    Boolean(dealState.team_confirmed_at);
  const hasConfirmedDelivery = Boolean(
    dealState.delivery_quote_confirmed_at ||
    dealState.shipping_quote_confirmed_at ||
    dealState.logistics_quote_confirmed_at ||
    // Team already answered import/ETA in-thread — treat as delivery evidence.
    (Array.isArray(dealState.team_replies) &&
      dealState.team_replies.some((r) =>
        /\b(?:45\s*[-–]?\s*60|from\s+china|import|sea\s*freight|days)\b/i.test(
          String(r?.text || ""),
        ),
      )),
  );
  return { hasInventoryMatch, hasConfirmedQuote, hasConfirmedDelivery };
}

/** Build this before model generation; it contains no model output. */
export function buildPrivateBusinessFactContext({ customerMessage, dealState, inventoryMatches }) {
  const currencyExchangeAsk = isCurrencyExchangeAsk(customerMessage);
  return {
    requestedFacts: classifyPrivateBusinessFactRequest(customerMessage, dealState),
    evidence: buildPrivateBusinessEvidence({ inventoryMatches, dealState }),
    currencyExchangeAsk,
  };
}

/**
 * Determine the pre-send hold from independent safety signals.
 *
 * The model flag is an unconditional handoff request: it must never be
 * weakened by request classification or evidence — except FX/currency
 * chitchat, which is never a parts-price confirmation case.
 * Separately, a private business request without Layer 2 evidence is held
 * before its reply reaches the customer.
 */
export function priceConfirmationGate({ preGenerationContext, modelNeedsPriceConfirmation }) {
  const requestedFacts = Array.isArray(preGenerationContext?.requestedFacts)
    ? preGenerationContext.requestedFacts
    : [];

  // FX / currency small-talk: never silent-hold (CEO 2026-07-23 C-fix).
  if (preGenerationContext?.currencyExchangeAsk === true) {
    return {
      hold: false,
      reason: "",
      requestedFacts: [],
      modelNeedsPriceConfirmation: false,
    };
  }

  if (modelNeedsPriceConfirmation === true) {
    return {
      hold: true,
      reason: "model_needs_price_confirmation",
      requestedFacts,
      modelNeedsPriceConfirmation: true,
    };
  }

  const evidence = preGenerationContext?.evidence || {};
  const missingEvidence = requestedFacts.filter((fact) => {
    if (fact === "delivery") return !evidence.hasConfirmedDelivery;
    // A verified inventory match or a human-confirmed quote is real evidence
    // for price and availability. Model inference is never evidence here.
    return !(evidence.hasInventoryMatch || evidence.hasConfirmedQuote);
  });
  if (missingEvidence.length) {
    return {
      hold: true,
      reason: `missing_private_business_evidence:${missingEvidence.join(",")}`,
      requestedFacts,
      modelNeedsPriceConfirmation: false,
    };
  }

  return { hold: false, reason: "", requestedFacts, modelNeedsPriceConfirmation: false };
}
