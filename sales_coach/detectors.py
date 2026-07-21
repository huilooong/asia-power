"""Detectors for outbound Zijing replies (APSALES-SELF-IMPROVE-001).

Detect on final customer-visible reply only. Never mutate Prompt / production.
"""

from __future__ import annotations

import re
from typing import Any

from sales_coach.modules import MODULES  # noqa: F401 — document dependency
from sales_core.enquiry_context import has_non_africa_destination


# ---------------------------------------------------------------------------
# 1) Internal leakage (REPLY_FILTER / P0)
# ---------------------------------------------------------------------------

_LEAK_TOKEN_RE = re.compile(
    r"\b(?:"
    r"MEMORY_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|"
    r"DECISION_TO_SAVE|INTERNAL_NOTE|"
    r"SYSTEM|DEBUG|ANALYSIS|INTERNAL|TOOL|FUNCTION|PROMPT"
    r")\b",
    re.I,
)

_LEAK_BLOCK_RE = re.compile(
    r"(?:^|\n)\s*(?:MEMORY_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|DECISION_TO_SAVE)\s*:.*$",
    re.I | re.M,
)

_LEAK_STRUCTURE_RE = re.compile(
    r"(?:```(?:json|yaml|xml|python)?\s*[\s\S]{20,}?```)|"
    r"(?:\{\s*\"(?:tool|function|prompt|system|debug)\"\s*:)",
    re.I,
)


def detect_internal_leakage(reply: str) -> list[dict[str, Any]]:
    text = reply or ""
    issues: list[dict[str, Any]] = []
    if _LEAK_TOKEN_RE.search(text) or _LEAK_BLOCK_RE.search(text) or _LEAK_STRUCTURE_RE.search(text):
        hit = (_LEAK_TOKEN_RE.search(text) or _LEAK_BLOCK_RE.search(text) or _LEAK_STRUCTURE_RE.search(text))
        snippet = hit.group(0)[:120] if hit else ""
        issues.append(
            {
                "detector": "internal_leakage",
                "module": "REPLY_FILTER",
                "severity": "P0",
                "rule_id": "leak_internal_tag",
                "title": "Internal tag leaked into customer reply",
                "why": f"Outbound contains internal bookkeeping/debug content: {snippet!r}",
                "expected_behavior": "Strip MEMORY_TO_SAVE / APPROVAL_* / SYSTEM / DEBUG before send.",
                "recommended_change": "Harden Reply Filter on final outbound; add regression test for leak tokens.",
                "recommended_tests": [
                    "reply containing MEMORY_TO_SAVE must be flagged P0 REPLY_FILTER",
                    "reply containing APPROVAL_REQUEST must be flagged P0 REPLY_FILTER",
                ],
            }
        )
    return issues


# ---------------------------------------------------------------------------
# 2) Unsupported claims (TRUTH_GUARD / P0) — claim vs evidence
# ---------------------------------------------------------------------------

# Allowed platform capability phrasing (not a specific find for this order).
_ALLOWED_NETWORK_RE = re.compile(
    r"\b(?:verified\s+china[- ]based\s+supplier\s+network|"
    r"verified\s+supplier\s+network|"
    r"china[- ]based\s+supplier\s+network)\b",
    re.I,
)

_SHIPPING_SLA_RE = re.compile(
    r"\b(?:\d+\s*[-–]?\s*\d*\s*working\s*days?|"
    r"\d+\s*[-–—]\s*\d+\s*days?|"
    r"guangzhou\s+port|"
    r"ship(?:ping)?\s+(?:in|within)\s+\d+)\b|"
    r"\d+\s*[-–—]\s*\d+\s*天",
    re.I,
)
_STANDARD_SEA_FREIGHT_TIME_RE = re.compile(r"45\s*[-–—]\s*60\s*(?:days?|天)", re.I)
_STANDARD_SEA_FREIGHT_CONTEXT_RE = re.compile(
    r"(?:\b(?:sea\s*freight|by\s+sea|ship(?:ped|s|ping)?\s+from\s+china|china.{0,40}(?:sea|ship))\b|海运|中国.{0,30}(?:发货|运输|海运))",
    re.I,
)


