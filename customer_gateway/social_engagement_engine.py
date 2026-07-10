"""Human-paced social engagement engine — FB + X · Africa auto parts (Instagram skipped today)."""

from __future__ import annotations

import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
POLICY_FILE = ROOT / "config" / "apsales_social_engagement_policy.yaml"
TIMELINE_FILE = ROOT / "config" / "apsales_market_timeline.yaml"
FB_GROUPS_FILE = ROOT / "config" / "apsales_fb_target_groups.yaml"
QUEUE_FILE = ROOT / "memory" / "customer_gateway" / "apsales_social_engagement_queue.json"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "apsales_social_engagement_state.json"

ACTION_TYPES = frozenset({
    "post", "comment", "follow", "reply", "browse_feed",
    "group_join", "group_greeting", "group_comment",
})
GROUP_ACTION_TYPES = frozenset({"group_join", "group_greeting", "group_comment"})
RESEARCH_NOTES_FILE = ROOT / "memory" / "customer_gateway" / "social_research_notes.jsonl"
BROWSE_STATE_FILE = ROOT / "memory" / "customer_gateway" / "social_browse_state.json"
ENGAGEMENT_PLATFORMS = ("facebook", "x")
PROBE_QUEUE_CYCLES = 80  # interleaved FB↔X actions per wave in platform probe mode
UNLIMITED_CAP = 9999

