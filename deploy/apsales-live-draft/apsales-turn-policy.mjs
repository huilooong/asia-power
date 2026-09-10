const BUSINESS_SCOPE_INTENTS = new Set([
  "after_sales",
  "availability",
  "closing",
  "complaint",
  "contact",
  "fluid_enquiry",
  "location",
  "negotiation",
  "product_enquiry",
  "quotation",
  "shipping",
]);

const WEAK_SCOPE_INTENTS = new Set([
  "acknowledgement",
  "greeting",
  "non_business",
  "unknown",
]);

/**
 * Persist what this WhatsApp conversation is being used for. A later generic
 * greeting must not reopen a private/school thread as a sales lead, while an
 * explicit vehicle or parts enquiry may intentionally switch it back.
 */
export function conversationScopePatch(intent, dealState = {}, evidence = {}) {
  const nextScope = intent === "non_business"
    ? "non_business"
    : BUSINESS_SCOPE_INTENTS.has(intent)
      ? "business"
      : null;
  if (!nextScope) return null;

  const patch = {
    conversation_scope: nextScope,
    conversation_scope_intent: intent,
    conversation_scope_at: evidence.at || new Date().toISOString(),
  };
  if (evidence.messageId) patch.conversation_scope_message_id = evidence.messageId;
  if (dealState.conversation_scope !== nextScope) {
    patch.conversation_scope_changed_from = dealState.conversation_scope || null;
  }
  return patch;
}

export function turnPolicy(intent, dealState = {}) {
  if (dealState.conversation_scope === "non_business" && WEAK_SCOPE_INTENTS.has(intent)) {
    return { route: "retain_only", collectIdentity: false, reason: "persisted_non_business_scope" };
  }
  if (intent === "non_business") return { route: "retain_only", collectIdentity: false };
  if (intent === "after_sales") return { route: "human_review", topic: "after_sales", collectIdentity: false };
  if (intent === "location") return { route: "human_review", topic: "location", collectIdentity: false };
  if (intent === "acknowledgement" && dealState.last_outbound_cue !== "offer_price_go_ahead") return { route: "acknowledge", collectIdentity: false };
  if (dealState.support_review_pending && intent === "unknown") return { route: "human_review", topic: "after_sales", collectIdentity: false };
  return { route: "model", collectIdentity: ["quotation", "product_enquiry", "availability", "negotiation", "closing"].includes(intent) || (intent === "acknowledgement" && dealState.last_outbound_cue === "offer_price_go_ahead") };
}

export function routedReply(policy, notified) {
  if (policy.route === "acknowledge") return "Okay.";
  if (policy.topic === "location") return notified
    ? "I’ve passed your location request to our team to confirm the directions."
    : "I don’t have a confirmed location to share here.";
  if (policy.topic === "after_sales") return notified
    ? "I’ve passed this installation or order issue to our team for review before confirming a fix."
    : "The order and matching parts need a team review before I can confirm a fix.";
  return "";
}