def is_standard_africa_sea_freight_statement(reply: str, inbound: str = "") -> bool:
    """True only for the approved 45–60 day China sea-freight statement family."""
    text = reply or ""
    if has_non_africa_destination(inbound):
        return False
    if not _STANDARD_SEA_FREIGHT_TIME_RE.search(text):
        return False
    if not _STANDARD_SEA_FREIGHT_CONTEXT_RE.search(text):
        return False
    remainder = _STANDARD_SEA_FREIGHT_TIME_RE.sub("", text)
    return not _SHIPPING_SLA_RE.search(remainder)


_CLAIM_SPECS: list[tuple[str, re.Pattern[str], str, str]] = [
    (
        "claim_identified_suppliers",
        re.compile(
            r"\b(?:we\s+have\s+identified|we\s+identified|we\s+found|"
            r"we\s+have\s+verified\s+availability|"
            r"suppliers?\s+(?:who\s+can|that\s+can)\s+(?:potentially\s+)?fulfill)\b",
            re.I,
        ),
        "supplier_query",
        "Claimed specific suppliers were found/identified without query evidence.",
    ),
    (
        "claim_ready_stock",
        re.compile(
            r"\b(?:ready\s+stock|in\s+stock\s+now|we\s+have\s+(?:it\s+)?in\s+stock|"
            r"available\s+in\s+stock|现货|有货)\b",
            re.I,
        ),
        "inventory_record",
        "Claimed ready/in-stock without inventory evidence.",
    ),
    (
        "claim_shipping_sla",
        _SHIPPING_SLA_RE,
        "logistics_quote",
        "Promised shipping SLA / named port without logistics evidence.",
    ),
    (
        "claim_numeric_price",
        re.compile(r"(?:\$\s*\d|\bUSD\s*\d|\bFOB\b.{0,24}\d|\bCIF\b.{0,24}\d|\bGHS\s*\d)", re.I),
        "approved_quote",
        "Stated a numeric price without approved quote evidence.",
    ),
    (
        "claim_guaranteed_fit",
        re.compile(r"\b(?:guaranteed\s+fit|perfect\s+fit|100%\s+compatible|保证兼容)\b", re.I),
        "vin_decode",
        "Guaranteed fit/compatibility without VIN verification evidence.",
    ),
    (
        "claim_warranty_refund",
        re.compile(r"\b(?:full\s+refund|money[- ]back|we\s+guarantee\s+(?:warranty|refund))\b", re.I),
        "policy_approval",
        "Warranty/refund promise without policy approval evidence.",
    ),
]


def detect_unsupported_claims(
    reply: str,
    *,
    evidence: dict[str, Any] | None = None,
    inbound: str = "",
) -> list[dict[str, Any]]:
    """
    Flag factual claims that lack matching evidence keys.

    evidence may include truthy keys:
      supplier_query, inventory_record, logistics_quote,
      approved_quote, vin_decode, policy_approval
    """
    text = reply or ""
    ev = evidence or {}
    issues: list[dict[str, Any]] = []

    for rule_id, pattern, need_key, why in _CLAIM_SPECS:
        m = pattern.search(text)
        if not m:
            continue
        if rule_id == "claim_shipping_sla" and is_standard_africa_sea_freight_statement(
            text, inbound
        ):
            continue
        # Network boilerplate alone is not "identified suppliers"
        if rule_id == "claim_identified_suppliers":
            # If the only supplier mention is allowed network phrase and no "identified/found"
            if not re.search(r"\b(?:identified|we\s+found|verified\s+availability)\b", text, re.I):
                continue
        if ev.get(need_key):
            continue
        issues.append(
            {
                "detector": "unsupported_claim",
                "module": "TRUTH_GUARD",
                "severity": "P0",
                "rule_id": rule_id,
                "title": f"Unsupported claim: needs {need_key}",
                "why": why + f" Match={m.group(0)!r}",
                "expected_behavior": (
                    f"Only assert this fact when evidence.{need_key} is true; "
                    "otherwise say we will check / request VIN/model."
                ),
                "recommended_change": (
                    "Wire Truth Guard evidence into reply generation; "
                    "replace claim with check-first language."
                ),
                "recommended_tests": [
                    f"reply with claim pattern for {rule_id} and no evidence → P0 TRUTH_GUARD",
                    f"same claim with evidence.{need_key}=true → not flagged",
                ],
                "claim_span": m.group(0),
                "evidence_needed": need_key,
            }
        )
    return issues