# CEO 2026-07-04: FB ↔ X alternate execution — action type rotates each step
ALTERNATE_ACTION_CYCLE: tuple[tuple[str, str], ...] = (
    ("facebook", "group_join"),
    ("x", "follow"),
    ("facebook", "group_greeting"),
    ("x", "comment"),
    ("facebook", "group_comment"),
    ("x", "comment"),
    ("facebook", "follow"),       # FB follow / accept-friends lane
    ("x", "post"),
    ("facebook", "browse_feed"),
    ("x", "follow"),
)
FB_ONLY_ACTION_TYPES = frozenset({"group_join", "group_greeting", "group_comment", "browse_feed"})
X_PREFERRED_ACTION_TYPES = frozenset({"follow", "comment", "post", "reply"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_str() -> str:
    return _now().strftime("%Y-%m-%d %H:%M UTC")


def _today() -> str:
    return _now().strftime("%Y-%m-%d")


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        import yaml  # type: ignore
    except ImportError:
        return _load_json_fallback(path)
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _load_json_fallback(path: Path) -> dict[str, Any]:
    """Minimal YAML-ish parse when PyYAML absent (policy uses simple key: value)."""
    return {}


def _load_json(path: Path, default: object) -> object:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def load_market_timeline() -> dict[str, Any]:
    data = _load_yaml(TIMELINE_FILE)
    if not isinstance(data, dict):
        return {"waves": []}
    waves = data.get("waves") or []
    if not isinstance(waves, list):
        waves = []
    ordered = [w for w in waves if isinstance(w, dict) and w.get("wave_id")]
    ordered.sort(key=lambda w: _utc_minutes_from_hm(str(w.get("utc_start") or "00:00")))
    data["waves"] = ordered
    return data


def _utc_minutes_from_hm(value: str) -> int:
    h, m = _parse_hm(value)
    return h * 60 + m


def _utc_minutes_now(at: datetime | None = None) -> int:
    dt = at or _now()
    return dt.hour * 60 + dt.minute


def _in_wave_window(wave: dict[str, Any], utc_min: int) -> bool:
    start = _utc_minutes_from_hm(str(wave.get("utc_start") or "00:00"))
    end = _utc_minutes_from_hm(str(wave.get("utc_end") or "23:59"))
    if start < end:
        return start <= utc_min < end
    return utc_min >= start or utc_min < end


def _waves_ordered() -> list[dict[str, Any]]:
    return load_market_timeline().get("waves") or []


def _wave_by_id(wave_id: str) -> dict[str, Any] | None:
    for wave in _waves_ordered():
        if wave.get("wave_id") == wave_id:
            return wave
    return None


def active_waves(at: datetime | None = None) -> list[dict[str, Any]]:
    """All waves whose UTC window contains `at` (overlaps allowed)."""
    utc_min = _utc_minutes_now(at)
    return [w for w in _waves_ordered() if _in_wave_window(w, utc_min)]


def current_wave(at: datetime | None = None) -> dict[str, Any] | None:
    """PRIMARY market zone — highest priority among active waves."""
    active = active_waves(at)
    if not active:
        return None
    active.sort(
        key=lambda w: (
            -int(w.get("priority") or 0),
            -_utc_minutes_from_hm(str(w.get("utc_start") or "00:00")),
        ),
    )
    return active[0]


def next_wave(at: datetime | None = None) -> dict[str, Any] | None:
    """Next wave in chronological order (wraps at midnight)."""
    waves = _waves_ordered()
    if not waves:
        return None
    now = at or _now()
    cur = current_wave(now)
    if cur:
        cur_id = cur.get("wave_id")
        idx = next((i for i, w in enumerate(waves) if w.get("wave_id") == cur_id), -1)
        if idx >= 0:
            return waves[(idx + 1) % len(waves)]
    utc_min = _utc_minutes_now(now)
    for wave in waves:
        start = _utc_minutes_from_hm(str(wave.get("utc_start") or "00:00"))
        if start > utc_min:
            return wave
    return waves[0]


def adjacent_wave_ids(at: datetime | None = None) -> set[str]:
    """Current PRIMARY + chronologically adjacent waves (for queue execution)."""
    waves = _waves_ordered()
    if not waves:
        return set()
    now = at or _now()
    cur = current_wave(now)
    allowed: set[str] = set()
    if cur:
        allowed.add(str(cur.get("wave_id")))
        cur_id = cur.get("wave_id")
        idx = next((i for i, w in enumerate(waves) if w.get("wave_id") == cur_id), -1)
        if idx >= 0:
            allowed.add(str(waves[(idx - 1) % len(waves)].get("wave_id")))
            allowed.add(str(waves[(idx + 1) % len(waves)].get("wave_id")))
    else:
        utc_min = _utc_minutes_now(now)
        before = [w for w in waves if _utc_minutes_from_hm(str(w.get("utc_end") or "00:00")) <= utc_min]
        after = [w for w in waves if _utc_minutes_from_hm(str(w.get("utc_start") or "00:00")) > utc_min]
        for w in (before[-1:] + after[:1]):
            allowed.add(str(w.get("wave_id")))
    return {x for x in allowed if x}


def wave_context(at: datetime | None = None) -> dict[str, Any]:
    """CEO dashboard: current / next wave + 24h timeline rows."""
    now = at or _now()
    cur = current_wave(now)
    nxt = next_wave(now)
    waves = _waves_ordered()
    rows: list[dict[str, Any]] = []
    for wave in waves:
        wid = str(wave.get("wave_id") or "")
        rows.append({
            "wave_id": wid,
            "label": wave.get("label_ceo") or wave.get("label") or wid,
            "utc_start": wave.get("utc_start"),
            "utc_end": wave.get("utc_end"),
            "focus": wave.get("focus") or "",
            "languages": wave.get("languages") or [],
            "platforms_active": wave.get("platforms_active") or ["facebook", "x"],
            "is_primary": bool(cur and cur.get("wave_id") == wid),
            "is_active": wid in {w.get("wave_id") for w in active_waves(now)},
        })
    banner_primary = ""
    banner_next = ""
    if cur:
        banner_primary = str(cur.get("label_ceo") or cur.get("label") or cur.get("wave_id"))
    if nxt:
        nxt_label = str(nxt.get("label_ceo") or nxt.get("label") or nxt.get("wave_id"))
        nxt_start = str(nxt.get("utc_start") or "")
        banner_next = f"{nxt_label} {nxt_start} UTC" if nxt_start else nxt_label
    return {
        "strategy": load_market_timeline().get("strategy") or "follow_sun_westward",
        "current_wave": cur,
        "next_wave": nxt,
        "adjacent_wave_ids": sorted(adjacent_wave_ids(now)),
        "active_waves": active_waves(now),
        "timeline_rows": rows,
        "banner": f"🌏 当前主攻：{banner_primary} · 下一波：{banner_next} · FB↔X 交替" if banner_primary else "",
        "utc_now": now.strftime("%Y-%m-%d %H:%M UTC"),
    }


def _wave_window_datetimes(wave: dict[str, Any], day: str | None = None) -> tuple[datetime, datetime]:
    day = day or _today()
    start_h, start_m = _parse_hm(str(wave.get("utc_start") or "00:00"))
    end_h, end_m = _parse_hm(str(wave.get("utc_end") or "23:59"))
    base = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    start = base.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
    end = base.replace(hour=end_h, minute=end_m, second=0, microsecond=0)
    if end <= start:
        end += timedelta(days=1)
    return start, end


def _random_time_in_wave(wave: dict[str, Any], *, now: datetime | None = None) -> datetime | None:
    now = now or _now()
    start, end = _wave_window_datetimes(wave, _today())
    if now >= end:
        return None
    eff_start = max(start, now + timedelta(minutes=random.randint(3, 15)))
    if eff_start >= end:
        return eff_start
    span_min = max(1, int((end - eff_start).total_seconds() // 60))
    return eff_start + timedelta(minutes=random.randint(0, span_min - 1))


def _scheme_for_wave(wave: dict[str, Any], index: int = 0) -> str:
    schemes = wave.get("priority_schemes") or ["A"]
    if not schemes:
        return "A"
    return str(schemes[index % len(schemes)])


def _content_for_scheme(scheme_id: str, platform: str = "facebook") -> str:
    plat = (platform or "").strip().lower()
    if plat in ("x", "twitter"):
        try:
            from customer_gateway.outreach_copy import pick_x_post

            row = pick_x_post()
            if row.get("text"):
                return str(row["text"])
        except Exception:
            pass
    from customer_gateway.social_post_assets import caption_for_scheme

    return caption_for_scheme(scheme_id, platform) or _scheme_a_content(platform)


def _x_post_assets(scheme_id: str = "B") -> dict[str, Any]:
    try:
        from customer_gateway.outreach_copy import pick_x_post

        row = pick_x_post()
        if row.get("text"):
            return row
    except Exception:
        pass
    return {
        "text": _content_for_scheme(scheme_id, "x"),
        "image_urls": _scheme_images(scheme_id),
    }


def _market_label_for_wave(wave: dict[str, Any]) -> str:
    markets = wave.get("markets") or []
    if not markets:
        return "Africa"
    return str(markets[0])


def _search_phrase_for_wave(wave: dict[str, Any], policy: dict[str, Any], index: int) -> str:
    markets = [str(m) for m in (wave.get("markets") or [])]
    phrases = (policy.get("follow_keywords") or {}).get("search_phrases") or []
    for phrase in phrases:
        low = phrase.lower()
        if any(m.lower() in low for m in markets):
            return phrase
    if markets:
        return f"auto parts {markets[0]}"
    return phrases[index % len(phrases)] if phrases else "tokunbo auto parts Africa"


def _should_regenerate_plan(state: dict[str, Any], queue: list[dict[str, Any]]) -> bool:
    if state.get("planned_at", "").startswith(_today()):
        pending_today = [
            a for a in queue
            if isinstance(a, dict)
            and a.get("status") == "pending"
            and str(a.get("not_before") or "").startswith(_today())
        ]
        if pending_today and state.get("timeline_version") == load_market_timeline().get("version"):
            return False
    return True


def load_policy() -> dict[str, Any]:
    policy = _load_yaml(POLICY_FILE)
    if not policy:
        policy = {
            "platforms": {
                "facebook": {"enabled": True, "max_posts_per_day": 3},
                "x": {"enabled": True, "max_posts_per_day": 5},
                "instagram": {"enabled": False},
            },
            "active_hours_utc": {"start": "08:00", "end": "20:00"},
        }
    return policy


def load_fb_groups() -> list[dict[str, Any]]:
    data = _load_yaml(FB_GROUPS_FILE)
    groups = data.get("groups") if isinstance(data, dict) else []
    return [g for g in (groups or []) if isinstance(g, dict) and g.get("group_url")]


def load_state() -> dict[str, Any]:
    state = _load_json(STATE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    if state.get("date") != _today():
        state = {
            "date": _today(),
            "counts": {
                p: {
                    "post": 0, "comment": 0, "follow": 0, "reply": 0, "dm": 0, "browse_feed": 0,
                    "group_join": 0, "group_greeting": 0, "group_comment": 0,
                }
                for p in ENGAGEMENT_PLATFORMS
            },
            "hourly_comments": {},
            "last_action_at": {},
            "planned_at": None,
            "timeline_posts_disabled_until": state.get("timeline_posts_disabled_until"),
        }
    state.setdefault("counts", {})
    for p in ENGAGEMENT_PLATFORMS:
        state["counts"].setdefault(p, {
            "post": 0, "comment": 0, "follow": 0, "reply": 0, "dm": 0, "browse_feed": 0,
            "group_join": 0, "group_greeting": 0, "group_comment": 0,
        })
    return state


def record_timeline_rate_limit(*, hours: int = 24) -> None:
    """CEO policy: FB rate limit → disable timeline posts for N hours."""
    state = load_state()
    until = _now() + timedelta(hours=hours)
    state["timeline_posts_disabled_until"] = until.strftime("%Y-%m-%d %H:%M UTC")
    save_state(state)


def timeline_posts_disabled(policy: dict[str, Any] | None = None) -> tuple[bool, str]:
    policy = policy or load_policy()
    state = load_state()
    until = str(state.get("timeline_posts_disabled_until") or "")
    if until:
        dt = _parse_ts(until)
        if dt and _now() < dt:
            return True, until
    try:
        from integrations.social_browser.facebook_groups import timeline_posts_allowed

        ok, reason = timeline_posts_allowed()
        if not ok:
            return True, reason.replace("timeline_disabled_until_", "")
    except Exception:
        pass
    return False, ""


def save_state(state: dict[str, Any]) -> None:
    state["date"] = _today()
    _save_json(STATE_FILE, state)


def load_queue() -> list[dict[str, Any]]:
    queue = _load_json(QUEUE_FILE, [])
    return queue if isinstance(queue, list) else []


def save_queue(queue: list[dict[str, Any]]) -> None:
    _save_json(QUEUE_FILE, queue)


def _parse_hm(value: str) -> tuple[int, int]:
    parts = (value or "08:00").split(":")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def _default_markets() -> dict[str, dict[str, Any]]:
    return {
        "west_africa": {
            "label": "西非",
            "display": "加纳",
            "flag": "🇬🇭",
            "timezone": "Africa/Accra",
            "active_local": {"start": "08:00", "end": "21:00"},
        },
        "east_africa": {
            "label": "东非",
            "display": "肯尼亚",
            "flag": "🇰🇪",
            "timezone": "Africa/Nairobi",
            "active_local": {"start": "08:00", "end": "21:00"},
        },
        "gulf": {
            "label": "海湾",
            "display": "阿联酋",
            "flag": "🇦🇪",
            "timezone": "Asia/Dubai",
            "active_local": {"start": "09:00", "end": "21:00"},
        },
        "southeast_asia": {
            "label": "东南亚",
            "display": "东南亚",
            "flag": "🌏",
            "timezone": "Asia/Bangkok",
            "active_local": {"start": "08:00", "end": "21:00"},
        },
    }


def _market_configs(policy: dict[str, Any]) -> dict[str, dict[str, Any]]:
    markets = policy.get("market_timezones")
    if isinstance(markets, dict) and markets:
        return markets
    return _default_markets()


def _local_in_window(local_dt: datetime, start_h: int, start_m: int, end_h: int, end_m: int) -> bool:
    cur = local_dt.hour * 60 + local_dt.minute
    start = start_h * 60 + start_m
    end = end_h * 60 + end_m
    if start <= end:
        return start <= cur <= end
    return cur >= start or cur <= end


def get_markets_status(policy: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Per-market awake/sleep status for CEO dashboard."""
    policy = policy or load_policy()
    rows: list[dict[str, Any]] = []
    for market_id, cfg in _market_configs(policy).items():
        if not isinstance(cfg, dict):
            continue
        tz_name = str(cfg.get("timezone") or "UTC")
        hours = cfg.get("active_local") or {}
        start_h, start_m = _parse_hm(hours.get("start", "08:00"))
        end_h, end_m = _parse_hm(hours.get("end", "21:00"))
        try:
            local_now = datetime.now(ZoneInfo(tz_name))
        except Exception:
            local_now = _now()
        awake = _local_in_window(local_now, start_h, start_m, end_h, end_m)
        rows.append({
            "id": market_id,
            "label": cfg.get("label") or market_id,
            "display": cfg.get("display") or cfg.get("label") or market_id,
            "flag": cfg.get("flag") or "",
            "timezone": tz_name,
            "local_time": local_now.strftime("%H:%M"),
            "window": f"{hours.get('start', '08:00')}–{hours.get('end', '21:00')}",
            "awake": awake,
            "status_label": "营业中" if awake else "休眠",
        })
    return rows


def any_market_awake(policy: dict[str, Any] | None = None) -> bool:
    if _force_run():
        return True
    return any(m.get("awake") for m in get_markets_status(policy))


def in_night_slow_mode(policy: dict[str, Any] | None = None) -> bool:
    """All target markets sleeping — reduced-rate intel actions only."""
    if _force_run():
        return False
    policy = policy or load_policy()
    slow = (policy.get("scheduling") or {}).get("night_slow_mode") or {}
    if slow.get("enabled") is False:
        return False
    return not any_market_awake(policy)


def _night_slow_interval_minutes(policy: dict[str, Any]) -> int:
    slow = (policy.get("scheduling") or {}).get("night_slow_mode") or {}
    return int(slow.get("min_interval_minutes") or 120)


def _night_slow_allowed(action_type: str, policy: dict[str, Any]) -> bool:
    slow = (policy.get("scheduling") or {}).get("night_slow_mode") or {}
    allowed = slow.get("allowed_actions") or ["browse_feed"]
    return action_type in allowed


def next_market_wake_utc(policy: dict[str, Any] | None = None) -> datetime | None:
    """UTC time when the next market enters its active window."""
    policy = policy or load_policy()
    now_utc = _now()
    candidates: list[datetime] = []
    for cfg in _market_configs(policy).values():
        if not isinstance(cfg, dict):
            continue
        tz_name = str(cfg.get("timezone") or "UTC")
        hours = cfg.get("active_local") or {}
        start_h, start_m = _parse_hm(hours.get("start", "08:00"))
        try:
            local_now = datetime.now(ZoneInfo(tz_name))
        except Exception:
            continue
        local_start = local_now.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
        if local_now > local_start:
            local_start += timedelta(days=1)
        candidates.append(local_start.astimezone(timezone.utc))
    if not candidates:
        return None
    future = [t for t in candidates if t > now_utc]
    return min(future) if future else min(candidates)


def _force_run() -> bool:
    return os.getenv("APSALES_SOCIAL_FORCE_RUN", "0").strip() == "1"


def _demo_mode() -> bool:
    """CEO review: shorter intervals (5–10 min) when APSALES_SOCIAL_DEMO_MODE=1."""
    return os.getenv("APSALES_SOCIAL_DEMO_MODE", "0").strip() == "1"


def browse_feed_enabled(policy: dict[str, Any] | None = None) -> bool:
    policy = policy or load_policy()
    browse = policy.get("browse_feed") or {}
    if os.getenv("APSALES_FB_BROWSE", "0").strip() == "1":
        return True
    return bool(browse.get("enabled", False))


def in_browse_hours(policy: dict[str, Any] | None = None) -> bool:
    """Browse allowed during any-market-active OR night slow mode."""
    if _force_run():
        return True
    policy = policy or load_policy()
    if any_market_awake(policy):
        return True
    if in_night_slow_mode(policy) and browse_feed_enabled(policy):
        return True
    return False


def in_active_hours(policy: dict[str, Any] | None = None) -> bool:
    """Full-speed engagement when ANY target market is in local business hours."""
    if _force_run():
        return True
    policy = policy or load_policy()
    if policy.get("market_timezones"):
        return any_market_awake(policy)
    hours = policy.get("active_hours_utc") or {}
    start_h, start_m = _parse_hm(hours.get("start", "08:00"))
    end_h, end_m = _parse_hm(hours.get("end", "20:00"))
    now = _now()
    start = now.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
    end = now.replace(hour=end_h, minute=end_m, second=0, microsecond=0)
    return start <= now <= end


def platform_enabled(platform: str, policy: dict[str, Any] | None = None) -> bool:
    policy = policy or load_policy()
    key = "x" if platform in ("twitter", "x") else platform
    if key == "instagram":
        skip = os.getenv("APSALES_SOCIAL_SKIP_INSTAGRAM", "1").strip() == "1"
        plat = (policy.get("platforms") or {}).get("instagram") or {}
        return not skip and bool(plat.get("enabled", False))
    plat = (policy.get("platforms") or {}).get(key) or {}
    return bool(plat.get("enabled", True))


def _platform_limits(platform: str, policy: dict[str, Any]) -> dict[str, Any]:
    key = "x" if platform in ("twitter", "x") else platform
    return (policy.get("platforms") or {}).get(key) or {}


def _platform_block_only(policy: dict[str, Any] | None = None) -> bool:
    policy = policy or load_policy()
    return str(policy.get("stop_condition") or "") == "platform_block_only"


def _policy_cap(value: Any, default: int = UNLIMITED_CAP) -> int:
    """null / 9999+ → unlimited (platform-limited only)."""
    if value is None:
        return default
    if isinstance(value, str) and value.strip().lower() in ("null", "none", ""):
        return default
    try:
        n = int(value)
        return default if n >= UNLIMITED_CAP else n
    except (TypeError, ValueError):
        return default


def _random_interval_minutes(policy: dict[str, Any], platform: str) -> int:
    if _demo_mode():
        return random.randint(5, 10)
    if _platform_block_only(policy):
        limits = _platform_limits(platform, policy)
        lo_s = int(limits.get("min_interval_seconds") or 30)
        hi_s = int(limits.get("max_interval_seconds") or 90)
        return max(1, random.randint(lo_s, max(lo_s, hi_s)) // 60 or 1)
    limits = _platform_limits(platform, policy)
    lo = int(limits.get("min_interval_minutes") or policy.get("min_interval_minutes") or 45)
    hi = int(limits.get("max_interval_minutes") or policy.get("max_interval_minutes") or 120)
    return random.randint(lo, max(lo, hi))


def _random_interval_seconds(policy: dict[str, Any], platform: str) -> int:
    if _demo_mode():
        return random.randint(30, 60)
    limits = _platform_limits(platform, policy)
    lo = int(limits.get("min_interval_seconds") or 30)
    hi = int(limits.get("max_interval_seconds") or 90)
    return random.randint(lo, max(lo, hi))


def _format_wait_label(wait_seconds: int) -> str:
    if wait_seconds <= 0:
        return "即将执行"
    hours = wait_seconds // 3600
    mins = (wait_seconds % 3600) // 60
    if hours > 0:
        return f"还需 {hours}h{mins}m" if mins else f"还需 {hours}h"
    return f"还需 {mins}m"


def get_next_pending_action_summary() -> dict[str, Any] | None:
    """Earliest pending queue item with human-readable wait label (CEO dashboard)."""
    queue = load_queue()
    allowed = adjacent_wave_ids()
    pending = [
        x for x in queue
        if isinstance(x, dict)
        and x.get("status") == "pending"
        and (not x.get("wave_id") or str(x.get("wave_id")) in allowed or _force_run())
    ]
    if not pending:
        pending = [x for x in queue if isinstance(x, dict) and x.get("status") == "pending"]
    if not pending:
        return None
    if _alternate_mode_enabled():
        pending = _interleave_by_platform(pending)
    else:
        pending.sort(key=lambda a: a.get("not_before") or "")
    action = pending[0]
    nb = str(action.get("not_before") or "")
    nb_dt = _parse_ts(nb)
    wait_sec = max(0, int((nb_dt - _now()).total_seconds())) if nb_dt else 0
    wait_label = _format_wait_label(wait_sec)
    platform = str(action.get("platform") or "?")
    action_type = str(action.get("action_type") or "?")
    type_labels = {
        "post": "发帖",
        "comment": "评论",
        "follow": "关注",
        "reply": "回复",
        "browse_feed": "浏览动态",
        "group_join": "加入小组",
        "group_greeting": "小组问候",
        "group_comment": "小组评论",
    }
    type_label = type_labels.get(action_type, action_type)
    plat_label = {"facebook": "Facebook", "x": "X", "instagram": "Instagram"}.get(platform, platform)
    nb_short = nb[:16] if nb else "—"
    wave_label = action.get("wave_label") or action.get("wave_id") or ""
    wave_part = f" · {wave_label}" if wave_label else ""
    alt_tag = "FB↔X · " if _alternate_mode_enabled() else ""
    return {
        "action_id": action.get("action_id"),
        "platform": platform,
        "platform_label": plat_label,
        "action_type": action_type,
        "type_label": type_label,
        "not_before": nb,
        "not_before_short": nb_short,
        "wait_seconds": wait_sec,
        "wait_label": wait_label,
        "wave_id": action.get("wave_id"),
        "wave_label": wave_label,
        "alternate_mode": _alternate_mode_enabled(),
        "label": f"下一动作：{alt_tag}{plat_label} {type_label}{wave_part} · {nb_short}（{wait_label}）",
    }


def _pick_template(policy: dict[str, Any], *, with_link: bool = False) -> str:
    try:
        from customer_gateway.outreach_copy import pick_comment

        return pick_comment(with_link=with_link)
    except Exception:
        pass
    key = "helpful_with_link_when_relevant" if with_link else "helpful_no_link"
    templates = (policy.get("comment_templates") or {}).get(key) or []
    if not templates:
        templates = ["Thanks for sharing — engine codes and photos matter for half-cut sourcing."]
    return random.choice(templates)


def _scheme_a_content(platform: str = "facebook") -> str:
    from customer_gateway.social_post_assets import caption_for_scheme

    return caption_for_scheme("A", platform) or (
        "Custom dismantling · parts on demand 🇬🇭🇳🇬\n\n"
        "Verified half-cuts, engines & gearboxes from China → Africa.\n\n"
        "👉 asia-power.com/half-cuts/\n"
        "sales@asia-power.com"
    )


def _scheme_images(scheme_id: str) -> list[str]:
    from customer_gateway.social_post_assets import pick_images_for_scheme

    return pick_images_for_scheme(scheme_id)


def _schedule_time(base: datetime, offset_minutes: int) -> str:
    return (base + timedelta(minutes=offset_minutes)).strftime("%Y-%m-%d %H:%M UTC")


def _fb_group_limits(policy: dict[str, Any]) -> dict[str, int]:
    fb = _platform_limits("facebook", policy)
    groups = policy.get("facebook_groups") or {}
    return {
        "joins": _policy_cap(fb.get("max_group_joins_per_day") or groups.get("max_joins_per_day"), 3),
        "greetings": _policy_cap(fb.get("max_group_greetings_per_day") or groups.get("max_greetings_per_day"), 5),
        "comments": _policy_cap(fb.get("max_group_comments_per_day") or groups.get("max_comments_per_day"), 3),
        "timeline": _policy_cap(fb.get("max_timeline_posts_per_day") or fb.get("max_posts_per_day"), 1),
    }


def _greeting_content(policy: dict[str, Any]) -> str:
    try:
        from customer_gateway.outreach_copy import build_group_greet_steps

        steps = build_group_greet_steps()
        if steps:
            return str(steps[0].get("text") or "").strip()
    except Exception:
        pass
    groups = policy.get("facebook_groups") or {}
    template = str(groups.get("greeting_template") or "").strip()
    if template:
        return template
    return (
        "Hey everyone — new here 👋 We're a China supplier with real half-cuts, photos on every unit. "
        "Happy to help if you're hunting a specific engine code."
    )


def _probe_action_type_for_cycle(cycle: int) -> tuple[str, str]:
    """FB↔X alternate: join → X follow → greet → X comment → …"""
    platform, action_type = ALTERNATE_ACTION_CYCLE[cycle % len(ALTERNATE_ACTION_CYCLE)]
    return platform, action_type


def _alternate_mode_enabled(policy: dict[str, Any] | None = None) -> bool:
    policy = policy or load_policy()
    sched = policy.get("scheduling") or {}
    if os.getenv("APSALES_SOCIAL_ALTERNATE", "").strip() == "0":
        return False
    if os.getenv("APSALES_SOCIAL_ALTERNATE", "").strip() == "1":
        return True
    return sched.get("alternate_platforms", True) is not False


def _interleave_by_platform(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge FB and X queue rows as FB → X → FB → X … (stable within each platform)."""
    fb = sorted(
        [a for a in items if str(a.get("platform") or "").lower() == "facebook"],
        key=lambda a: a.get("not_before") or "",
    )
    x_rows = sorted(
        [a for a in items if str(a.get("platform") or "").lower() == "x"],
        key=lambda a: a.get("not_before") or "",
    )
    other = sorted(
        [a for a in items if str(a.get("platform") or "").lower() not in ("facebook", "x")],
        key=lambda a: a.get("not_before") or "",
    )
    out: list[dict[str, Any]] = []
    i = 0
    while i < max(len(fb), len(x_rows)):
        if i < len(fb):
            out.append(fb[i])
        if i < len(x_rows):
            out.append(x_rows[i])
        i += 1
    out.extend(other)
    return out


def _restagger_alternate_queue(queue: list[dict[str, Any]], *, start: datetime | None = None) -> None:
    """After interleave, assign monotonic not_before so execution order matches FB↔X."""
    now = start or _now()
    policy = load_policy()
    probe = _platform_block_only(policy)
    offset_sec = 0
    for idx, action in enumerate(queue):
        platform = str(action.get("platform") or "facebook")
        action["not_before"] = (now + timedelta(seconds=offset_sec)).strftime("%Y-%m-%d %H:%M UTC")
        action["alternate_index"] = idx
        if probe:
            offset_sec += _random_interval_seconds(policy, platform)
        else:
            offset_sec += _random_interval_minutes(policy, platform) * 60


def preview_alternate_sequence(n: int = 10, *, at: datetime | None = None) -> list[dict[str, str]]:
    """CEO dashboard: next N planned actions as FB/X labels."""
    queue = load_queue()
    pending = [
        a for a in queue
        if isinstance(a, dict) and a.get("status") == "pending"
    ]
    if _alternate_mode_enabled():
        pending = _interleave_by_platform(pending)
    else:
        pending.sort(key=lambda a: a.get("not_before") or "")
    type_labels = {
        "post": "发帖", "comment": "评论", "follow": "关注", "reply": "回复",
        "browse_feed": "浏览", "group_join": "入组", "group_greeting": "问候",
        "group_comment": "组评",
    }
    plat_labels = {"facebook": "FB", "x": "X"}
    preview: list[dict[str, str]] = []
    for action in pending[:n]:
        plat = str(action.get("platform") or "?")
        atype = str(action.get("action_type") or "?")
        preview.append({
            "platform": plat,
            "platform_label": plat_labels.get(plat, plat.upper()),
            "action_type": atype,
            "label": f"{plat_labels.get(plat, plat)} · {type_labels.get(atype, atype)}",
        })
    if len(preview) < n:
        base = len(preview)
        for i in range(base, n):
            plat, atype = _probe_action_type_for_cycle(i)
            preview.append({
                "platform": plat,
                "platform_label": "FB" if plat == "facebook" else "X",
                "action_type": atype,
                "label": f"{'FB' if plat == 'facebook' else 'X'} · {type_labels.get(atype, atype)}",
                "projected": True,
            })
    return preview


def _append_probe_queue_actions(
    new_queue: list[dict[str, Any]],
    *,
    policy: dict[str, Any],
    waves: list[dict[str, Any]],
    fb_groups: list[dict[str, Any]],
    now: datetime,
    greeting_text: str,
) -> None:
    """Fill queue with P0-P4 cycles — no artificial daily caps."""
    groups_to_greet = [g for g in fb_groups if g.get("status") in ("joined", "pending") and not g.get("greeted_at")]
    groups_to_join = [g for g in fb_groups if g.get("status") in ("discovered", None, "")]
    joined_groups = [g for g in fb_groups if g.get("status") in ("joined", "pending", "greeted")]
    offset_sec = 0
    phrase_idx = 0

    for wave in waves:
        wave_id = str(wave.get("wave_id") or "wave_unknown")
        wave_label = wave.get("label_ceo") or wave.get("label") or wave_id
        market = _market_label_for_wave(wave)

        for cycle in range(PROBE_QUEUE_CYCLES):
            platform, action_type = _probe_action_type_for_cycle(cycle)
            when = now + timedelta(seconds=offset_sec)
            offset_sec += _random_interval_seconds(policy, platform)

            if action_type == "group_join":
                grp = groups_to_join[cycle % len(groups_to_join)] if groups_to_join else None
                search_q = _search_phrase_for_wave(wave, policy, phrase_idx)
                phrase_idx += 1
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "group_join",
                    "platform": "facebook",
                    "group_url": (grp or {}).get("group_url", ""),
                    "group_name": (grp or {}).get("name", ""),
                    "search_query": search_q if not grp else "",
                    "market": (grp or {}).get("market", market),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "priority": "P0",
                    "probe_mode": True,
                })
            elif action_type == "group_greeting":
                grp = groups_to_greet[cycle % len(groups_to_greet)] if groups_to_greet else None
                target = grp or (joined_groups[cycle % len(joined_groups)] if joined_groups else {})
                if not target:
                    continue
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "group_greeting",
                    "platform": "facebook",
                    "group_url": target.get("group_url", ""),
                    "group_name": target.get("name", ""),
                    "content": greeting_text,
                    "market": target.get("market", market),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "priority": "P1",
                    "probe_mode": True,
                })
            elif action_type == "group_comment":
                grp = joined_groups[cycle % len(joined_groups)] if joined_groups else {}
                if not grp:
                    continue
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "group_comment",
                    "platform": "facebook",
                    "group_url": grp.get("group_url", ""),
                    "group_name": grp.get("name", ""),
                    "content": _pick_template(policy, with_link=(cycle % 2 == 1)),
                    "market": grp.get("market", market),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "priority": "P2",
                    "probe_mode": True,
                })
            elif action_type == "follow":
                phrase = _search_phrase_for_wave(wave, policy, phrase_idx)
                phrase_idx += 1
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "follow",
                    "platform": platform,
                    "search_query": phrase,
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "market": market,
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "priority": "P4" if platform == "facebook" else "P5",
                    "probe_mode": True,
                })
            elif action_type == "comment" and platform == "x":
                phrase = _search_phrase_for_wave(wave, policy, phrase_idx)
                phrase_idx += 1
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "comment",
                    "platform": "x",
                    "search_query": phrase,
                    "content": _pick_template(policy, with_link=(cycle % 2 == 1)),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "market": market,
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "priority": "P4",
                    "probe_mode": True,
                })
            elif action_type == "post" and platform == "x":
                scheme = _scheme_for_wave(wave, cycle)
                x_assets = _x_post_assets(scheme)
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "post",
                    "platform": "x",
                    "target_type": "profile",
                    "content": x_assets.get("text") or _content_for_scheme(scheme, "x"),
                    "caption_short": x_assets.get("text") or _content_for_scheme(scheme, "x"),
                    "image_urls": x_assets.get("image_urls") or _scheme_images(scheme),
                    "listing_url": x_assets.get("listing_url"),
                    "scheme_id": scheme,
                    "copy_version": "x_short_v2",
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "market": market,
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "priority": "P4",
                    "probe_mode": True,
                })
            elif action_type == "browse_feed" and platform == "facebook":
                browse_cfg = policy.get("browse_feed") or {}
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "browse_feed",
                    "platform": "facebook",
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "market": market,
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                    "session_minutes": browse_cfg.get("session_minutes"),
                    "priority": "P4",
                    "probe_mode": True,
                })


