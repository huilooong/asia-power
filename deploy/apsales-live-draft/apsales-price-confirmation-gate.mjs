/**
 * APSALES-COACH-FIX-001 / Step 0
 *
 * This is a pre-send safety gate, but its inputs are fixed before generation:
 * customer request classification, Layer 2 evidence, and the actual reply.
 *
 * Blacklist boundary: only private business facts need evidence -- price,
 * inventory/availability, and delivery commitments. All other requests are
 * allowed by default. This is deliberately not a technical-fact whitelist.
 */

import { containsForbiddenCustomerCommitment } from "./apsales-reusable-evidence.mjs";

const PRIVATE_BUSINESS_REQUEST = Object.freeze({
  price: /\b(?:how\s*much|price|cost|quote|quotation|pricing|rate|final\s+amount)\b|\b(?:prix|combien|tarif|co[uû]t|devis)\b|\b(?:pre[cç]o|quanto|cota[cç][aã]o)\b|\b(?:precio|cu[aá]nto|cotizaci[oó]n)\b|价格|多少钱|报价|价钱|费用|سعر|كم\s*(?:سعر|ثمن)?/iu,
  inventory: /\b(?:in\s+stock|available|availability|have\s+it|can\s+you\s+source|stock)\b|\b(?:disponible|disponibilit[eé]|en\s+stock)\b|\b(?:dispon[ií]vel|estoque)\b|\b(?:disponible|existencia)\b|库存|有货|现货|能做|متوفر|مخزون/iu,
  delivery: /\b(?:delivery|deliver|shipping|ship(?:ping)?\s+time|freight|lead\s+time|arrival|arrive|eta)\b|\b(?:livraison|livrer|d[eé]lai|exp[eé]dition)\b|\b(?:entrega|envio|prazo)\b|\b(?:entrega|env[ií]o|plazo)\b|交期|多久到|运费|海运|发货|配送|شحن|توصيل|موعد\s+الوصول/iu,
});

/**
 * Classify only requests for facts unique to our business. A specific part and
 * vehicle context is also an implicit availability request; a VIN alone is
 * not. This keeps technical VIN reasoning outside the blacklist.
 */
export function classifyPrivateBusinessFactRequest(customerMessage, dealState = {}) {
  const text = String(customerMessage || "");
  const requestedFacts = new Set(
    Object.entries(PRIVATE_BUSINESS_REQUEST)
      .filter(([, pattern]) => pattern.test(text))
      .map(([fact]) => fact),
  );

  const hasSpecificPart = Boolean(String(dealState.part_intent || "").trim());
  const hasVehicleIdentity = Boolean(
    dealState.vin || dealState.frame_no || dealState.year ||
    (dealState.brand && dealState.model),
  );
  if (hasSpecificPart && hasVehicleIdentity) requestedFacts.add("inventory");

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
    dealState.logistics_quote_confirmed_at,
  );
  return { hasInventoryMatch, hasConfirmedQuote, hasConfirmedDelivery };
}

/** Build this before model generation; it contains no model output. */
export function buildPrivateBusinessFactContext({ customerMessage, dealState, inventoryMatches }) {
  return {
    requestedFacts: classifyPrivateBusinessFactRequest(customerMessage, dealState),
    evidence: buildPrivateBusinessEvidence({ inventoryMatches, dealState }),
  };
}

/**
 * Determine the pre-send hold from independent safety signals.
 *
 * The model flag is an unconditional handoff request: it must never be
 * weakened by request classification or evidence. Separately, a private
 * business request without Layer 2 evidence is held before its reply reaches
 * the customer, whether the model invented a number or merely says to wait.
 */