def is_allowed_network_phrasing(reply: str) -> bool:
    """True if reply uses network capability language without claiming a specific find."""
    text = reply or ""
    if not _ALLOWED_NETWORK_RE.search(text):
        return False
    return not re.search(r"\b(?:we\s+have\s+identified|we\s+identified|we\s+found)\b", text, re.I)


# ---------------------------------------------------------------------------
# 3) Sales progress (SALES_DECISION)
# ---------------------------------------------------------------------------

_PRICE_INTENT_RE = re.compile(
    r"\b(?:how\s*much|best\s*price|quotation|quote|price\s*list|cheap(?:er)?|pricing|cost)\b",
    re.I,
)
_GREETING_RE = re.compile(
    r"^(?:hi+|hello+|hey+|good\s+(?:morning|afternoon|evening))[\s!?.]*$",
    re.I,
)
_CLOSING_INTENT_RE = re.compile(
    r"\b(?:i\s+want\s+to\s+(?:buy|order|purchase)|ready\s+to\s+(?:buy|order)|proforma|pi\s+please)\b",
    re.I,
)
_ADVANCE_SIGNAL_RE = re.compile(
    r"\b(?:vin|engine\s*code|model|year|quantity|port|long\s*block|"
    r"complete\s*engine|gearbox|we\s+can\s+help\s+with\s+pricing|"
    r"move\s+to\s+quotation|check\s+(?:the\s+)?(?:right|correct)|"
    r"what\s+(?:do\s+you\s+)?need)\b",
    re.I,
)
_REFUSAL_RE = re.compile(
    r"\b(?:cannot\s+quote|can'?t\s+quote|do\s+not\s+confirm\s+(?:stock\s+or\s+)?price|"
    r"we\s+cannot\s+(?:give|provide)\s+(?:a\s+)?(?:price|quote))\b",
    re.I,
)


def classify_customer_intent(inbound: str) -> str:
    body = (inbound or "").strip()
    if not body:
        return "unknown"
    if _GREETING_RE.match(body):
        return "greeting"
    if _PRICE_INTENT_RE.search(body):
        return "quotation"
    if _CLOSING_INTENT_RE.search(body):
        return "closing"
    if re.search(r"\b(?:ship|shipping|freight|port|eta)\b", body, re.I):
        return "shipping"
    if re.search(r"\b(?:in\s*stock|available|have\s+you)\b", body, re.I):
        return "availability"
    if re.search(r"\b(?:discount|too\s+high|negotiate)\b", body, re.I):
        return "negotiation"
    if re.search(r"\b(?:complaint|wrong|damaged|refund)\b", body, re.I):
        return "complaint"
    if re.search(r"\b(?:engine|gearbox|half.?cut|g4k|2kd|1kd|parts?)\b", body, re.I):
        return "product_enquiry"
    return "unknown"