def plan_daily_actions(*, force: bool = False) -> dict[str, Any]:
    """Queue human-paced actions — groups first, timeline posts last (0-1/day)."""
    policy = load_policy()
    state = load_state()
    queue = load_queue()
    timeline = load_market_timeline()
    waves = timeline.get("waves") or []

    if not force and not _should_regenerate_plan(state, queue):
        return {"skipped": True, "reason": "already_planned", "queue_size": len(queue)}

    now = _now()
    new_queue: list[dict[str, Any]] = []
    phrase_idx = 0
    fb_limits = _fb_group_limits(policy)
    timeline_disabled, _ = timeline_posts_disabled(policy)
    timeline_budget = 0 if timeline_disabled else fb_limits["timeline"]
    timeline_scheduled = 0
    group_joins_scheduled = 0
    group_greetings_scheduled = 0
    group_comments_scheduled = 0
    greeting_text = _greeting_content(policy)

    if not waves:
        waves = [{
            "wave_id": "wave_fallback",
            "label": "默认",
            "markets": ["Africa"],
            "priority_schemes": ["A"],
            "utc_start": "08:00",
            "utc_end": "20:00",
            "action_mix": {
                "group_join": 0.30, "group_greeting": 0.25, "group_comment": 0.15,
                "browse_feed": 0.15, "post": 0.05, "comment": 0.05, "follow": 0.05,
            },
        }]

    fb_groups = load_fb_groups()
    groups_to_greet = [g for g in fb_groups if g.get("status") in ("joined", "pending") and not g.get("greeted_at")]
    groups_to_join = [g for g in fb_groups if g.get("status") in ("discovered", None, "")]
    joined_groups = [g for g in fb_groups if g.get("status") in ("joined", "pending", "greeted")]

    if _platform_block_only(policy):
        _append_probe_queue_actions(
            new_queue,
            policy=policy,
            waves=waves,
            fb_groups=fb_groups,
            now=now,
            greeting_text=greeting_text,
        )
    else:
        for wave in waves:
            mix = wave.get("action_mix") or {}
            market = _market_label_for_wave(wave)
            wave_id = str(wave.get("wave_id") or "wave_unknown")
            wave_label = wave.get("label_ceo") or wave.get("label") or wave_id

            # P0 — group joins (Facebook only, during high-priority waves)
            n_joins = max(0, round(fb_limits["joins"] * float(mix.get("group_join") or 0) * len(waves) / 2))
            for i in range(n_joins):
                if group_joins_scheduled >= fb_limits["joins"]:
                    break
                when = _random_time_in_wave(wave, now=now)
                if not when:
                    continue
                grp = groups_to_join[group_joins_scheduled] if group_joins_scheduled < len(groups_to_join) else None
                search_q = _search_phrase_for_wave(wave, policy, phrase_idx + i)
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "group_join",
                    "platform": "facebook",
                    "group_url": (grp or {}).get("group_url", ""),
                    "group_name": (grp or {}).get("name", ""),
                    "search_query": search_q if not grp else "",
                    "market": (grp or {}).get("market", market),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                })
                group_joins_scheduled += 1

            # P1 — group greetings
            n_greetings = max(0, round(fb_limits["greetings"] * float(mix.get("group_greeting") or 0) * len(waves) / 2))
            for i in range(n_greetings):
                if group_greetings_scheduled >= fb_limits["greetings"]:
                    break
                when = _random_time_in_wave(wave, now=now)
                if not when:
                    continue
                grp = groups_to_greet[group_greetings_scheduled] if group_greetings_scheduled < len(groups_to_greet) else None
                if not grp and not joined_groups:
                    continue
                target = grp or (joined_groups[group_greetings_scheduled % len(joined_groups)] if joined_groups else {})
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "group_greeting",
                    "platform": "facebook",
                    "group_url": target.get("group_url", ""),
                    "group_name": target.get("name", ""),
                    "content": greeting_text,
                    "market": target.get("market", market),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                })
                group_greetings_scheduled += 1

            # P2 — group comments (helpful, link when relevant)
            n_gcomments = max(0, round(fb_limits["comments"] * float(mix.get("group_comment") or 0) * len(waves) / 2))
            for i in range(n_gcomments):
                if group_comments_scheduled >= fb_limits["comments"]:
                    break
                when = _random_time_in_wave(wave, now=now)
                if not when:
                    continue
                grp = joined_groups[i % len(joined_groups)] if joined_groups else {}
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "group_comment",
                    "platform": "facebook",
                    "group_url": grp.get("group_url", ""),
                    "group_name": grp.get("name", ""),
                    "content": _pick_template(policy, with_link=(i % 2 == 1)),
                    "market": grp.get("market", market),
                    "approval": "auto",
                    "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                    "status": "pending",
                    "wave_id": wave_id,
                    "wave_label": wave_label,
                })
                group_comments_scheduled += 1

            for platform in ENGAGEMENT_PLATFORMS:
                if not platform_enabled(platform, policy):
                    continue
                limits = _platform_limits(platform, policy)
                max_follows = int(limits.get("max_follows_per_day") or 5)
                max_comments = min(4, int(limits.get("max_comments_per_hour") or 2) * 2)

                if platform == "x":
                    follow_weight = float(mix.get("x_follow") or mix.get("follow") or 0)
                    comment_weight = float(mix.get("x_comment") or mix.get("comment") or 0)
                    post_weight = float(mix.get("x_post") or mix.get("post") or 0)
                else:
                    follow_weight = float(mix.get("follow") or 0)
                    comment_weight = float(mix.get("comment") or 0)
                    post_weight = float(mix.get("post") or 0)

                n_browse = 1 if float(mix.get("browse_feed") or 0) >= 0.12 and platform == "facebook" else 0
                n_follows = max(0, round(max_follows * follow_weight * len(waves) / 4))
                n_comments = max(0, round(max_comments * comment_weight * len(waves) / 4))

                # P3 — timeline posts (global budget, last priority)
                if platform == "facebook" and timeline_budget > timeline_scheduled:
                    if post_weight >= 0.04:
                        when = _random_time_in_wave(wave, now=now)
                        if when:
                            scheme = _scheme_for_wave(wave, timeline_scheduled)
                            new_queue.append({
                                "action_id": f"act-{uuid.uuid4().hex[:10]}",
                                "action_type": "post",
                                "platform": platform,
                                "target_type": "profile",
                                "content": _content_for_scheme(scheme, platform),
                                "caption_short": _content_for_scheme(scheme, platform),
                                "image_urls": _scheme_images(scheme),
                                "scheme_id": scheme,
                                "approval": "auto",
                                "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                                "status": "pending",
                                "market": market,
                                "wave_id": wave_id,
                                "wave_label": wave_label,
                                "languages": wave.get("languages") or ["en"],
                                "note": "timeline_low_priority",
                            })
                            timeline_scheduled += 1
                elif platform == "x":
                    max_x_posts = int(limits.get("max_posts_per_day") or 2)
                    n_x_posts = max(0, round(max_x_posts * post_weight * len(waves) / 2))
                    for i in range(n_x_posts):
                        when = _random_time_in_wave(wave, now=now)
                        if not when:
                            continue
                        scheme = _scheme_for_wave(wave, i)
                        x_assets = _x_post_assets(scheme)
                        new_queue.append({
                            "action_id": f"act-{uuid.uuid4().hex[:10]}",
                            "action_type": "post",
                            "platform": platform,
                            "target_type": "profile",
                            "content": x_assets.get("text") or _content_for_scheme(scheme, platform),
                            "caption_short": x_assets.get("text") or _content_for_scheme(scheme, platform),
                            "image_urls": x_assets.get("image_urls") or _scheme_images(scheme),
                            "listing_url": x_assets.get("listing_url"),
                            "scheme_id": scheme,
                            "copy_version": "x_short_v2",
                            "approval": "auto",
                            "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                            "status": "pending",
                            "market": market,
                            "wave_id": wave_id,
                            "wave_label": wave_label,
                        })

                for i in range(n_comments):
                    when = _random_time_in_wave(wave, now=now)
                    if not when:
                        continue
                    phrase = _search_phrase_for_wave(wave, policy, phrase_idx)
                    phrase_idx += 1
                    new_queue.append({
                        "action_id": f"act-{uuid.uuid4().hex[:10]}",
                        "action_type": "comment",
                        "platform": platform,
                        "search_query": phrase,
                        "content": _pick_template(policy, with_link=(i == n_comments - 1)),
                        "approval": "auto",
                        "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                        "status": "pending",
                        "market": market,
                        "wave_id": wave_id,
                        "wave_label": wave_label,
                    })

                for i in range(n_follows):
                    when = _random_time_in_wave(wave, now=now)
                    if not when:
                        continue
                    phrase = _search_phrase_for_wave(wave, policy, phrase_idx + i)
                    new_queue.append({
                        "action_id": f"act-{uuid.uuid4().hex[:10]}",
                        "action_type": "follow",
                        "platform": platform,
                        "search_query": phrase,
                        "approval": "auto",
                        "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                        "status": "pending",
                        "market": market,
                        "wave_id": wave_id,
                        "wave_label": wave_label,
                    })

                for _ in range(n_browse):
                    when = _random_time_in_wave(wave, now=now)
                    if not when:
                        continue
                    browse_cfg = policy.get("browse_feed") or {}
                    new_queue.append({
                        "action_id": f"act-{uuid.uuid4().hex[:10]}",
                        "action_type": "browse_feed",
                        "platform": "facebook",
                        "approval": "auto",
                        "not_before": when.strftime("%Y-%m-%d %H:%M UTC"),
                        "status": "pending",
                        "market": market,
                        "wave_id": wave_id,
                        "wave_label": wave_label,
                        "session_minutes": browse_cfg.get("session_minutes"),
                    })

    # Reply actions from inbox (inherit current wave)
    cur = current_wave()
    cur_wave_id = str((cur or {}).get("wave_id") or "wave_inbox")
    cur_wave_label = (cur or {}).get("label_ceo") or (cur or {}).get("label") or cur_wave_id
    try:
        inbox = _load_json(ROOT / "memory" / "customer_gateway" / "social_reply_inbox.json", [])
        if isinstance(inbox, list):
            for row in inbox[:3]:
                if row.get("status") not in ("pending_draft", "draft_created"):
                    continue
                platform = row.get("platform", "facebook")
                if platform not in ENGAGEMENT_PLATFORMS or not platform_enabled(platform, policy):
                    continue
                when = _random_time_in_wave(cur, now=now) if cur else now + timedelta(minutes=random.randint(10, 30))
                listing = row.get("listing_url", "https://asia-power.com/half-cuts/")
                templates = (policy.get("reply_templates") or {}).get("after_they_engaged") or [
                    "Thanks! Browse {listing_url} then email sales@asia-power.com for a quote."
                ]
                body = random.choice(templates).format(listing_url=listing)
                nb = when.strftime("%Y-%m-%d %H:%M UTC") if isinstance(when, datetime) else _schedule_time(now, 15)
                new_queue.append({
                    "action_id": f"act-{uuid.uuid4().hex[:10]}",
                    "action_type": "reply",
                    "platform": platform,
                    "reply_id": row.get("reply_id"),
                    "post_url": row.get("post_url", ""),
                    "customer_handle": row.get("customer_handle", ""),
                    "content": body,
                    "approval": "needs_ceo" if row.get("status") == "pending_draft" else "auto",
                    "not_before": nb,
                    "status": "pending",
                    "wave_id": cur_wave_id,
                    "wave_label": cur_wave_label,
                })
    except Exception:
        pass

    if _alternate_mode_enabled(policy):
        new_queue = _interleave_by_platform(new_queue)
        _restagger_alternate_queue(new_queue, start=now)
    else:
        new_queue.sort(key=lambda a: a.get("not_before") or "")
    save_queue(new_queue)
    state["planned_at"] = _now_str()
    state["planned_count"] = len(new_queue)
    state["timeline_version"] = timeline.get("version")
    state["timeline_strategy"] = timeline.get("strategy")
    save_state(state)

    ctx = wave_context()
    _record_engagement_event(
        "engagement_planned",
        summary=f"向西逐波计划 · {len(new_queue)} 条 · 当前 {ctx.get('banner', '')}",
        details={"count": len(new_queue), "wave_context": ctx},
    )

    return {"ok": True, "planned": len(new_queue), "queue": new_queue, "wave_context": ctx}


