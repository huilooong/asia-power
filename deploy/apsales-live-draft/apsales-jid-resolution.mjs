/**
 * Resolve a WhatsApp chat JID to an E.164 phone number.
 *
 * Phone-number JIDs are handled synchronously. Privacy-preserving LIDs require
 * Baileys' live lidMapping lookup and are resolved asynchronously. Failures are
 * deliberately fail-closed so the bridge can quarantine the message instead
 * of guessing a recipient.
 */
export async function resolveObservedPhoneE164({
  fromJid,
  authDir,
  lidLookup,
  jidToE164,
  resolveJidToE164,
}) {
  if (!fromJid) return null;

  const direct = jidToE164(fromJid, { authDir });
  if (direct) return direct;
  if (!String(fromJid).endsWith("@lid")) return null;

  try {
    return (await resolveJidToE164(fromJid, { authDir, lidLookup })) ?? null;
  } catch {
    return null;
  }
}