def detect_sales_progress(inbound: str, reply: str) -> list[dict[str, Any]]:
    intent = classify_customer_intent(inbound)
    text = reply or ""
    issues: list[dict[str, Any]] = []

    if intent == "quotation":
        advances = bool(_ADVANCE_SIGNAL_RE.search(text))
        refuses = bool(_REFUSAL_RE.search(text)) or not text.strip()
        if refuses or not advances:
            issues.append(
                {
                    "detector": "sales_progress",
                    "module": "SALES_DECISION",
                    "severity": "P0",
                    "rule_id": "price_no_advance",
                    "title": "Quotation intent not advanced",
                    "why": (
                        "Customer asked for price/quotation but reply refused, stayed silent, "
                        "or did not request minimal facts (VIN/model) to move toward a quote."
                    ),
                    "expected_behavior": (
                        "Accept quote intent → explain why VIN/model needed → ask VIN or "
                        "model+year+engine code + qty + port."
                    ),
                    "recommended_change": "Use zijing_price_advance_reply for all price intents.",
                    "recommended_tests": [
                        "Best price? → must ask VIN/model and not say cannot quote",
                        "How much? → must advance sales process",
                    ],
                    "intent": intent,
                }
            )

    if intent == "product_enquiry":
        # Asking 6+ distinct questions in one reply is also REPLY_BUILDER; here check zero progress
        if not _ADVANCE_SIGNAL_RE.search(text) and not text.strip():
            issues.append(
                {
                    "detector": "sales_progress",
                    "module": "SALES_DECISION",
                    "severity": "P1",
                    "rule_id": "enquiry_no_next_step",
                    "title": "Product enquiry with no next step",
                    "why": "Customer stated a product need but reply has no clarifying next action.",
                    "expected_behavior": "Confirm product + ask VIN/year/qty/port in short WhatsApp style.",
                    "recommended_change": "Ensure product enquiry path always asks one clear next fact.",
                    "recommended_tests": ["Need G4KD → must ask VIN or vehicle details"],
                    "intent": intent,
                }
            )

    if intent == "closing" and not re.search(r"\b(?:next\s+step|proforma|deposit|confirm|PI)\b", text, re.I):
        issues.append(
            {
                "detector": "sales_progress",
                "module": "SALES_DECISION",
                "severity": "P1",
                "rule_id": "closing_no_advance",
                "title": "Closing intent without next commercial step",
                "why": "Customer signals buy/order but reply does not propose a concrete next step.",
                "expected_behavior": "Confirm specs then propose next step (without inventing price).",
                "recommended_change": "Add closing playbook: confirm facts → escalate quote to CEO.",
                "recommended_tests": ["I want to order → must propose next step"],
                "intent": intent,
            }
        )

    return issues


# ---------------------------------------------------------------------------
# 4) Conversation style (REPLY_BUILDER)
# ---------------------------------------------------------------------------

_EMAIL_OPENER_RE = re.compile(
    r"\b(?:dear\s+customer|dear\s+sir/?madam|sir\s+or\s+madam|to\s+whom\s+it\s+may\s+concern)\b",
    re.I,
)
_EMAIL_CLOSER_RE = re.compile(
    r"\b(?:best\s+regards|kind\s+regards|sincerely|yours\s+faithfully|"
    r"sales\s+team|asia\s*power\s+sales)\b",
    re.I,
)
_QUESTION_RE = re.compile(r"\?")


def _question_count(text: str) -> int:
    # Count question marks + bullet "Please send" multi-asks as soft questions
    n = len(_QUESTION_RE.findall(text or ""))
    bullets = re.findall(r"(?:^|\n)\s*[•\-]\s+\S+", text or "")
    if len(bullets) >= 5:
        n = max(n, len(bullets))
    # "Please share: a, b, c, d, e" comma lists
    m = re.search(r"please\s+(?:share|provide|send)[:\s]+(.+)", text or "", re.I | re.S)
    if m:
        chunk = m.group(1).split("\n")[0]
        parts = [p.strip() for p in re.split(r",|/|;|\band\b", chunk) if p.strip()]
        if len(parts) >= 6:
            n = max(n, len(parts))
    return n