def can_run_action(action: dict[str, Any], policy: dict[str, Any] | None = None) -> tuple[bool, str]:
    policy = policy or load_policy()
    state = load_state()
    probe = _platform_block_only(policy)

    action_type = action.get("action_type", "")
    platform = action.get("platform", "")

    if probe and platform == "facebook":
        try:
            from customer_gateway.fb_platform_limits import is_action_paused

            paused, pause_reason = is_action_paused(action_type)
            if paused:
                return False, pause_reason or "platform_block"
        except Exception:
            pass

    if action_type == "browse_feed":
        if not browse_feed_enabled(policy):
            return False, "browse_feed_disabled"
        if not probe and not in_browse_hours(policy) and not _force_run():
            return False, "outside_browse_hours"
        if not probe and in_night_slow_mode(policy) and not any_market_awake(policy):
            last_key = f"{platform}:{action_type}"
            last_at = state.get("last_action_at", {}).get(last_key)
            if last_at:
                la = _parse_ts(last_at)
                if la:
                    mins = (_now() - la).total_seconds() / 60.0
                    need = _night_slow_interval_minutes(policy)
                    if mins < need * 0.95:
                        return False, "night_slow_interval"
    elif action_type in ("group_greeting",) and in_night_slow_mode(policy) and not probe:
        pass  # 小组问候夜间慢速也允许
    elif not probe and not in_active_hours(policy) and not _force_run():
        return False, "outside_active_hours"

    if not platform_enabled(platform, policy):
        return False, "platform_disabled"

    if action_type not in ACTION_TYPES:
        return False, "invalid_action_type"

    wave_id = str(action.get("wave_id") or "")
    if wave_id and not _force_run() and not probe:
        allowed = adjacent_wave_ids()
        if allowed and wave_id not in allowed:
            return False, "outside_wave_window"

    if action_type == "reply" and action.get("approval") == "needs_ceo":
        return False, "needs_ceo_approval"

    not_before = action.get("not_before", "")
    skip_not_before = probe or (
        action_type == "browse_feed"
        and in_night_slow_mode(policy)
        and not any_market_awake(policy)
    )
    if not_before and not _force_run() and not skip_not_before:
        nb = _parse_ts(not_before)
        if nb and _now() < nb:
            return False, "not_yet_due"

    last_key = f"{platform}:{action_type}"
    last_at = state.get("last_action_at", {}).get(last_key)
    if last_at:
        la = _parse_ts(last_at)
        if la:
            elapsed = (_now() - la).total_seconds()
            if probe:
                need_sec = _random_interval_seconds(policy, platform)
                if elapsed < need_sec * 0.8:
                    return False, "interval_not_elapsed"
            else:
                mins = elapsed / 60.0
                need = _random_interval_minutes(policy, platform)
                if mins < need * 0.8:
                    return False, "interval_not_elapsed"

    if not probe:
        counts = state.get("counts", {}).get(platform, {})
        limits = _platform_limits(platform, policy)
        fb_grp = _fb_group_limits(policy)

        if action_type == "post":
            if action.get("target_type", "profile") == "profile":
                disabled, until = timeline_posts_disabled(policy)
                if disabled:
                    return False, f"timeline_disabled_until_{until}"
                cap = fb_grp["timeline"]
            else:
                cap = _policy_cap(limits.get("max_posts_per_day"), 1)
            if counts.get("post", 0) >= cap:
                return False, "daily_post_cap"
        elif action_type == "group_join":
            if counts.get("group_join", 0) >= fb_grp["joins"]:
                return False, "daily_group_join_cap"
        elif action_type == "group_greeting":
            if counts.get("group_greeting", 0) >= fb_grp["greetings"]:
                return False, "daily_group_greeting_cap"
        elif action_type == "group_comment":
            hour_key = _now().strftime("%Y-%m-%dT%H")
            hourly = (state.get("hourly_comments") or {}).get(platform, {})
            hour_count = hourly.get(hour_key, 0)
            cap = _policy_cap(limits.get("max_comments_per_hour"), 2)
            if hour_count >= cap and cap < UNLIMITED_CAP:
                return False, "hourly_comment_cap"
            if counts.get("group_comment", 0) >= fb_grp["comments"]:
                return False, "daily_group_comment_cap"
        elif action_type == "comment":
            hour_key = _now().strftime("%Y-%m-%dT%H")
            hourly = (state.get("hourly_comments") or {}).get(platform, {})
            hour_count = hourly.get(hour_key, 0)
            cap = _policy_cap(limits.get("max_comments_per_hour"), 3)
            if hour_count >= cap and cap < UNLIMITED_CAP:
                return False, "hourly_comment_cap"
            if counts.get("comment", 0) >= 12:
                return False, "daily_comment_cap"
        elif action_type == "follow":
            cap = _policy_cap(limits.get("max_follows_per_day"), 15)
            if counts.get("follow", 0) >= cap:
                return False, "daily_follow_cap"
        elif action_type == "reply":
            cap = _policy_cap(limits.get("max_dms_per_day"), 5)
            if counts.get("reply", 0) >= max(cap, 3):
                return False, "daily_reply_cap"
        elif action_type == "browse_feed":
            browse_cfg = policy.get("browse_feed") or {}
            cap = _policy_cap(browse_cfg.get("sessions_per_day"), 2)
            if counts.get("browse_feed", 0) >= cap:
                return False, "daily_browse_cap"
    elif action_type == "post" and action.get("target_type", "profile") == "profile":
        disabled, until = timeline_posts_disabled(policy)
        if disabled:
            return False, f"timeline_disabled_until_{until}"

    try:
        from customer_gateway.social_session import is_logged_in
        if not is_logged_in(platform):
            return False, "needs_login"
    except Exception:
        return False, "session_check_failed"

    return True, "ok"


