"""Rate limits + circuit breaker — stop runaway WhatsApp auto-send."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit.logger import log_event

GUARD_PATH = Path(__file__).resolve().parent.parent / "memory" / "customer_gateway" / "whatsapp_send_guard.json"


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)).strip())
    except ValueError:
        return default


def max_per_run() -> int:
    return max(1, _env_int("WHATSAPP_AUTO_SEND_MAX_PER_RUN", 3))


def max_global_per_hour() -> int:
    return max(1, _env_int("WHATSAPP_AUTO_SEND_MAX_GLOBAL_HOUR", 20))


def max_per_contact_per_hour() -> int:
    return max(1, _env_int("WHATSAPP_AUTO_SEND_MAX_PER_CONTACT_HOUR", 4))


def min_contact_interval_sec() -> int:
    return max(30, _env_int("WHATSAPP_AUTO_SEND_MIN_CONTACT_INTERVAL_SEC", 120))


def _norm_body(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _contact_key(contact_name: str) -> str:
    return (contact_name or "").strip().lower()


def _contact_sends(send_log: list[dict[str, Any]], contact_name: str) -> list[dict[str, Any]]:
    key = _contact_key(contact_name)
    if not key:
        return []
    return [row for row in send_log if _contact_key(str(row.get("contact") or "")) == key]


def _duplicate_consecutive_to_contact(
    send_log: list[dict[str, Any]], *, contact_name: str, body_norm: str
) -> bool:
    """True when the last send to this customer already used the same body (about to repeat)."""
    if not body_norm:
        return False
    recent = _contact_sends(send_log, contact_name)
    if not recent:
        return False
    return str(recent[-1].get("body_norm") or "") == body_norm


def _duplicate_run_detected(send_log: list[dict[str, Any]], *, contact_name: str) -> bool:
    """True when the last two sends to this customer used identical bodies."""
    recent = _contact_sends(send_log, contact_name)
    if len(recent) < 2:
        return False
    return str(recent[-1].get("body_norm") or "") == str(recent[-2].get("body_norm") or "")


def _load() -> dict[str, Any]:
    if not GUARD_PATH.is_file():
        return {"paused": False, "send_log": [], "pause_reason": ""}
    try:
        return json.loads(GUARD_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"paused": False, "send_log": [], "pause_reason": ""}


def _save(state: dict[str, Any]) -> None:
    GUARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    GUARD_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def is_paused() -> tuple[bool, str]:
    state = _load()
    if state.get("paused"):
        return True, str(state.get("pause_reason") or "circuit_breaker")
    return False, ""


def pause_autosend(reason: str) -> None:
    state = _load()
    state["paused"] = True
    state["paused_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    state["pause_reason"] = reason
    _save(state)
    log_event("whatsapp_autosend_paused", reason=reason[:300])
    _notify_ceo_pause(reason)


def resume_autosend() -> None:
    state = _load()
    state["paused"] = False
    state["pause_reason"] = ""
    state["resumed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    _save(state)
    log_event("whatsapp_autosend_resumed")


def _notify_ceo_pause(reason: str) -> None:
    token = (
        os.getenv("APSALES_TELEGRAM_BOT_TOKEN")
        or os.getenv("ASIAPOWER_TELEGRAM_BOT_TOKEN")
        or ""
    ).strip()
    chat_ids = (
        os.getenv("APSALES_TELEGRAM_ALLOWED_CHAT_IDS")
        or os.getenv("ASIAPOWER_TELEGRAM_CHAT_ID")
        or ""
    ).strip()
    if not token or not chat_ids:
        return
    try:
        from integrations.telegram_access import parse_allowed_chat_ids
        from tools.message_tool import send_telegram_message

        body = (
            "🛑 子敬 WhatsApp 自动发送已熔断暂停\n\n"
            f"原因: {reason}\n\n"
            "恢复: 确认无异常后运行\n"
            "python3 scripts/zijing-whatsapp-autopilot.py --resume"
        )
        for chat_id in parse_allowed_chat_ids(chat_ids):
            send_telegram_message(chat_id, body, token=token)
    except Exception:
        pass


def _prune_log(send_log: list[dict[str, Any]], *, keep_sec: int = 7200) -> list[dict[str, Any]]:
    now = _now_ts()
    return [row for row in send_log if now - int(row.get("ts") or 0) <= keep_sec]


def _trip_duplicate_circuit(*, contact_name: str, body_norm: str) -> tuple[bool, str]:
    preview = body_norm[:60] + ("…" if len(body_norm) > 60 else "")
    msg = (
        f"熔断: 客户 {contact_name or '(unknown)'} 连续两条相同自动回复 "
        f"「{preview}」— 疑似死循环"
    )
    pause_autosend(msg)
    return False, "circuit_breaker_duplicate_content"


def check_send_allowed(*, contact_name: str, text: str = "") -> tuple[bool, str]:
    """Return (ok, reason). Trips circuit breaker on duplicate consecutive send to one customer."""
    paused, reason = is_paused()
    if paused:
        return False, f"paused:{reason}"

    state = _load()
    now = _now_ts()
    send_log = _prune_log(list(state.get("send_log") or []))
    body_norm = _norm_body(text)

    if body_norm and _duplicate_consecutive_to_contact(
        send_log, contact_name=contact_name, body_norm=body_norm
    ):
        return _trip_duplicate_circuit(contact_name=contact_name, body_norm=body_norm)

    hour_ago = now - 3600
    hour_all = [r for r in send_log if int(r.get("ts") or 0) >= hour_ago]
    if len(hour_all) >= max_global_per_hour():
        return False, "global_hourly_limit"

    contact_key = _contact_key(contact_name)
    if contact_key:
        hour_contact = [
            r for r in hour_all if _contact_key(str(r.get("contact") or "")) == contact_key
        ]
        if len(hour_contact) >= max_per_contact_per_hour():
            return False, "contact_hourly_limit"
        last_contact = max(
            (
                int(r.get("ts") or 0)
                for r in send_log
                if _contact_key(str(r.get("contact") or "")) == contact_key
            ),
            default=0,
        )
        if last_contact and now - last_contact < min_contact_interval_sec():
            return False, "contact_interval"

    return True, "ok"


def record_send(*, contact_name: str, text: str) -> None:
    state = _load()
    send_log = _prune_log(list(state.get("send_log") or []))
    body_norm = _norm_body(text)
    send_log.append({
        "ts": _now_ts(),
        "contact": (contact_name or "").strip(),
        "body_norm": body_norm,
        "preview": (text or "")[:80],
    })
    state["send_log"] = send_log[-500:]
    _save(state)

    if _duplicate_run_detected(send_log, contact_name=contact_name):
        _trip_duplicate_circuit(
            contact_name=contact_name,
            body_norm=body_norm or str(_contact_sends(send_log, contact_name)[-1].get("body_norm") or ""),
        )


def guard_status() -> dict[str, Any]:
    state = _load()
    paused, reason = is_paused()
    send_log = _prune_log(list(state.get("send_log") or []))
    now = _now_ts()
    hour_ago = now - 3600
    return {
        "paused": paused,
        "pause_reason": reason,
        "sends_last_hour": len([r for r in send_log if int(r.get("ts") or 0) >= hour_ago]),
        "circuit_rule": "same_customer_consecutive_duplicate_content",
        "limits": {
            "max_per_run": max_per_run(),
            "max_global_hour": max_global_per_hour(),
            "max_per_contact_hour": max_per_contact_per_hour(),
            "min_contact_interval_sec": min_contact_interval_sec(),
        },
    }
