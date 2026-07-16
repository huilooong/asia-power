"""Outreach candidates — 子敬主动找客户（CEO 审批后才发送）."""

from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent


def _site_data_dir() -> Path:
    env = os.getenv("EMAIL_DATA_DIR", "").strip()
    if env:
        return Path(env)
    inv = os.getenv("INVENTORY_SITE_ROOT", "").strip()
    if inv:
        return Path(inv) / "data"
    sibling = ROOT.parent / "inventory-site" / "data"
    if sibling.is_dir():
        return sibling
    return ROOT / "data"


LEADS_FILE = _site_data_dir() / "contact-leads.json"
OUTREACH_QUEUE_DIR = ROOT / "memory" / "customer_gateway" / "outreach_queue"

# Match detail-page slug stock token the same way as js/half-cut-inventory-store.js
_HC_STOCK_RE = re.compile(r"(hc\d+)", re.I)
_HALF_CUT_DETAIL_SLUG_RE = re.compile(
    r"half-cuts/detail\.html[^#]*[?&]slug=([^&#]+)",
    re.I,
)

_half_cut_index_cache: dict[str, dict[str, Any]] | None = None


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _load_leads() -> list[dict[str, Any]]:
    if not LEADS_FILE.is_file():
        return []
    try:
        data = json.loads(LEADS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if isinstance(data, list):
        return data
    return list(data.get("leads") or [])


def _half_cut_approved_paths() -> list[Path]:
    """Resolve half-cut inventory JSON the same way as site data dirs."""
    paths: list[Path] = []
    data_dir = _site_data_dir()
    paths.append(data_dir / "half-cut-approved.json")
    inv = os.getenv("INVENTORY_SITE_ROOT", "").strip()
    if inv:
        paths.append(Path(inv) / "data" / "half-cut-approved.json")
    # Local mirror used by ops scripts when data/ is an empty placeholder.
    paths.append(ROOT / "work" / "half-cut-approved-prod.json")
    # de-dupe while preserving order
    seen: set[str] = set()
    out: list[Path] = []
    for p in paths:
        key = str(p.resolve()) if p.exists() else str(p)
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def _load_half_cut_index() -> dict[str, dict[str, Any]]:
    """stockId(UPPER) → row from the first non-empty approved inventory file."""
    global _half_cut_index_cache
    if _half_cut_index_cache is not None:
        return _half_cut_index_cache
    index: dict[str, dict[str, Any]] = {}
    for path in _half_cut_approved_paths():
        if not path.is_file() or path.stat().st_size < 10:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        rows = data if isinstance(data, list) else list((data or {}).get("items") or [])
        if not rows:
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            sid = str(row.get("stockId") or row.get("stock_id") or "").strip().upper()
            if sid and sid not in index:
                index[sid] = row
        if index:
            break
    _half_cut_index_cache = index
    return index


def clear_half_cut_index_cache() -> None:
    """Test helper — drop cached inventory index."""
    global _half_cut_index_cache
    _half_cut_index_cache = None


def extract_hc_id_from_page_url(page_url: str) -> str:
    """Pull HC stock id from a half-cut detail URL/slug (not brand/model guessing)."""
    raw = str(page_url or "").strip()
    if not raw:
        return ""
    slug = ""
    m = _HALF_CUT_DETAIL_SLUG_RE.search(raw)
    if m:
        slug = unquote(m.group(1))
    else:
        slug = raw
    stock = _HC_STOCK_RE.search(slug)
    if not stock:
        return ""
    return stock.group(1).upper()


def lookup_half_cut_by_hc(hc_id: str) -> dict[str, Any] | None:
    """Authoritative brand/model/engine from half-cut-approved by stockId."""
    sid = str(hc_id or "").strip().upper()
    if not sid:
        return None
    return _load_half_cut_index().get(sid)


def _format_listing_label(
    *,
    hc_id: str = "",
    brand: str = "",
    model: str = "",
    engine_code: str = "",
    fallback: str = "",
) -> str:
    vehicle = " ".join(x for x in [brand, model] if x).strip()
    bits = [b for b in [vehicle, engine_code] if b]
    detail = " ".join(bits).strip()
    if hc_id and detail:
        return f"{hc_id} ({detail})"
    if hc_id:
        return hc_id
    if detail:
        return detail
    return fallback


def enrich_lead_vehicle_fields(lead: dict[str, Any]) -> dict[str, str]:
    """
    Fill brand/model/engine_code/hc_id/product for a website lead.

    Prefer explicit lead fields; if empty, extract HC from pageUrl and look up
    half-cut-approved (same stockId path as the public detail page).
    """
    brand = str(lead.get("brand") or "").strip()
    model = str(lead.get("model") or "").strip()
    engine_code = str(
        lead.get("engineCode") or lead.get("engine_code") or ""
    ).strip()
    product = str(lead.get("product") or "").strip()
    page_url = str(lead.get("pageUrl") or lead.get("page") or "").strip()
    hc_id = extract_hc_id_from_page_url(page_url)

    # Only fall back to inventory when the form left vehicle fields blank.
    if hc_id and not (brand or model or product or engine_code):
        row = lookup_half_cut_by_hc(hc_id)
        if row:
            brand = str(row.get("brand") or "").strip()
            model = str(row.get("model") or "").strip()
            engine_code = str(row.get("engineCode") or row.get("engine_code") or "").strip()

    label = _format_listing_label(
        hc_id=hc_id,
        brand=brand,
        model=model,
        engine_code=engine_code,
        fallback=product or engine_code,
    )
    return {
        "brand": brand,
        "model": model,
        "engine_code": engine_code,
        "hc_id": hc_id,
        "product": label or product or engine_code,
    }


def _normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def _candidate_from_lead(lead: dict[str, Any]) -> dict[str, Any]:
    email = (lead.get("email") or "").strip()
    channel = "email" if "@" in email else (lead.get("replyChannel") or "whatsapp")
    enriched = enrich_lead_vehicle_fields(lead)
    product = enriched["product"]
    return {
        "candidate_id": f"lead-{lead.get('id', '')}",
        "source": "website_lead",
        "name": lead.get("name") or lead.get("company") or "unknown",
        "email": email,
        "country": lead.get("country") or "",
        "product": product,
        "brand": enriched["brand"],
        "model": enriched["model"],
        "engine_code": enriched["engine_code"],
        "engineCode": enriched["engine_code"],
        "hc_id": enriched["hc_id"],
        "channel": channel,
        "reason": "网站询价未回复",
        "priority": "high" if lead.get("intent") == "quote" else "medium",
        "ref_id": lead.get("id"),
        "ref_ids": [lead.get("id")] if lead.get("id") else [],
        "listing_labels": [product] if product else [],
        "merged_lead_count": 1,
        "intent": lead.get("intent") or "",
        "message": lead.get("message") or "",
        "pageUrl": lead.get("pageUrl") or lead.get("page") or "",
    }


def _merge_email_candidates(lead_candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse same-email website leads into one candidate; leave non-email alone."""
    merged: list[dict[str, Any]] = []
    by_email: dict[str, dict[str, Any]] = {}

    for cand in lead_candidates:
        email_key = _normalize_email(cand.get("email") or "")
        if not email_key or "@" not in email_key:
            merged.append(cand)
            continue
        existing = by_email.get(email_key)
        if existing is None:
            # Stable id from email so drafts don't fan out per lead row.
            digest = hashlib.sha1(email_key.encode("utf-8")).hexdigest()[:12]
            row = dict(cand)
            row["candidate_id"] = f"lead-email-{digest}"
            row["listing_labels"] = list(
                cand.get("listing_labels")
                or ([cand.get("product")] if cand.get("product") else [])
            )
            row["ref_ids"] = list(
                cand.get("ref_ids")
                or ([cand.get("ref_id")] if cand.get("ref_id") else [])
            )
            by_email[email_key] = row
            continue

        # Merge into existing
        for rid in cand.get("ref_ids") or ([cand.get("ref_id")] if cand.get("ref_id") else []):
            if rid and rid not in existing["ref_ids"]:
                existing["ref_ids"].append(rid)
        label = cand.get("product") or ""
        labels = existing.setdefault("listing_labels", [])
        if label and label not in labels:
            labels.append(label)
        # Prefer a filled name / country / brand from later rows if missing
        for key in ("name", "country", "brand", "model", "engine_code", "hc_id", "message"):
            if not existing.get(key) and cand.get(key):
                existing[key] = cand[key]
        if existing.get("priority") != "high" and cand.get("priority") == "high":
            existing["priority"] = "high"
        existing["merged_lead_count"] = len(existing["ref_ids"]) or (
            int(existing.get("merged_lead_count") or 1) + 1
        )
        existing["product"] = ", ".join(labels)
        if len(labels) > 1:
            existing["hc_id"] = ""  # multi-listing; brief uses listing_labels
            existing["multi_listing"] = True

    merged.extend(by_email.values())
    return merged


def scan_outreach_candidates(limit: int = 30) -> list[dict[str, Any]]:
    """Open website leads + WhatsApp follow-up profiles."""
    lead_candidates: list[dict[str, Any]] = []

    for lead in _load_leads():
        if lead.get("replyStatus") == "replied":
            continue
        lead_candidates.append(_candidate_from_lead(lead))

    candidates = _merge_email_candidates(lead_candidates)

    try:
        from customer_gateway.customer_profile_builder import load_profiles

        action_map = {
            "contact_today": 1,
            "contact_this_week": 2,
            "reactivate": 3,
        }
        for prof in load_profiles():
            action = prof.get("next_action", "monitor")
            if action not in action_map:
                continue
            candidates.append({
                "candidate_id": f"wa-{prof.get('contact_hash', prof.get('contact_name', ''))[:12]}",
                "source": "whatsapp_intelligence",
                "name": prof.get("contact_name", "?"),
                "country": prof.get("country") or "",
                "product": ", ".join(prof.get("interested_products", [])[:3]),
                "channel": "whatsapp",
                "reason": f"WhatsApp 跟进: {action}",
                "priority": "high" if action == "contact_today" else "medium",
                "ref_id": prof.get("contact_hash") or prof.get("contact_name"),
            })
    except Exception:
        pass

    candidates.sort(key=lambda c: (0 if c["priority"] == "high" else 1, c["source"]))
    return candidates[:limit]


_CUSTOMER_DRAFT_LEAK_RE = re.compile(
    r"(?:^|\n)\s*(?:MEMORY_TO_SAVE|DECISION_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|"
    r"INTERNAL_NOTE|SYSTEM|DEBUG)\s*:.*$",
    re.I | re.M,
)


def sanitize_customer_draft(text: str) -> str:
    """Strip internal bookkeeping lines that must never reach the customer."""
    cleaned = _CUSTOMER_DRAFT_LEAK_RE.sub("", text or "")
    # Also strip inline leak tokens if the model jammed them mid-paragraph.
    cleaned = re.sub(
        r"\b(?:MEMORY_TO_SAVE|DECISION_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED)\b[^\n]*",
        "",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(r"\(Draft informed[^)]*\)", "", cleaned, flags=re.I)
    # Model sometimes puts "Subject: ..." inside the body — keep subject in email_subject only.
    cleaned = re.sub(r"(?im)^\s*Subject\s*:\s*.+$", "", cleaned)
    # Collapse leftover blank runs after stripping.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def draft_has_cjk(text: str) -> bool:
    return bool(_CJK_RE.search(text or ""))


def email_subject_for_candidate(candidate: dict[str, Any]) -> str:
    product = str(candidate.get("product") or candidate.get("engineCode") or "").strip()
    if product:
        return f"AsiaPower — your enquiry about {product}"
    return "AsiaPower — following up on your enquiry"


def draft_zijing_outreach_email(candidate: dict[str, Any]) -> tuple[str, str, str]:
    """Ask 子敬 LLM to write the customer email. Returns (subject, body, internal_zh).

    Hard gates: sanitize leaks; reject CJK in customer draft when buyer lang is EN
    (one retry with a stricter brief). Falls back to English template only if LLM
    still fails the language gate — marked in internal analysis.
    """
    from sales_core.apsales_handler import _split_apsales_sections, process_apsales_enquiry

    lang = buyer_language_for_candidate(candidate)
    subject = email_subject_for_candidate(candidate)
    enquiry = build_outreach_enquiry(candidate)
    analysis = process_apsales_enquiry(enquiry, channel="outreach_autopilot")
    internal, _, draft_text = _split_apsales_sections(analysis)
    body = sanitize_customer_draft(draft_text)

    if lang == "en" and (not body or draft_has_cjk(body)):
        retry_brief = (
            enquiry
            + " RETRY: Previous customer draft was invalid (empty or Chinese). "
            "Rewrite the Customer Draft in ENGLISH ONLY. Zero Chinese characters. "
            "No MEMORY_TO_SAVE. Write as Zijing, not a template."
        )
        analysis2 = process_apsales_enquiry(retry_brief, channel="outreach_autopilot")
        internal2, _, draft2 = _split_apsales_sections(analysis2)
        body2 = sanitize_customer_draft(draft2)
        if body2 and not draft_has_cjk(body2):
            return subject, body2, internal2 or internal
        # Last resort — keep customers from receiving Chinese; flag for CEO.
        _, tmpl = build_lead_followup_email(candidate)
        return (
            subject,
            sanitize_customer_draft(tmpl),
            (internal2 or internal or "")
            + "\n\n[GATE] LLM customer draft failed EN check; used English template fallback.",
        )

    if not body:
        _, tmpl = build_lead_followup_email(candidate)
        return subject, sanitize_customer_draft(tmpl), (internal or "") + "\n\n[GATE] empty draft → template"

    return subject, body, internal or ""


def save_outreach_draft(
    candidate: dict[str, Any],
    *,
    internal_analysis: str,
    customer_draft: str,
) -> dict[str, Any]:
    OUTREACH_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    oid = f"outreach-{_now().replace(' ', 'T').replace(':', '')}-{uuid.uuid4().hex[:8]}"
    record = {
        "outreach_id": oid,
        "candidate": candidate,
        "internal_analysis_zh": internal_analysis,
        "customer_draft": sanitize_customer_draft(customer_draft),
        "status": "pending",
        "approval_required": True,
        "created_at": _now(),
        "channel": candidate.get("channel") or "whatsapp",
        "note": "CEO 批准后才可发送；本阶段不自动外发。",
    }
    path = OUTREACH_QUEUE_DIR / f"{oid}.json"
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return record


def list_outreach_drafts(*, status: str | None = "pending", limit: int = 20) -> list[dict[str, Any]]:
    if not OUTREACH_QUEUE_DIR.is_dir():
        return []
    drafts: list[dict[str, Any]] = []
    for path in sorted(OUTREACH_QUEUE_DIR.glob("outreach-*.json"), reverse=True):
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if status and d.get("status") != status:
            continue
        drafts.append(d)
        if len(drafts) >= limit:
            break
    return drafts


_ANGLOPHONE_COUNTRIES = frozenset({
    "ghana", "nigeria", "kenya", "tanzania", "uganda", "zambia", "gambia",
    "liberia", "sierra leone", "south africa", "botswana", "malawi",
    "zimbabwe", "namibia", "rwanda", "cameroon", "usa", "uk", "united states",
    "united kingdom",
})
_FRANCOPHONE_COUNTRIES = frozenset({
    "senegal", "cote d'ivoire", "côte d'ivoire", "togo", "benin", "mali",
    "burkina faso", "congo", "drc", "democratic republic of the congo",
    "gabon", "guinea", "niger", "chad", "madagascar", "morocco", "tunisia",
    "algeria",
})


def buyer_language_for_candidate(candidate: dict[str, Any]) -> str:
    """Best-effort buyer language for website/outreach leads (not template)."""
    country = str(candidate.get("country") or "").strip().lower()
    if country in _FRANCOPHONE_COUNTRIES:
        return "fr"
    if country in _ANGLOPHONE_COUNTRIES or not country:
        return "en"
    return "en"


def build_outreach_enquiry(candidate: dict[str, Any]) -> str:
    """Brief for 子敬 LLM — write like Zijing, not a skeleton template."""
    lang = buyer_language_for_candidate(candidate)
    name = candidate.get("name") or "the customer"
    country = candidate.get("country") or "unknown country"
    product = candidate.get("product") or candidate.get("engineCode") or "general interest"
    brand = candidate.get("brand") or ""
    model = candidate.get("model") or ""
    engine_code = candidate.get("engine_code") or candidate.get("engineCode") or ""
    hc_id = str(candidate.get("hc_id") or "").strip().upper()
    vehicle = " ".join(x for x in [brand, model] if x).strip()
    intent = candidate.get("intent") or ""
    reason = candidate.get("reason") or "website enquiry not yet replied"
    msg = str(candidate.get("message") or "").strip()
    listing_labels = [x for x in (candidate.get("listing_labels") or []) if x]
    multi = bool(candidate.get("multi_listing")) or len(listing_labels) > 1
    bits = [
        f"[BUYER_LANGUAGE={lang}]",
        f"You are 子敬 (Zijing Lu), AsiaPower sales. Write the customer-facing email yourself —",
        "think like a real salesperson following up a website enquiry, NOT a fixed template.",
        f"Customer name: {name}. Country: {country}. Product interest: {product}.",
    ]
    if vehicle:
        bits.append(f"Vehicle hint: {vehicle}.")
    if hc_id and not multi:
        listing = _format_listing_label(
            hc_id=hc_id,
            brand=brand,
            model=model,
            engine_code=str(engine_code),
        )
        bits.append(
            f"This customer clicked on our {listing or hc_id} half-cut listing page. "
            "Reference that specific stock naturally — do NOT ask a vague "
            "'what type of machine/parts are you interested in' question."
        )
    if multi:
        joined = ", ".join(listing_labels) if listing_labels else str(product)
        bits.append(
            f"This customer asked about several different listings/models in separate form "
            f"submissions: {joined}. Write ONE email that covers all of them together — "
            "do not send separate emails per model."
        )
    if intent:
        bits.append(f"Original intent tag: {intent}.")
    bits.append(f"Why we follow up: {reason}.")
    if msg:
        bits.append(f"Customer's original message: {msg[:500]}")
    else:
        bits.append(
            "No free-text message was left on the form — they clicked enquire / WhatsApp interest. "
            "Still write a specific, human follow-up using name/country/product."
        )
    bits.append(
        "Do not invent stock or prices. Ask at most one clear next question. "
        "No MEMORY_TO_SAVE / APPROVAL_REQUEST in the customer draft."
    )
    return " ".join(bits)


def format_outreach_scan(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return (
            "暂无主动开发候选。\n"
            "来源：网站 Lead Inbox 未回复 + WhatsApp 跟进清单。\n"
            "先确保 data/contact-leads.json 或 WhatsApp 画像已同步。"
        )
    lines = ["子敬 · 主动开发候选（需 CEO 批准才发送）", ""]
    for c in candidates:
        lines.append(
            f"- {c['candidate_id']} | {c['priority']} | {c['name']} | {c.get('country') or '?'}\n"
            f"  {c['reason']} | 渠道:{c['channel']} | 产品:{c.get('product') or '—'}"
        )
    lines.append("")
    lines.append("生成草稿: /outreach draft <candidate_id>")
    lines.append("查看队列: /outreach queue")
    return "\n".join(lines)


def format_outreach_queue(drafts: list[dict[str, Any]]) -> str:
    if not drafts:
        return "暂无待审批主动开发草稿。运行 /outreach scan 后 /outreach draft <id>"
    lines = ["主动开发草稿队列（未发送）", ""]
    for d in drafts:
        cand = d.get("candidate") or {}
        lines.append(
            f"- {d['outreach_id']} | {cand.get('name')} | {d.get('status')} | {d.get('channel')}"
        )
    return "\n".join(lines)


def _outreach_path(outreach_id: str) -> Path:
    return OUTREACH_QUEUE_DIR / f"{outreach_id}.json"


def load_outreach(outreach_id: str) -> dict[str, Any] | None:
    path = _outreach_path(outreach_id)
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_outreach(record: dict[str, Any]) -> None:
    OUTREACH_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    oid = record.get("outreach_id")
    if not oid:
        raise ValueError("outreach_id required")
    _outreach_path(oid).write_text(
        json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _greeting_name(candidate: dict[str, Any]) -> str:
    raw = (candidate.get("name") or "").strip()
    if "@" in raw:
        raw = raw.split("@", 1)[0]
    first = raw.split()[0] if raw else ""
    if not first or first.lower() in {"unknown", "n/a", "na", "test", "none"}:
        return "there"
    # Title-case single token; keep ALLCAPS brands/names short as-is if already mixed.
    if first.isupper() and len(first) <= 6:
        return first
    return first[:1].upper() + first[1:].lower()


def build_lead_followup_email(candidate: dict[str, Any]) -> tuple[str, str]:
    """Return (subject, body) for a website lead follow-up."""
    name = _greeting_name(candidate)
    country = (candidate.get("country") or "your market").title()
    product = (candidate.get("product") or "").strip()
    product_line = ""
    if product:
        product_line = f"\nYou asked about {product} — we have supplier-verified options with photos and engine codes on our site.\n"

    subject = "AsiaPower — following up on your enquiry"
    body = (
        f"Hi {name},\n\n"
        f"Thank you for contacting AsiaPower from {country}. "
        f"We connect verified China suppliers with workshops and parts dealers across Africa."
        f"{product_line}\n"
        "Browse half-cuts, engines and gearboxes with EXW pricing:\n"
        "https://asia-power.com/half-cuts/\n\n"
        "Reply to this email with your engine code or vehicle model — "
        "we will confirm availability and send photos.\n\n"
        "WhatsApp: +86 166 3880 1930\n"
        "Best regards,\n"
        "AsiaPower Sales Team\n"
        "sales@asia-power.com"
    )
    return subject, body


def approve_outreach(outreach_id: str) -> dict[str, Any]:
    record = load_outreach(outreach_id)
    if not record:
        raise ValueError(f"Outreach not found: {outreach_id}")
    if record.get("status") == "sent":
        raise ValueError(f"Already sent: {outreach_id}")
    record["status"] = "approved"
    record["approved_at"] = _now()
    save_outreach(record)
    return record


def send_outreach(outreach_id: str, *, force: bool = False) -> dict[str, Any]:
    """Send approved outreach email. WhatsApp channel not supported yet."""
    record = load_outreach(outreach_id)
    if not record:
        raise ValueError(f"Outreach not found: {outreach_id}")
    if record.get("status") == "sent":
        raise ValueError(f"Already sent: {outreach_id}")
    if record.get("status") not in ("approved", "pending") and not force:
        raise ValueError("Outreach must be approved before send")

    cand = record.get("candidate") or {}
    channel = (record.get("channel") or cand.get("channel") or "email").lower()
    if channel != "email":
        raise ValueError(f"Channel {channel} cannot auto-send yet — use email outreach")

    to_email = (cand.get("email") or "").strip()
    if not to_email:
        raise ValueError("Candidate has no email address")

    from customer_gateway.outreach_sent_registry import is_already_sent, record_sent

    if is_already_sent(to_email) and not force:
        raise ValueError(f"Already sent to this email (blocklist): {to_email}")

    subject = (record.get("email_subject") or "").strip()
    body = sanitize_customer_draft(record.get("customer_draft") or "")
    if not subject or not body:
        subject, body = build_lead_followup_email(cand)
        body = sanitize_customer_draft(body)

    from customer_gateway.email_outbound import send_proactive_email

    result = send_proactive_email(to=to_email, subject=subject, text=body, force=force)
    record["status"] = "sent"
    record["sent_at"] = _now()
    record["sent_to"] = to_email
    record["resend_id"] = result.get("resend_id")
    record["email_subject"] = subject
    save_outreach(record)

    try:
        record_sent(
            email=to_email,
            company=cand.get("name") or "",
            country=cand.get("country") or "",
            source="website_lead_outreach",
            resend_id=result.get("resend_id") or "",
            sent_at=record["sent_at"],
            outreach_id=outreach_id,
        )
    except Exception:
        pass

    try:
        from customer_gateway.distribution_progress import record_event

        record_event(
            "email_sent",
            notify=True,
            outreach_id=outreach_id,
            to=to_email,
            subject=subject,
            resend_id=result.get("resend_id"),
            candidate_name=cand.get("name"),
            country=cand.get("country"),
        )
    except Exception:
        pass

    return {**result, "outreach_id": outreach_id}


def create_lead_email_outreach(candidate: dict[str, Any]) -> dict[str, Any]:
    """Create outreach draft for a website lead — 子敬 LLM voice, not skeleton."""
    subject, body, internal = draft_zijing_outreach_email(candidate)
    record = save_outreach_draft(
        {**candidate, "channel": "email"},
        internal_analysis=internal
        or (
            f"网站 Lead 跟进 · {candidate.get('name')} · {candidate.get('country')} · "
            f"产品:{candidate.get('product') or '—'}"
        ),
        customer_draft=body,
    )
    record["email_subject"] = subject
    record["channel"] = "email"
    record["draft_mode"] = "zijing_llm"
    save_outreach(record)
    return record


def rewrite_pending_website_outreach_drafts(*, limit: int = 80) -> list[dict[str, Any]]:
    """Rewrite pending website_lead email drafts via 子敬 LLM (not skeleton template).

    Skips candidates with no email. Does not send.
    Returns list of {outreach_id, name, changed, ...}.
    """
    out: list[dict[str, Any]] = []
    if not OUTREACH_QUEUE_DIR.is_dir():
        return out
    for path in sorted(OUTREACH_QUEUE_DIR.glob("outreach-*.json"), reverse=True):
        if len(out) >= limit:
            break
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if str(record.get("status") or "").lower() != "pending":
            continue
        cand = record.get("candidate") or {}
        if str(cand.get("source") or "") != "website_lead":
            continue
        channel = str(record.get("channel") or cand.get("channel") or "").lower()
        if channel and channel != "email":
            continue
        if not str(cand.get("email") or "").strip():
            out.append(
                {
                    "outreach_id": record.get("outreach_id"),
                    "name": cand.get("name"),
                    "email": cand.get("email"),
                    "skipped": "no_email",
                    "changed": False,
                }
            )
            continue

        subject, body, internal = draft_zijing_outreach_email(cand)
        before = str(record.get("customer_draft") or "")
        record["customer_draft"] = body
        record["email_subject"] = subject
        record["channel"] = "email"
        record["draft_mode"] = "zijing_llm"
        record["internal_analysis_zh"] = internal or record.get("internal_analysis_zh")
        record["rewritten_at"] = _now()
        record["rewrite_note"] = "zijing_llm_voice_2026-07-15"
        save_outreach(record)
        out.append(
            {
                "outreach_id": record.get("outreach_id"),
                "name": cand.get("name"),
                "email": cand.get("email"),
                "product": cand.get("product"),
                "country": cand.get("country"),
                "changed": before.strip() != body.strip(),
                "subject": subject,
                "body": body,
                "used_template_fallback": "[GATE]" in (internal or ""),
            }
        )
    return out
