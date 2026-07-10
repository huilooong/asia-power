"""Outreach candidates — 子敬主动找客户（CEO 审批后才发送）."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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


def scan_outreach_candidates(limit: int = 30) -> list[dict[str, Any]]:
    """Open website leads + WhatsApp follow-up profiles."""
    candidates: list[dict[str, Any]] = []

    for lead in _load_leads():
        if lead.get("replyStatus") == "replied":
            continue
        email = (lead.get("email") or "").strip()
        channel = "email" if "@" in email else (lead.get("replyChannel") or "whatsapp")
        candidates.append({
            "candidate_id": f"lead-{lead.get('id', '')}",
            "source": "website_lead",
            "name": lead.get("name") or lead.get("company") or "unknown",
            "email": email,
            "country": lead.get("country") or "",
            "product": lead.get("product") or lead.get("engineCode") or "",
            "channel": channel,
            "reason": "网站询价未回复",
            "priority": "high" if lead.get("intent") == "quote" else "medium",
            "ref_id": lead.get("id"),
        })

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
        "customer_draft": customer_draft,
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


def build_outreach_enquiry(candidate: dict[str, Any]) -> str:
    return (
        f"Outreach to {candidate.get('name')} ({candidate.get('country') or 'unknown country'}). "
        f"Source: {candidate.get('source')}. Reason: {candidate.get('reason')}. "
        f"Product interest: {candidate.get('product') or 'general'}. "
        f"Draft a polite re-engagement message; do not invent price or stock."
    )


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


def build_lead_followup_email(candidate: dict[str, Any]) -> tuple[str, str]:
    """Return (subject, body) for a website lead follow-up."""
    name = (candidate.get("name") or "there").split()[0]
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
        "WhatsApp: +233 54 091 1111\n"
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
    body = (record.get("customer_draft") or "").strip()
    if not subject or not body:
        subject, body = build_lead_followup_email(cand)

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
    """Create outreach draft for a website lead with email channel."""
    subject, body = build_lead_followup_email(candidate)
    record = save_outreach_draft(
        {**candidate, "channel": "email"},
        internal_analysis=(
            f"网站 Lead 跟进 · {candidate.get('name')} · {candidate.get('country')} · "
            f"产品:{candidate.get('product') or '—'}"
        ),
        customer_draft=body,
    )
    record["email_subject"] = subject
    record["channel"] = "email"
    save_outreach(record)
    return record