def detect_conversation_style(inbound: str, reply: str) -> list[dict[str, Any]]:
    text = reply or ""
    issues: list[dict[str, Any]] = []

    if _EMAIL_OPENER_RE.search(text) or _EMAIL_CLOSER_RE.search(text):
        issues.append(
            {
                "detector": "conversation_style",
                "module": "REPLY_BUILDER",
                "severity": "P1",
                "rule_id": "whatsapp_email_tone",
                "title": "WhatsApp reply uses email tone",
                "why": "Found Dear Customer / Sir or Madam / Best regards / Sales Team style.",
                "expected_behavior": "Short WhatsApp texting tone; no email openers/closers.",
                "recommended_change": "Ban email openers/closers in Reply Builder for WhatsApp channel.",
                "recommended_tests": [
                    "reply with Dear Customer → REPLY_BUILDER",
                    "reply with Best regards → REPLY_BUILDER",
                ],
            }
        )

    words = len(re.findall(r"\S+", text))
    if words > 120:
        issues.append(
            {
                "detector": "conversation_style",
                "module": "REPLY_BUILDER",
                "severity": "P2",
                "rule_id": "reply_too_long",
                "title": "Reply too long for WhatsApp",
                "why": f"Outbound has ~{words} words; WhatsApp replies should stay short.",
                "expected_behavior": "Usually < 80–100 words; one job per message.",
                "recommended_change": "Cap WhatsApp reply length; split follow-ups.",
                "recommended_tests": ["reply >120 words → REPLY_BUILDER reply_too_long"],
            }
        )

    qn = _question_count(text)
    if qn >= 6:
        issues.append(
            {
                "detector": "conversation_style",
                "module": "REPLY_BUILDER",
                "severity": "P1",
                "rule_id": "too_many_questions",
                "title": "Asks too many questions at once",
                "why": f"Detected ~{qn} question/slots in one reply; overwhelms the buyer.",
                "expected_behavior": "Ask 2–4 highest-leverage facts (VIN/model, need type, qty, port).",
                "recommended_change": "Limit clarifying asks; prioritize VIN/model first.",
                "recommended_tests": ["8 clarifying asks in one reply → too_many_questions"],
            }
        )

    # Website spam: more than one asia-power.com in short thread reply
    site_hits = len(re.findall(r"asia-power\.com", text, re.I))
    if site_hits >= 2:
        issues.append(
            {
                "detector": "conversation_style",
                "module": "REPLY_BUILDER",
                "severity": "P2",
                "rule_id": "website_spam",
                "title": "Repeats website too often",
                "why": f"asia-power.com appears {site_hits} times in one reply.",
                "expected_behavior": "At most one website mention per reply when needed.",
                "recommended_change": "Dedupe website line in Reply Builder.",
                "recommended_tests": ["two www.asia-power.com → website_spam"],
            }
        )

    # Language mismatch: Arabic inbound / English-only long reply without Arabic
    if re.search(r"[\u0600-\u06FF]", inbound or "") and not re.search(r"[\u0600-\u06FF]", text):
        if len(text) > 40:
            issues.append(
                {
                    "detector": "conversation_style",
                    "module": "REPLY_BUILDER",
                    "severity": "P1",
                    "rule_id": "language_mismatch",
                    "title": "Reply language does not match customer",
                    "why": "Customer wrote Arabic but reply has no Arabic.",
                    "expected_behavior": "Reply in customer language (or bilingual short).",
                    "recommended_change": "Route language_router into WhatsApp sandbox path.",
                    "recommended_tests": ["Arabic inbound → Arabic or bilingual reply"],
                }
            )

    return issues


def run_all_detectors(
    *,
    inbound: str,
    reply: str,
    evidence: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Run all detectors on one turn. Target = final outbound reply."""
    found: list[dict[str, Any]] = []
    found.extend(detect_internal_leakage(reply))
    found.extend(detect_unsupported_claims(reply, evidence=evidence, inbound=inbound))
    found.extend(detect_sales_progress(inbound, reply))
    found.extend(detect_conversation_style(inbound, reply))
    for issue in found:
        issue.setdefault("inbound", (inbound or "")[:300])
        issue.setdefault("reply", (reply or "")[:500])
    return found
