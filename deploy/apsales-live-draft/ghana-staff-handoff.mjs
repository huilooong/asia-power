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
      return `客户: ${msg}\n子敬: ${reply}`;
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
    if (!containsGhanaSupportContact(replyText, contactLocal)) {
      return { notified: false };
    }
    if (!session?.sendText || !contactE164) {
      return { notified: false, error: "missing_session_or_contact" };
    }

    const customerId = `wa:${digitsOnly(senderId)}`;
    const summary = await buildHandoffSummary({ workspace, customerId });
    const lines = [
      "📞 客户可能会联系你",
      `客户号码: ${senderId}`,
      summary ? `\n最近聊天概况:\n${summary}` : "(暂无聊天记录摘要)",
    ];

    await session.sendText(contactE164, lines.join("\n"));
    return { notified: true };
  } catch (err) {
    return { notified: false, error: String(err?.message || err) };
  }
}
