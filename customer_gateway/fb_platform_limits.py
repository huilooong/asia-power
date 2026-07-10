"""Track Facebook-discovered rate limits — pause only the blocked action type for 24h."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
LIMITS_FILE = ROOT / "memory" / "customer_gateway" / "fb_platform_limits.json"
DEFAULT_PAUSE_HOURS = 24

ACTION_ALIASES = {
    "group_join": "group_join",
    "join": "group_join",
    "group_greeting": "group_greeting",
    "greeting": "group_greeting",
    "group_comment": "group_comment",
    "comment": "group_comment",
    "dm": "dm",
    "friend_dm": "dm",
    "follow": "follow",
    "accept_friends": "follow",
    "post": "post",
    "timeline_post": "post",
    "browse_feed": "browse_feed",
    "search": "search",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_str() -> str:
    return _now().strftime("%Y-%m-%d %H:%M UTC")


def _normalize_action(action_type: str) -> str:
    key = (action_type or "").strip().lower()
    return ACTION_ALIASES.get(key, key or "unknown")


def _load_raw() -> dict[str, Any]:
    if not LIMITS_FILE.is_file():
        return {"blocks": [], "paused_until": {}}
    try:
        data = json.loads(LIMITS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"blocks": [], "paused_until": {}}
    except (json.JSONDecodeError, OSError):
        return {"blocks": [], "paused_until": {}}


def _save_raw(data: dict[str, Any]) -> None:
    LIMITS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = _now_str()
    LIMITS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def record_platform_block(action_type: str, message: str = "", *, hours: int | None = None) -> dict[str, Any]:
    """On FB block → pause THAT action type only (default 24h). Other types continue."""
    action = _normalize_action(action_type)
    pause_hours = hours if hours is not None else DEFAULT_PAUSE_HOURS
    until = _now() + timedelta(hours=pause_hours)
    until_str = until.strftime("%Y-%m-%d %H:%M UTC")

    data = _load_raw()
    blocks = data.get("blocks")
    if not isinstance(blocks, list):
        blocks = []
    entry = {
        "action_type": action,
        "hit_at": _now_str(),
        "message": (message or "")[:500],
        "paused_until": until_str,
        "pause_hours": pause_hours,
    }
    blocks.append(entry)
    data["blocks"] = blocks[-100:]
    data["last_block"] = entry
    paused = data.get("paused_until")
    if not isinstance(paused, dict):
        paused = {}
    paused[action] = until_str
    data["paused_until"] = paused
    _save_raw(data)

    if action in ("post", "timeline_post"):
        try:
            from customer_gateway.social_engagement_engine import record_timeline_rate_limit

            record_timeline_rate_limit(hours=pause_hours)
        except Exception:
            pass

    return entry


def is_action_paused(action_type: str) -> tuple[bool, str]:
    """Return (paused, reason) for this action type."""
    action = _normalize_action(action_type)
    data = _load_raw()
    paused = data.get("paused_until") or {}
    until_str = str(paused.get(action) or "")
    if not until_str:
        return False, ""
    try:
        until = datetime.strptime(until_str, "%Y-%m-%d %H:%M UTC").replace(tzinfo=timezone.utc)
        if _now() < until:
            last = data.get("last_block") or {}
            msg = str(last.get("message") or "platform_block")
            return True, f"platform_block_until_{until_str}:{msg}"
    except ValueError:
        pass
    return False, ""


def get_limits_summary() -> dict[str, Any]:
    """CEO dashboard: probe mode metadata + last block."""
    data = _load_raw()
    last = data.get("last_block") if isinstance(data.get("last_block"), dict) else None
    active_pauses: dict[str, str] = {}
    paused = data.get("paused_until") or {}
    if isinstance(paused, dict):
        for action, until_str in paused.items():
            paused_flag, _ = is_action_paused(str(action))
            if paused_flag:
                active_pauses[str(action)] = str(until_str)
    return {
        "file": str(LIMITS_FILE.relative_to(ROOT)),
        "last_block": last,
        "active_pauses": active_pauses,
        "total_blocks_recorded": len(data.get("blocks") or []),
        "updated_at": data.get("updated_at"),
    }


def probe_mode_enabled(policy: dict[str, Any] | None = None) -> bool:
    if policy is None:
        try:
            from customer_gateway.social_engagement_engine import load_policy

            policy = load_policy()
        except Exception:
            return False
    return str(policy.get("stop_condition") or "") == "platform_block_only"


# CEO 2026-07-04: 任一社媒动作被平台 block → 切 Maps+邮件草稿模式
_SOCIAL_BLOCK_ACTIONS = (
    "group_join",
    "group_greeting",
    "group_comment",
    "dm",
    "post",
    "timeline_post",
    "follow",
    "browse_feed",
    "search",
)


def is_platform_limited(*, check_actions: tuple[str, ...] | None = None) -> tuple[bool, str]:
    """Return (limited, reason) when any active platform_block pause exists."""
    import os

    forced = os.getenv("APSALES_ZIJING_FORCE_MODE", "").strip().lower()
    if forced == "limited":
        return True, "env_force_limited"
    if forced == "normal":
        return False, ""

    actions = check_actions or _SOCIAL_BLOCK_ACTIONS
    active: list[str] = []
    for action in actions:
        paused, reason = is_action_paused(action)
        if paused:
            active.append(action)
    if active:
        return True, f"platform_block:{','.join(sorted(set(active)))}"
    return False, ""


def get_operating_mode() -> dict[str, Any]:
    """CEO routing: limited (maps+email) vs normal (FB+X)."""
    limited, reason = is_platform_limited()
    mode = "limited" if limited else "normal"
    summary = get_limits_summary()
    return {
        "mode": mode,
        "mode_label": "限流 · Maps+邮件" if limited else "正常 · FB+X",
        "reason": reason,
        "active_pauses": summary.get("active_pauses") or {},
        "last_block": summary.get("last_block"),
    }
