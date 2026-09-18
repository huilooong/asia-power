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

/** One acknowledgement is enough while an after-sales incident is being reviewed. */
export const AFTER_SALES_REVIEW_DEDUP_MS = 10 * 60 * 1000;

/**
 * Keep every after-sales inbound as evidence, while suppressing repeated
 * customer acknowledgements and operator alerts for a rapid stack of text or
 * media messages about the same incident.
 */
export function afterSalesReviewDecision(dealState = {}, nowMs = Date.now()) {
  const lastAt = Date.parse(String(dealState.last_after_sales_review_reply_at || ""));
  const withinWindow = Number.isFinite(lastAt)
    && nowMs - lastAt >= 0
    && nowMs - lastAt < AFTER_SALES_REVIEW_DEDUP_MS;
  const repeatCount = withinWindow
    ? Number(dealState.after_sales_review_repeat_count || 0) + 1
    : 0;

  if (withinWindow) {
    return {
      silence: true,
      notify: false,
      dealPatch: {
        after_sales_review_repeat_count: repeatCount,
        last_after_sales_review_inbound_at: new Date(nowMs).toISOString(),
      },
    };
  }

  return {
    silence: false,
    notify: true,
    dealPatch: {
      last_after_sales_review_reply_at: new Date(nowMs).toISOString(),
      last_after_sales_review_inbound_at: new Date(nowMs).toISOString(),
      after_sales_review_repeat_count: 0,
    },
  };
}

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
  if (intent === "greeting" && dealState.conversation_scope === "business") {
    return { route: "greet", collectIdentity: false, reason: "active_business_greeting" };
  }
  if (intent === "non_business") return { route: "retain_only", collectIdentity: false };
  if (intent === "after_sales") return { route: "human_review", topic: "after_sales", collectIdentity: false };
  if (intent === "location") return { route: "human_review", topic: "location", collectIdentity: false };
  if (intent === "acknowledgement" && dealState.last_outbound_cue !== "offer_price_go_ahead") return { route: "acknowledge", collectIdentity: false };
  if (dealState.support_review_pending && intent === "unknown") return { route: "human_review", topic: "after_sales", collectIdentity: false };
  return { route: "model", collectIdentity: ["quotation", "product_enquiry", "availability", "negotiation", "closing"].includes(intent) || (intent === "acknowledgement" && dealState.last_outbound_cue === "offer_price_go_ahead") };
}

export function routedReply(policy, notified, customerText = "") {
  if (policy.route === "acknowledge") return "Okay.";
  if (policy.route === "greet") {
    const greeting = String(customerText || "").trim().toLowerCase();
    if (/\bgood\s+morning\b/.test(greeting)) return "Good morning.";
    if (/\bgood\s+afternoon\b/.test(greeting)) return "Good afternoon.";
    if (/\bgood\s+evening\b/.test(greeting)) return "Good evening.";
    return "Hello.";
  }
  if (policy.topic === "location") return notified
    ? "I’ve passed your location request to our team to confirm the directions."
    : "I don’t have a confirmed location to share here.";
  if (policy.topic === "after_sales") return notified
    ? "I’ve passed this installation or order issue to our team for review before confirming a fix."
    : "The order and matching parts need a team review before I can confirm a fix.";
  return "";
}
