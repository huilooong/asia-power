/**
 * +233 bridge → AsiaPower Evidence (APSALES-EVIDENCE-001).
 * Isolated module so importing it does NOT start WhatsApp listeners
 * (bridge.mjs calls main() at load time with no import.meta.url guard).
 *
 * Never throws to caller — Coach data must not break customer reply path.
 */

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function resolveEvidenceModule() {
  // Load writer from repo/checkout. ASIAPOWER_ROOT only redirects evidence *data* writes.
  const candidates = [
    path.resolve(__dirname, "../../server/lib/asiapower-evidence.js"),
    "/root/.openclaw/workspace/AsiaPower/server/lib/asiapower-evidence.js",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("asiapower-evidence.js not found");
}

const evidenceLib = resolveEvidenceModule();
const { recordEvidenceTurn, recordCustomerResult } = evidenceLib;

const ENABLED = !["0", "false", "off", "no"].includes(
  String(process.env.APSALES_EVIDENCE_ENABLED || "true").trim().toLowerCase(),
);

function toNormalized({ senderId, text, messageId, observedAt, messageType }) {
  return {
    wa_id: String(senderId || "").replace(/^\+/, ""),
    text: text || "",
    message_id: messageId || null,
    timestamp: observedAt || new Date().toISOString(),
    message_type: messageType || "text",
  };
}

export function recordInboundForEvidence({ senderId, text, messageId, observedAt, messageType }) {
  if (!ENABLED) return;
  try {
    recordCustomerResult(toNormalized({ senderId, text, messageId, observedAt, messageType }), "whatsapp");
  } catch {
    /* never throw */
  }
}

export function recordReplyForEvidence({
  senderId,
  text,
  messageId,
  observedAt,
  messageType,
  originalReply,
  finalReply,
  reasonCode,
  genDecision,
  outboundWamid,
  sent,
  line = "+233",
}) {
  if (!ENABLED) return;
  try {
    recordEvidenceTurn({
      normalized: toNormalized({ senderId, text, messageId, observedAt, messageType }),
      originalReply,
      finalReply,
      riskBlocked: false,
      reasonCode: reasonCode || "openclaw_reply",
      genDecision: genDecision || "openclaw",
      outboundWamid: outboundWamid || "",
      sent: Boolean(sent),
      channel: "whatsapp",
      vehicleIntelligence: null,
      commercialDecision: null,
      messageUnderstanding: null,
      conversationState: null,
      repeatedActionBlocked: false,
      line,
    });
  } catch {
    /* never throw */
  }
}

export { toNormalized, ENABLED };