def _parse_ts(value: str) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M UTC", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _increment_count(state: dict[str, Any], platform: str, action_type: str) -> None:
    counts = state.setdefault("counts", {}).setdefault(platform, {})
    counts[action_type] = int(counts.get(action_type, 0)) + 1
    if action_type in ("comment", "group_comment"):
        hour_key = _now().strftime("%Y-%m-%dT%H")
        hourly = state.setdefault("hourly_comments", {}).setdefault(platform, {})
        hourly[hour_key] = int(hourly.get(hour_key, 0)) + 1
    state.setdefault("last_action_at", {})[f"{platform}:{action_type}"] = _now_str()


def _execute_action(action: dict[str, Any]) -> dict[str, Any]:
    platform = action.get("platform", "")
    action_type = action.get("action_type", "")
    content = action.get("content", "")

    try:
        if action_type == "post":
            link = "https://asia-power.com/half-cuts/"
            images = action.get("image_urls") or _scheme_images(action.get("scheme_id", "A"))
            caption = action.get("caption_short") or content
            if action.get("target_type") == "group" and platform == "facebook":
                from integrations.social_browser.platform_adapter import post_facebook_group_browser
                result = post_facebook_group_browser(
                    group_url=action.get("group_url", ""),
                    message=caption,
                    link=link,
                    image_urls=images,
                )
            else:
                from customer_gateway.social_autopilot import _publish_one
                item = {
                    "platform": platform,
                    "post_content": caption,
                    "caption_short": caption,
                    "listing_url": link,
                    "scheme_id": action.get("scheme_id", "A"),
                    "image_urls": images,
                }
                result = _publish_one(item)
                if result.get("ok"):
                    result = {"ok": True, "post_url": result.get("post_url"), "method": result.get("method")}

        elif action_type == "comment":
            from integrations.social_browser.platform_adapter import engage_comment_browser
            result = engage_comment_browser(
                platform,
                search_query=action.get("search_query", ""),
                text=content,
            )

        elif action_type == "follow":
            from integrations.social_browser.platform_adapter import engage_follow_browser
            result = engage_follow_browser(
                platform,
                search_query=action.get("search_query", ""),
            )

        elif action_type == "reply":
            from integrations.social_browser.platform_adapter import engage_reply_browser
            result = engage_reply_browser(
                platform,
                post_url=action.get("post_url", ""),
                text=content,
            )

        elif action_type == "group_join":
            from integrations.social_browser.facebook_groups import join_group, search_groups

            if action.get("search_query") and not action.get("group_url"):
                search_groups(action.get("search_query"))
            result = join_group(action.get("group_url", ""))

        elif action_type == "group_greeting":
            from integrations.social_browser.facebook_groups import post_group_greeting

            result = post_group_greeting(
                action.get("group_url", ""),
                action.get("content") or _greeting_content(load_policy()),
            )

        elif action_type == "group_comment":
            from integrations.social_browser.platform_adapter import engage_comment_browser

            result = engage_comment_browser(
                "facebook",
                search_query=action.get("group_name") or action.get("group_url", ""),
                text=content,
            )

        elif action_type == "browse_feed":
            from integrations.social_browser.facebook_feed_research import browse_friends_feed

            mins = action.get("session_minutes")
            deep = bool(action.get("deep") or os.getenv("APSALES_FB_BROWSE_DEEP", "0").strip() == "1")
            max_posts = action.get("max_posts")
            max_friends = action.get("max_friends")
            result = browse_friends_feed(
                session_minutes=int(mins) if mins else None,
                allow_comment=bool(action.get("allow_comment")),
                deep=deep,
                max_posts=int(max_posts) if max_posts else None,
                max_friends=int(max_friends) if max_friends else None,
            )
        else:
            return {"ok": False, "error": f"unknown action {action_type}"}

        if result.get("ok"):
            return {"ok": True, **result}
        return {"ok": False, "error": result.get("error", "execution_failed"), "raw": result}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def _record_engagement_event(action: str, *, summary: str, details: dict[str, Any] | None = None) -> None:
    try:
        from customer_gateway.distribution_progress import _append_timeline, load_progress, save_progress
        progress = load_progress()
        _append_timeline(progress, action=action, summary=summary, details=details or {})
        progress["last_verified_action_at"] = _now_str()
        metrics = progress.setdefault("metrics", {})
        key = f"engagement_{action.split('_')[-1] if '_' in action else 'actions'}"
        if action.startswith("engagement_"):
            short = action.replace("engagement_", "")
            mkey = f"engagement_{short}"
            metrics[mkey] = int(metrics.get(mkey, 0)) + 1
        save_progress(progress)
    except Exception:
        pass


