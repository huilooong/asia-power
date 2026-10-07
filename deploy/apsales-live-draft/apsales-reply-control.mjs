import fs from "node:fs";
import path from "node:path";

export class ReplyPausedError extends Error {
  constructor(reason) { super(reason); this.code = "AI_REPLY_PAUSED"; }
}

export function readReplyControl(workspace, senderId) {
  if (/^\+[1-9][0-9]{7,14}$/.test(senderId || "") && fs.existsSync(path.join(workspace, "memory/customer_gateway/ai_takeover_failed", senderId))) {
    throw new ReplyPausedError("human_takeover_persistence_failed");
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(path.join(workspace, "memory/customer_gateway/ai_reply_control.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { paused: false, revision: "|", updatedMs: 0 };
    throw new ReplyPausedError("control_state_unreadable");
  }
  if (state?.version !== 1 || !state.global || Array.isArray(state.global) || typeof state.global !== "object" || !state.customers || Array.isArray(state.customers) || typeof state.customers !== "object") {
    throw new ReplyPausedError("control_state_invalid");
  }
  const global = state.global;
  const customer = state.customers[senderId] || {};
  for (const scope of [global, customer]) {
    if (Object.keys(scope).length && (typeof scope.paused !== "boolean" || typeof scope.revision !== "string" || !Number.isFinite(scope.updated_ms))) {
      throw new ReplyPausedError("control_scope_invalid");
    }
  }
  return {
    paused: Boolean(global.paused || customer.paused),
    revision: `${global.revision || ""}|${customer.revision || ""}`,
    updatedMs: Math.max(global.updated_ms || 0, customer.updated_ms || 0),
  };
}

/**
 * Scheduled outbound jobs run outside an inbound customer turn, so they do not
 * naturally pass through assertReplyAllowed(). Hold them while the global
 * learning-only pause is active, and fail closed when the control file is
 * unreadable or invalid.
 */
export function scheduledOutboundHold(workspace) {
  try {
    const current = readReplyControl(workspace, "");
    return {
      held: current.paused,
      reason: current.paused ? "global_reply_paused" : null,
      revision: current.revision,
    };
  } catch (error) {
    return {
      held: true,
      reason: error instanceof Error ? error.message : "control_state_unreadable",
      revision: "",
    };
  }
}

export function assertReplyAllowed(workspace, senderId, ticket, createdAt) {
  const current = readReplyControl(workspace, senderId);
  if (current.paused || (ticket && ticket.revision !== current.revision)) throw new ReplyPausedError("manual_pause_or_changed_control");
  if (current.updatedMs && (!createdAt || !Number.isFinite(Date.parse(createdAt)) || Date.parse(createdAt) <= current.updatedMs)) {
    throw new ReplyPausedError("stale_reply_before_control_change");
  }
  return current;
}
