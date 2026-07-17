/**
 * Internal staff numbers: no auto-reply when they message the business line.
 * Comma-separated env APSALES_INTERNAL_STAFF_NUMBERS_E164; default = Ghana support.
 */

export function parseInternalStaffNumbers(raw, fallbackE164) {
  const source = String(raw || fallbackE164 || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return source;
}

export function isInternalStaffNumber(senderId, staffNumbersE164) {
  const digits = String(senderId || "").replace(/\D/g, "");
  if (!digits) return false;
  const list = Array.isArray(staffNumbersE164) ? staffNumbersE164 : [];
  return list.some((n) => String(n).replace(/\D/g, "") === digits);
}
