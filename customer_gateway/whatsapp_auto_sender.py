"""Low-risk WhatsApp auto-send lane for Zijng pilot mode."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit.logger import log_event
from customer_gateway import gateway_readonly as gw
from customer_gateway.approval_notification import should_notify_ceo
from customer_gateway.whatsapp_safety import low_risk_auto_send_enabled

BLOCKED_SEND_RE = re.compile(
    r"\b(price|quote|discount|reduce|payment|pay|deposit|contract|shipping|freight|"
    r"duty|import duty|clearing|clearance|tema|container|deadline|refund|"
    r"complete car|whole car|export|legal|cut into parts|tax|available|in stock)\b|"
    r"(报价|价格|付款|定金|合同|运费|海运|关税|清关|特马|货柜|集装箱|退款|整车|出口|切割|税率|现货)",
    re.I,
)

SELF_LOOP_ORIGIN_RE = re.compile(
    r"(please also visit our website|www\.asia-power\.com|"
    r"please send me a photo|send me a photo|send a photo|"
    r"then we will check the correct one for you|"
    r"okay, noted|ok, noted|"
    r"could you please confirm|please confirm|"
    r"brand:\s*|model:\s*|year:\s*|parts needed:\s*|destination country:\s*)",
    re.I,
)

STATE_PATH = Path(__file__).resolve().parent.parent / "memory" / "customer_gateway" / "auto_send_state.json"

_run_budget: int | None = None


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def set_run_budget(n: int | None) -> None:
    """Limit auto-sends per autopilot cycle (None = unlimited)."""
    global _run_budget
    _run_budget = n


def _load_state() -> dict[str, Any]:
    if not STATE_PATH.is_file():
        return {"contacts": {}, "sent_bodies": []}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"contacts": {}, "sent_bodies": []}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _state_allows_send(draft: dict[str, Any]) -> tuple[bool, str]:
    """Block only when the same customer would get the same reply twice in a row."""
    contact = str(draft.get("customer_name") or "").strip().lower()
    reply_key = _norm(str(draft.get("customer_reply_draft") or ""))
    if not contact or not reply_key:
        return True, "ok"
    last_by_contact = dict(_load_state().get("last_body_by_contact") or {})
    if last_by_contact.get(contact) == reply_key:
        return False, "duplicate_reply_to_contact"
    return True, "ok"


def _record_auto_send(draft: dict[str, Any]) -> None:
    state = _load_state()
    contacts = dict(state.get("contacts") or {})
    last_by_contact = dict(state.get("last_body_by_contact") or {})
    contact = str(draft.get("customer_name") or "").strip().lower()
    reply_key = _norm(str(draft.get("customer_reply_draft") or ""))
    if contact:
        contacts[contact] = _now_ts()
        if reply_key:
            last_by_contact[contact] = reply_key

    state["contacts"] = contacts
    state["last_body_by_contact"] = last_by_contact
    _save_state(state)


def can_auto_send_low_risk(draft: dict[str, Any]) -> tuple[bool, str]:
    """Return whether this draft is safe for autonomous WhatsApp sending."""
    global _run_budget

    if not low_risk_auto_send_enabled():
        return False, "disabled"

    from customer_gateway.whatsapp_send_guard import check_send_allowed, is_paused

    paused, pause_reason = is_paused()
    if paused:
        return False, f"paused:{pause_reason}"

    if _run_budget is not None and _run_budget <= 0:
        return False, "run_budget_exhausted"

    original = str(draft.get("original_message") or "")
    if SELF_LOOP_ORIGIN_RE.search(original):
        return False, "self_loop_origin"

    state_ok, state_reason = _state_allows_send(draft)
    if not state_ok:
        return False, state_reason

    contact = str(draft.get("customer_name") or "")
    text = str(draft.get("customer_reply_draft") or "")
    guard_ok, guard_reason = check_send_allowed(contact_name=contact, text=text)
    if not guard_ok:
        return False, guard_reason

    if should_notify_ceo(draft):
        return False, "ceo_required"

    if draft.get("channel") == "email":
        return False, "email_channel"

    if str(draft.get("risk_level") or "").lower() not in {"", "low"}:
        return False, "risk_not_low"

    text = str(draft.get("customer_reply_draft") or "").strip()
    if not text:
        return False, "empty_reply"
    if BLOCKED_SEND_RE.search(text):
        return False, "blocked_terms"
    if len(text) > 700:
        return False, "too_long"
    return True, "ok"


def mark_draft_autosent(draft_id: str, result: dict[str, Any]) -> None:
    path = gw.DRAFT_QUEUE_DIR / f"{draft_id}.json"
    if not path.is_file():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    data["status"] = "sent"
    data["auto_sent"] = True
    data["sent_at"] = _now()
    data["sent_to"] = data.get("customer_name", "")
    data["send_result"] = result
    data["updated_at"] = _now()
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def try_auto_send_low_risk(draft: dict[str, Any]) -> dict[str, Any]:
    global _run_budget

    ok, reason = can_auto_send_low_risk(draft)
    if not ok:
        log_event(
            "whatsapp_auto_send_skipped",
            draft_id=draft.get("draft_id"),
            customer=draft.get("customer_name"),
            reason=reason,
        )
        return {"ok": False, "skipped": True, "reason": reason}

    from customer_gateway.whatsapp_browser_adapter import WhatsAppBrowserAdapter
    from customer_gateway.whatsapp_send_guard import record_send

    adapter = WhatsAppBrowserAdapter()
    contact = str(draft.get("customer_name") or "")
    text = str(draft.get("customer_reply_draft") or "")
    result = adapter.send_low_risk_text(contact_name=contact, text=text)
    log_event(
        "whatsapp_auto_send_result",
        draft_id=draft.get("draft_id"),
        customer=draft.get("customer_name"),
        ok=bool(result.get("ok")),
        error=result.get("error", ""),
    )
    if result.get("ok"):
        if _run_budget is not None:
            _run_budget -= 1
        _record_auto_send(draft)
        record_send(contact_name=result.get("contact_name") or contact, text=text)
        if draft.get("draft_id"):
            mark_draft_autosent(str(draft["draft_id"]), result)
    return result