const QUALIFICATION_REQUEST = /(?:\b(?:vin|chassis|frame\s*(?:no|number)?|year|model|make|brand|engine\s*(?:code|number|size)?|gearbox|transmission|part|photo|picture|quantity|how\s+many)\b|(?:车架号|底盘号|年份|年款|车型|品牌|发动机(?:代码|型号|号码)?|变速箱|零件|配件|照片|图片|数量)|(?:num[eé]ro\s+de\s+ch[aâ]ssis|ann[eé]e|mod[eè]le|marque|code\s+moteur|moteur|bo[iî]te\s+de\s+vitesses|photo|quantit[eé]))/iu;
const QUESTION_CUE = /[?？]|\b(?:please\s+(?:send|share|confirm|tell)|can\s+you|could\s+you|what|which|when|do\s+you\s+have|j['’]ai\s+besoin|veuillez|pouvez[- ]vous|quel(?:le)?|envoyez|confirmez|请(?:发|提供|确认|告诉)|麻烦(?:发|提供|确认)|能否|可以(?:发|提供|确认)|请问)\b/iu;
const EMPTY_DEFERRAL = /(?:\b(?:(?:our|the)\s+)?team\b.{0,45}\b(?:check|confirm|verify|get\s+back|reply|respond)\b|\b(?:check|confirm|verify)\b.{0,45}\bwith\s+(?:(?:our|the)\s+)?team\b|(?:团队|同事).{0,20}(?:核|查|确认|回复|答复|稍后)|(?:核|查|确认).{0,20}(?:团队|同事)|(?:l['’]?[eé]quipe|coll[eè]gue).{0,45}(?:v[eé]rifier|confirmer|r[eé]pondre|revenir))/iu;

export function isPureQualificationQuestion(replyText) {
  const text = String(replyText || "").trim();
  if (!text || !QUALIFICATION_REQUEST.test(text) || !QUESTION_CUE.test(text)) return false;
  // A concrete amount or lead-time is still an assertion even if followed by a question.
  return !/(?:\$\s*\d|\b\d+(?:[.,]\d+)?\s*(?:usd|ghs|rmb|cny|eur|gbp|days?|weeks?)\b|\d+(?:[.,]\d+)?\s*(?:美元|人民币|元|天|周))/iu.test(text);
}

export function priceConfirmationGate({ preGenerationContext, modelNeedsPriceConfirmation, replyText }) {
  const requestedFacts = Array.isArray(preGenerationContext?.requestedFacts)
    ? preGenerationContext.requestedFacts
    : [];

  const asksForQualification = isPureQualificationQuestion(replyText);
  const replyHasForbiddenCommitment = containsForbiddenCustomerCommitment(replyText);
  const replyIsEmptyDeferral = EMPTY_DEFERRAL.test(String(replyText || ""));

  const evidence = preGenerationContext?.evidence || {};
  const missingEvidence = requestedFacts.filter((fact) => {
    if (fact === "delivery") return !evidence.hasConfirmedDelivery;
    // A verified inventory match or a human-confirmed quote is real evidence
    // for price and availability. Model inference is never evidence here.
    return !(evidence.hasInventoryMatch || evidence.hasConfirmedQuote);
  });
  if (missingEvidence.length && (replyHasForbiddenCommitment || replyIsEmptyDeferral) && !asksForQualification) {
    return {
      hold: true,
      reason: `missing_private_business_evidence:${missingEvidence.join(",")}`,
      requestedFacts,
      modelNeedsPriceConfirmation: false,
      asksForQualification,
      replyHasForbiddenCommitment,
      replyIsEmptyDeferral,
    };
  }

  if (modelNeedsPriceConfirmation === true && !asksForQualification) {
    return {
      hold: true,
      reason: "model_needs_price_confirmation",
      requestedFacts,
      modelNeedsPriceConfirmation: true,
      asksForQualification,
      replyHasForbiddenCommitment,
      replyIsEmptyDeferral,
    };
  }

  return {
    hold: false,
    reason: asksForQualification ? "qualification_question" : "",
    requestedFacts,
    modelNeedsPriceConfirmation: modelNeedsPriceConfirmation === true,
    asksForQualification,
    replyHasForbiddenCommitment,
    replyIsEmptyDeferral,
  };
}