def _pending_for_platform(queue: list[dict[str, Any]], platform: str) -> list[dict[str, Any]]:
    plat = platform.lower()
    rows = [
        a for a in queue
        if isinstance(a, dict)
        and a.get("status") == "pending"
        and str(a.get("platform") or "").lower() == plat
    ]
    rows.sort(key=lambda a: (a.get("alternate_index") is None, a.get("alternate_index", 0), a.get("not_before") or ""))
    return rows


def _try_execute_one(action: dict[str, Any], *, policy: dict[str, Any], state: dict[str, Any], probe: bool) -> tuple[dict[str, Any] | None, str]:
    """Run one queue action; mutates action + state. Returns (result_row, stopped_reason)."""
    cap_reasons = {
        "daily_post_cap", "hourly_comment_cap", "daily_follow_cap", "daily_comment_cap",
        "daily_group_join_cap", "daily_group_greeting_cap", "daily_group_comment_cap",
        "daily_browse_cap", "daily_reply_cap",
    }
    ok, reason = can_run_action(action, policy)
    if not ok:
        if not probe and reason in cap_reasons:
            return None, reason
        if probe and reason.startswith("platform_block"):
            return None, ""
        return None, ""

    outcome = _execute_action(action)
    action["executed_at"] = _now_str()
    if outcome.get("ok"):
        action["status"] = "completed"
        action["result_url"] = outcome.get("post_url") or outcome.get("target_url") or ""
        _increment_count(state, action.get("platform", ""), action.get("action_type", ""))
        type_label = {
            "post": "发帖", "comment": "评论", "follow": "关注", "reply": "回复",
            "browse_feed": "浏览动态", "group_join": "加入小组", "group_greeting": "小组问候",
            "group_comment": "小组评论",
        }.get(action.get("action_type", ""), action.get("action_type", ""))
        plat = str(action.get("platform") or "?")
        plat_tag = "FB" if plat == "facebook" else ("X" if plat == "x" else plat)
        _record_engagement_event(
            f"engagement_{action.get('action_type', 'action')}",
            summary=f"FB↔X · {plat_tag} {type_label} · {action.get('market', 'Africa')}",
            details={**action, **outcome, "alternate_mode": True},
        )
        return {"action_id": action.get("action_id"), **outcome}, ""
    action["status"] = "failed"
    action["error"] = outcome.get("error", "unknown")
    if outcome.get("error") in ("rate_limited", "blocked"):
        if probe:
            try:
                from customer_gateway.fb_platform_limits import record_platform_block

                record_platform_block(
                    action.get("action_type", ""),
                    str(outcome.get("error") or "rate_limited"),
                )
            except Exception:
                pass
            return {"action_id": action.get("action_id"), **outcome}, ""
        record_timeline_rate_limit()
        return {"action_id": action.get("action_id"), **outcome}, outcome.get("error", "")
    return {"action_id": action.get("action_id"), **outcome}, ""


