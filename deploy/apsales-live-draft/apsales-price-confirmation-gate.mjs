/**
 * APSALES-COACH-FIX-001 / Step 0
 *
 * The LLM's JSON flag is useful metadata, but it is not the authority for
 * customer safety. If the reply itself promises that a team/supplier must
 * verify price or stock, hold it before WhatsApp send and notify the human.
 */

const TEAM_PRICE_OR_STOCK = /\b(?:team|supplier|colleague)\b.{0,48}\b(?:check|confirm|verify|quote|price|availability|stock|inventory)\b|\b(?:ask|check|confirm|verify)\b.{0,28}\b(?:team|supplier|colleague)\b.{0,28}\b(?:price|quote|availability|stock|inventory)\b|\b(?:ask|check|confirm|verify)\b.{0,28}\b(?:price|quote|availability|stock|inventory)\b.{0,32}\b(?:team|supplier|colleague)\b|\b(?:price|quote|availability|stock)\b.{0,32}\b(?:needs?|need|must|will)\b.{0,24}\b(?:check(?:ed|ing)?|confirm(?:ed|ing)?|verif(?:y|ied|ying))\b/i;

export function priceConfirmationGate({ replyText, modelNeedsPriceConfirmation }) {
  if (modelNeedsPriceConfirmation === true) {
    return { hold: true, reason: "model_needs_price_confirmation" };
  }
  if (TEAM_PRICE_OR_STOCK.test(String(replyText || ""))) {
    return { hold: true, reason: "reply_promises_private_price_or_stock_confirmation" };
  }
  return { hold: false, reason: "" };
}
