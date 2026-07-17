/**
 * When sales-agent shares the Ghana support number with a customer,
 * notify that staff on WhatsApp with the customer phone + recent chat summary.
 * Fire-and-forget from bridge — never throw into the customer reply path.
 */
import fs from "node:fs/promises";
import path from "node:path";

const digitsOnly = (s) => String(s || "").replace(/\D/g, "");

export function containsGhanaSupportContact(replyText, contactLocal) {
  const replyDigits = digitsOnly(replyText);
  const contactDigits = digitsOnly(contactLocal);
  if (!contactDigits || !replyDigits) return false;
  if (replyDigits.includes(contactDigits)) return true;
  // Local "054…" ↔ international "+233 54…" (leading 0 dropped).
  const noLeadingZero = contactDigits.replace(/^0+/, "");
  if (noLeadingZero && replyDigits.includes(noLeadingZero)) return true;
  if (noLeadingZero && replyDigits.includes(`233${noLeadingZero}`)) return true;
  return false;
}

/**
 * Semantic fallback for Ghana staff handoff notify.
 * Digit match alone misses replies like "team member will send the office location"
 * with no phone number written out (2026-07-16 +233249632526). Prefer over-notify.
 */
export function looksLikeTeamHandoffPromise(replyText) {
  const t = String(replyText || "").toLowerCase();
  if (!t.trim()) return false;
  const teamActor =
    /\b((our|the)\s+)?(ghana\s+)?(team(\s+member)?|colleague|staff|support)\b/.test(t) ||
    /\bteam member\b/.test(t);
  if (!teamActor) return false;
  const action =
    /\b(will|can|going to)\b.{0,40}\b(send|share|call|contact|reach|message|whatsapp|text)\b/.test(t) ||
    /\b(send|share|call|contact|reach)\b.{0,40}\b(you|customer|directly)\b/.test(t) ||
    /\boffice location\b/.test(t) ||
    /\b(send|share).{0,30}\b(address|location|office)\b/.test(t);
  return action;
}

export function shouldNotifyGhanaStaffHandoff(replyText, contactLocal) {
  return (
    containsGhanaSupportContact(replyText, contactLocal) ||
    looksLikeTeamHandoffPromise(replyText)
  );
}

function turnsPath(workspace) {
  return path.join(workspace, "data", "evidence", "whatsapp", "turns.ndjson");
}

/** Read recent Evidence turns for one customer; human-readable summary. */
export async function buildHandoffSummary({
  workspace,
  customerId,
  maxTurns = 4,
  readFile = fs.readFile,
}) {
  let lines = [];
  try {
    const raw = await readFile(turnsPath(workspace), "utf8");
    lines = raw.split("\n").filter(Boolean);
  } catch {
    return null;
  }

  const turns = [];
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row?.customer?.customer_id === customerId) turns.push(row);
    } catch {
      /* skip malformed */
    }
  }

  const recent = turns.slice(-maxTurns);
  if (!recent.length) return null;

  return recent
    .map((t) => {
      const msg = String(t.customer?.message || "").slice(0, 200);
      const reply = String(t.reply?.text || "").slice(0, 200);
      return `Customer: ${msg}\nAgent: ${reply}`;
    })
    .join("\n---\n");
}

export async function notifyGhanaStaffIfHandingOff({
  senderId,
  replyText,
  workspace,
  session,
  contactLocal,
  contactE164,
}) {
  try {
    if (!shouldNotifyGhanaStaffHandoff(replyText, contactLocal)) {
      return { notified: false };
    }
    if (!session?.sendText || !contactE164) {
      return { notified: false, error: "missing_session_or_contact" };
    }

    const customerId = `wa:${digitsOnly(senderId)}`;
    const summary = await buildHandoffSummary({ workspace, customerId });
    const lines = [
      "New contact shared with a customer",
      `Customer number: ${senderId}`,
      summary ? `\nRecent chat summary:\n${summary}` : "(no chat summary available yet)",
    ];

    await session.sendText(contactE164, lines.join("\n"));
    return { notified: true };
  } catch (err) {
    return { notified: false, error: String(err?.message || err) };
  }
}

/**
 * Separate from address/contact handoff: customer said they could not reach
 * support_contact. Wording must NOT claim the line is broken — signal issues
 * are common. Triggered only when parseAgentReply sets supportLineUnreachable.
 */
export async function notifyGhanaStaffSupportLineUnreachable({
  senderId,
  session,
  contactE164,
}) {
  try {
    if (!session?.sendText || !contactE164) {
      return { notified: false, error: "missing_session_or_contact" };
    }
    const body = [
      `Customer ${senderId} tried calling you and couldn't get through — might just be signal where you are.`,
      "Please check WhatsApp or call them back when you can.",
    ].join(" ");
    await session.sendText(contactE164, body);
    return { notified: true };
  } catch (err) {
    return { notified: false, error: String(err?.message || err) };
  }
}