def execute_alternate_cycle(*, max_pairs: int = 1, max_actions: int | None = None) -> dict[str, Any]:
    """Run FB → X → … pairs: each pair = 1 Facebook + 1 X action when available."""
    if os.getenv("APSALES_SOCIAL_ENGAGEMENT", "0").strip() != "1":
        return {"skipped": True, "reason": "APSALES_SOCIAL_ENGAGEMENT!=1"}

    policy = load_policy()
    probe = _platform_block_only(policy)
    state = load_state()
    queue = load_queue()

    if max_actions is not None:
        max_pairs = max(1, (max_actions + 1) // 2)
    else:
        env_pairs = os.getenv("APSALES_SOCIAL_ALTERNATE_MAX_PAIRS", "").strip()
        if env_pairs:
            max_pairs = max(1, int(env_pairs))

    from customer_gateway.zijing_activity_stream import log_step_end, log_step_start

    log_step_start(
        "alternate_run",
        f"FB↔X 交替 · {max_pairs} 对（最多 {max_pairs * 2} 步）",
        platform="fb+x",
    )

    results: list[dict[str, Any]] = []
    executed = 0
    stopped_reason = ""
    sequence: list[dict[str, str]] = []

    for pair_idx in range(max_pairs):
        for platform in ("facebook", "x"):
            if not platform_enabled(platform, policy):
                continue
            pending = _pending_for_platform(queue, platform)
            ran = False
            for action in pending:
                row, stop = _try_execute_one(action, policy=policy, state=state, probe=probe)
                if stop and not probe:
                    stopped_reason = stop
                    break
                if row is None:
                    continue
                results.append(row)
                executed += 1
                ran = True
                plat_tag = "FB" if platform == "facebook" else "X"
                sequence.append({
                    "step": str(executed),
                    "platform": platform,
                    "label": f"{plat_tag} · {action.get('action_type', '?')}",
                })
                break
            if stopped_reason:
                break
        if stopped_reason:
            break

    save_queue(queue)
    save_state(state)

    pending_left = sum(1 for a in queue if a.get("status") == "pending")
    completed = sum(1 for a in queue if a.get("status") == "completed")
    preview = preview_alternate_sequence(10)

    log_step_end(
        "alternate_run",
        f"完成 {executed} 步 · 序列 {' → '.join(s['label'] for s in sequence) or '—'}",
        platform="fb+x",
        status="completed" if executed else "idle",
    )

    return {
        "ran_at": _now_str(),
        "alternate_mode": True,
        "pairs_requested": max_pairs,
        "executed": executed,
        "sequence": sequence,
        "next_10": preview,
        "results": results,
        "pending": pending_left,
        "completed_today": completed,
        "stopped_reason": stopped_reason,
        "wave_context": wave_context(),
    }


def execute_due_actions(*, max_actions: int | None = None) -> dict[str, Any]:
    """Run up to N due actions respecting rate limits."""
    policy = load_policy()
    if _alternate_mode_enabled(policy):
        return execute_alternate_cycle(max_actions=max_actions)

    if os.getenv("APSALES_SOCIAL_ENGAGEMENT", "0").strip() != "1":
        return {"skipped": True, "reason": "APSALES_SOCIAL_ENGAGEMENT!=1"}
    probe = _platform_block_only(policy)
    state = load_state()
    queue = load_queue()
    if max_actions is not None:
        limit = max_actions
    elif probe:
        limit = UNLIMITED_CAP
    else:
        env_limit = os.getenv("APSALES_SOCIAL_ENGAGEMENT_MAX_PER_RUN", "").strip()
        if env_limit:
            limit = int(env_limit)
        else:
            sched = (policy.get("scheduling") or {})
            limit = int(sched.get("actions_per_run") or 4)

    results: list[dict[str, Any]] = []
    executed = 0
    stopped_reason = ""
    cap_reasons = {
        "daily_post_cap", "hourly_comment_cap", "daily_follow_cap", "daily_comment_cap",
        "daily_group_join_cap", "daily_group_greeting_cap", "daily_group_comment_cap",
        "daily_browse_cap", "daily_reply_cap",
    }

    for action in queue:
        if executed >= limit:
            break
        if action.get("status") != "pending":
            continue

        ok, reason = can_run_action(action, policy)
        if not ok:
            if not probe and reason in cap_reasons:
                stopped_reason = reason
                break
            if probe and reason.startswith("platform_block"):
                continue
            continue

        outcome = _execute_action(action)
        action["executed_at"] = _now_str()
        if outcome.get("ok"):
            action["status"] = "completed"
            action["result_url"] = outcome.get("post_url") or outcome.get("target_url") or ""
            _increment_count(state, action.get("platform", ""), action.get("action_type", ""))
            executed += 1
            type_label = {
                "post": "发帖",
                "comment": "评论",
                "follow": "关注",
                "reply": "回复",
                "browse_feed": "浏览动态",
                "group_join": "加入小组",
                "group_greeting": "小组问候",
                "group_comment": "小组评论",
            }.get(action.get("action_type", ""), action.get("action_type", ""))
            _record_engagement_event(
                f"engagement_{action.get('action_type', 'action')}",
                summary=f"{type_label} · {action.get('platform', '?')} · {action.get('market', 'Africa')}",
                details={**action, **outcome},
            )
        else:
            action["status"] = "failed"
            action["error"] = outcome.get("error", "unknown")
            if outcome.get("error") in ("rate_limited", "blocked"):
                if probe:
                    try:
                        from customer_gateway.fb_platform_limits import record_platform_block

                        record_platform_block(
                            action.get("action_type", ""),
                            str(outcome.get("error") or "rate_limited"),
                        )
                    except Exception:
                        pass
                    continue
                record_timeline_rate_limit()
                stopped_reason = outcome.get("error", "")
                break

        results.append({"action_id": action.get("action_id"), **outcome})

    save_queue(queue)
    save_state(state)

    pending = sum(1 for a in queue if a.get("status") == "pending")
    completed = sum(1 for a in queue if a.get("status") == "completed")

    return {
        "ran_at": _now_str(),
        "executed": executed,
        "results": results,
        "pending": pending,
        "completed_today": completed,
        "stopped_reason": stopped_reason,
        "in_active_hours": in_active_hours(policy),
        "in_night_slow_mode": in_night_slow_mode(policy),
        "markets": get_markets_status(policy),
        "wave_context": wave_context(),
    }


def run_engagement_cycle(*, plan: bool = True, execute: bool = True) -> dict[str, Any]:
    out: dict[str, Any] = {"ran_at": _now_str(), "wave_context": wave_context()}
    state = load_state()
    now = _now()
    regen = load_market_timeline().get("regeneration") or {}
    regen_hour = int(regen.get("utc_hour") or 0)
    regen_min = int(regen.get("utc_minute") or 0)
    if plan and now.hour == regen_hour and regen_min <= now.minute < regen_min + 30:
        if not state.get("planned_at", "").startswith(_today()):
            plan_daily_actions(force=True)
        elif state.get("timeline_version") != load_market_timeline().get("version"):
            plan_daily_actions(force=True)
    if plan:
        out["plan"] = plan_daily_actions()
    if execute:
        out["execute"] = execute_due_actions()
    out["queue_summary"] = get_today_summary()
    out["wave_context"] = wave_context()
    return out


def _platform_limits_summary_safe() -> dict[str, Any]:
    try:
        from customer_gateway.fb_platform_limits import get_limits_summary

        return get_limits_summary()
    except Exception:
        return {}


def get_browse_summary() -> dict[str, Any]:
    try:
        from integrations.social_browser.facebook_feed_research import get_browse_summary as _fb_summary

        return _fb_summary()
    except Exception:
        state = _load_json(BROWSE_STATE_FILE, {})
        total = 0
        if RESEARCH_NOTES_FILE.is_file():
            try:
                total = sum(1 for line in RESEARCH_NOTES_FILE.read_text(encoding="utf-8").splitlines() if line.strip())
            except OSError:
                pass
        return {
            "last_session_at": state.get("last_session_at") if isinstance(state, dict) else None,
            "total_notes": total,
        }


def get_today_summary() -> dict[str, Any]:
    queue = load_queue()
    state = load_state()
    policy = load_policy()
    by_platform: dict[str, dict[str, int]] = {}
    for p in ENGAGEMENT_PLATFORMS:
        by_platform[p] = {"pending": 0, "completed": 0, "failed": 0}
        for a in queue:
            if a.get("platform") != p:
                continue
            st = a.get("status", "pending")
            by_platform[p][st if st in ("pending", "completed", "failed") else "pending"] = (
                by_platform[p].get(st if st in ("pending", "completed", "failed") else "pending", 0) + 1
            )
    return {
        "date": _today(),
        "planned_at": state.get("planned_at"),
        "counts": state.get("counts", {}),
        "by_platform": by_platform,
        "instagram_status": "paused_today" if not platform_enabled("instagram", policy) else "enabled",
        "in_active_hours": in_active_hours(policy),
        "in_night_slow_mode": in_night_slow_mode(policy),
        "platform_probe_mode": _platform_block_only(policy),
        "alternate_mode": _alternate_mode_enabled(policy),
        "next_alternate_sequence": preview_alternate_sequence(10),
        "platform_limits": _platform_limits_summary_safe(),
        "markets": get_markets_status(policy),
        "wave_context": wave_context(),
        "next_market_wake_utc": (
            next_market_wake_utc(policy).strftime("%Y-%m-%d %H:%M UTC")
            if next_market_wake_utc(policy)
            else None
        ),
        "browse_feed": get_browse_summary(),
        "browse_enabled": browse_feed_enabled(policy),
        "in_browse_hours": in_browse_hours(policy),
    }
