export function turnPolicy(intent, dealState = {}) {
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
