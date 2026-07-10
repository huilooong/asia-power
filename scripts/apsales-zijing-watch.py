#!/usr/bin/env python3
"""子敬 · 社媒工作状态看板 — CEO 终端实时监控（单次刷新，配合 while/sleep 循环）."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

QUEUE_FILE = ROOT / "memory" / "customer_gateway" / "apsales_social_engagement_queue.json"
PROGRESS_FILE = ROOT / "memory" / "customer_gateway" / "apsales_distribution_progress.json"
REPLY_STATE_FILE = ROOT / "memory" / "customer_gateway" / "social_reply_watch_state.json"
BROWSE_STATE_FILE = ROOT / "memory" / "customer_gateway" / "social_browse_state.json"
FB_DM_STATE_FILE = ROOT / "memory" / "customer_gateway" / "fb_friend_dm_state.json"
FB_DM_LOG_FILE = ROOT / "memory" / "customer_gateway" / "fb_friend_dm_log.jsonl"
RESEARCH_NOTES_FILE = ROOT / "memory" / "customer_gateway" / "social_research_notes.jsonl"
POLICY_FILE = ROOT / "config" / "apsales_social_engagement_policy.yaml"
DASHBOARD_URL = "https://asia-power.com/admin/apsales-progress.html"

PLATFORM_ORDER = ("facebook", "x", "instagram")
PLATFORM_LABELS = {"facebook": "Facebook", "x": "X", "instagram": "Instagram"}
ACTION_LABELS = {
    "post": "发帖",
    "comment": "评论",
    "follow": "关注",
    "reply": "回复",
    "browse_feed": "浏览动态",
    "friend_dm": "好友私信",
    "group_join": "加入小组",
    "group_greeting": "小组问候",
    "group_comment": "小组评论",
    "group_actions": "小组动作",
    "post_published": "发帖",
    "engagement_planned": "计划",
    "engagement_browse_feed": "浏览动态",
    "engagement_group_join": "加入小组",
    "engagement_group_greeting": "小组问候",
    "engagement_group_comment": "小组评论",
    "planned": "计划",
    "scan_done": "扫描",
    "followup_drafted": "草稿",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_str() -> str:
    return _now().strftime("%Y-%m-%d %H:%M UTC")


def _load_json(path: Path, default: object) -> object:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _box(title: str, lines: list[str], width: int = 72) -> list[str]:
    inner = max(width - 4, len(title) + 2)
    bar = "─" * inner
    out = [f"┌─ {title} {bar[len(title) + 3:]}"]
    for line in lines:
        text = line if line else ""
        if len(text) > inner:
            text = text[: inner - 1] + "…"
        out.append(f"│ {text:<{inner}} │")
    out.append(f"└{'─' * (inner + 1)}┘")
    return out


def _load_session_status() -> dict[str, Any]:
    try:
        from customer_gateway.social_session import get_all_session_status

        return get_all_session_status()
    except Exception:
        return {"platforms": {}, "any_ready": False, "updated_at": ""}


def _load_engagement_summary() -> dict[str, Any]:
    try:
        from customer_gateway.social_engagement_engine import get_today_summary

        return get_today_summary()
    except Exception:
        queue = _load_json(QUEUE_FILE, [])
        totals = {"pending": 0, "completed": 0, "failed": 0}
        if isinstance(queue, list):
            for item in queue:
                if not isinstance(item, dict):
                    continue
                st = item.get("status", "pending")
                if st not in totals:
                    st = "pending"
                totals[st] += 1
        return {
            "date": _now().strftime("%Y-%m-%d"),
            "by_platform": {
                "facebook": dict(totals),
                "x": {"pending": 0, "completed": 0, "failed": 0},
            },
            "in_active_hours": False,
        }


def _load_policy_hours() -> tuple[str, str, str]:
    try:
        from customer_gateway.social_engagement_engine import (
            any_market_awake,
            get_markets_status,
            in_night_slow_mode,
            load_policy,
        )

        policy = load_policy()
        markets = get_markets_status(policy)
        awake_names = [f"{m.get('flag', '')}{m.get('display', '')}" for m in markets if m.get("awake")]
        if awake_names:
            note = "营业中: " + " · ".join(awake_names)
        elif in_night_slow_mode(policy):
            note = "夜间慢速 — 全球市场休眠，情报浏览继续"
        else:
            note = "全球市场休眠"
        return "多市场", "本地窗", note
    except Exception:
        return "08:00", "20:00", "UTC 工作时段"


def _in_active_hours() -> bool:
    try:
        from customer_gateway.social_engagement_engine import any_market_awake, in_night_slow_mode

        return any_market_awake() or in_night_slow_mode()
    except Exception:
        return False


def _markets_payload() -> list[dict[str, Any]]:
    try:
        from customer_gateway.social_engagement_engine import get_markets_status, in_night_slow_mode, next_market_wake_utc

        markets = get_markets_status()
        for m in markets:
            m["badge"] = (
                f"{m.get('flag', '')} {m.get('display', '')} ✅ 营业中"
                if m.get("awake")
                else f"{m.get('flag', '')} {m.get('display', '')} ❌ 休眠"
            )
        return markets
    except Exception:
        return []


def _queue_totals(summary: dict[str, Any]) -> dict[str, int]:
    by_platform = summary.get("by_platform") or {}
    totals = {"pending": 0, "completed": 0, "failed": 0}
    for plat in by_platform.values():
        if not isinstance(plat, dict):
            continue
        for key in totals:
            totals[key] += int(plat.get(key, 0))
    return totals


def _last_actions(limit: int = 5) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []

    queue = _load_json(QUEUE_FILE, [])
    if isinstance(queue, list):
        for item in queue:
            if not isinstance(item, dict):
                continue
            if item.get("status") not in ("completed", "failed"):
                continue
            ts = item.get("executed_at") or item.get("not_before") or ""
            actions.append(
                {
                    "at": ts,
                    "platform": item.get("platform", "?"),
                    "type": item.get("action_type", "?"),
                    "status": item.get("status", ""),
                    "source": "queue",
                }
            )

    progress = _load_json(PROGRESS_FILE, {})
    if isinstance(progress, dict):
        for item in progress.get("timeline") or []:
            if not isinstance(item, dict):
                continue
            action = item.get("action") or ""
            if not action.startswith("engagement_") and action not in (
                "post_published",
                "engagement_post",
                "engagement_comment",
                "engagement_follow",
                "engagement_reply",
                "scan_done",
                "followup_drafted",
            ):
                continue
            details = item.get("details") if isinstance(item.get("details"), dict) else {}
            actions.append(
                {
                    "at": item.get("at") or "",
                    "platform": details.get("platform") or item.get("platform") or "?",
                    "type": action.replace("engagement_", "") if action.startswith("engagement_") else action,
                    "status": "completed",
                    "source": "progress",
                    "summary": item.get("summary") or "",
                }
            )

    actions.sort(key=lambda r: r.get("at") or "", reverse=True)
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in actions:
        key = f"{row.get('at')}|{row.get('platform')}|{row.get('type')}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
        if len(unique) >= limit:
            break
    return unique


def _next_pending_action() -> dict[str, Any] | None:
    queue = _load_json(QUEUE_FILE, [])
    if not isinstance(queue, list):
        return None
    pending = [x for x in queue if isinstance(x, dict) and x.get("status") == "pending"]
    if not pending:
        return None
    pending.sort(key=lambda a: a.get("not_before") or "")
    return pending[0]


def _why_waiting(summary: dict[str, Any], sessions: dict[str, Any]) -> list[str]:
    """Explain why engagement is paused (CEO-friendly)."""
    reasons: list[str] = []
    force = False
    try:
        import os

        force = os.getenv("APSALES_SOCIAL_FORCE_RUN", "0").strip() == "1"
    except Exception:
        pass

    any_awake = False
    night_slow = False
    try:
        from customer_gateway.social_engagement_engine import any_market_awake, in_night_slow_mode

        any_awake = any_market_awake()
        night_slow = in_night_slow_mode()
    except Exception:
        any_awake = summary.get("in_active_hours") if summary.get("in_active_hours") is not None else _in_active_hours()

    try:
        from customer_gateway.social_engagement_engine import get_markets_status

        for m in get_markets_status():
            flag = m.get("flag") or ""
            name = m.get("display") or m.get("label") or "?"
            if m.get("awake"):
                reasons.append(f"{flag} {name} ✅ 营业中（本地 {m.get('local_time', '?')}）")
            else:
                reasons.append(f"{flag} {name} ❌ 休眠（本地 {m.get('local_time', '?')}）")
    except Exception:
        pass

    if night_slow and not any_awake:
        reasons.append("🌙 夜间慢速模式 — 浏览好友/情报收集继续（每 2 小时最多 1 次）")

    if not any_awake and not night_slow and not force:
        try:
            from customer_gateway.social_engagement_engine import next_market_wake_utc

            wake = next_market_wake_utc()
            if wake:
                reasons.append(f"⏸ 全部市场休眠 — 下一市场营业 ≈ {wake.strftime('%Y-%m-%d %H:%M UTC')}")
        except Exception:
            reasons.append("⏸ 全部市场休眠 — 等待下一市场营业")

    platforms = sessions.get("platforms") or {}
    for key in ("facebook", "x"):
        info = platforms.get(key) or {}
        if not info.get("logged_in"):
            label = PLATFORM_LABELS.get(key, key)
            reasons.append(f"🔐 {label} 未登录 — 需子敬跑一次 apsales-social-login.py")

    next_action = _next_pending_action()
    if next_action:
        nb = next_action.get("not_before") or ""
        plat = PLATFORM_LABELS.get(str(next_action.get("platform", "")).lower(), next_action.get("platform", "?"))
        type_label = _normalize_action_type(str(next_action.get("action_type", "?")))
        if nb and not force:
            try:
                from customer_gateway.social_engagement_engine import _parse_ts

                nb_dt = _parse_ts(nb)
                if nb_dt and _now() < nb_dt:
                    reasons.append(f"⏳ 下一条计划动作：{plat} {type_label} · 最早 {nb[:16]}")
            except Exception:
                reasons.append(f"⏳ 下一条计划动作：{plat} {type_label} · 最早 {nb[:16]}")
        elif not reasons:
            reasons.append(f"▶ 下一条待执行：{plat} {type_label}（cron 每 30 分钟会尝试）")

    state = _load_json(ROOT / "memory" / "customer_gateway" / "apsales_social_engagement_state.json", {})
    if isinstance(state, dict) and state.get("planned_at"):
        reasons.append(f"📋 今日计划 {state.get('planned_count', '—')} 条 · 制定于 {_short_ts(str(state.get('planned_at', '')))}")

    if not reasons:
        totals = _queue_totals(summary)
        if totals.get("pending", 0) == 0:
            reasons.append("✅ 今日队列已全部执行完毕")
        else:
            reasons.append("▶ 在工作时段内，cron 将按节奏自动执行")
    return reasons


def _next_cron_runs() -> list[str]:
    now = _now()
    minute = now.minute
    if minute < 30:
        next_autopilot = now.replace(minute=30, second=0, microsecond=0)
    else:
        next_autopilot = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

    next_reply = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    if now.minute == 0 and now.second < 30:
        next_reply = now.replace(minute=0, second=0, microsecond=0)

    return [
        f"Autopilot（发帖+互动）≈ {next_autopilot.strftime('%H:%M UTC')} · 每 30 分钟",
        f"回复扫描提醒 ≈ {next_reply.strftime('%H:%M UTC')} · 每小时整点",
    ]


def _reply_watch_line() -> str:
    state = _load_json(REPLY_STATE_FILE, {})
    if not isinstance(state, dict) or not state:
        return "回复扫描：暂无运行记录（等 cron 或手动跑 apsales-social-reply-watch.py）"
    parts = [
        f"上次扫描 {_short_ts(state.get('last_run', '—'))}",
        f"待扫帖 {state.get('due_posts', 0)}",
        f"待跟进 {state.get('pending_replies', 0)}",
        f"已起草 {state.get('drafted', 0)}",
    ]
    return "回复扫描 · " + " · ".join(str(p) for p in parts)


def _progress_line() -> str:
    progress = _load_json(PROGRESS_FILE, {})
    if not isinstance(progress, dict) or not progress:
        return "分销进度：暂无记录（生产 cron 跑起来后会写入）"
    last = progress.get("last_verified_action_at") or "尚无"
    updated = progress.get("updated_at") or "—"
    return f"分销进度 · 最后验证动作 {_short_ts(last)} · 文件更新 {_short_ts(updated)}"


def _short_ts(value: str) -> str:
    text = str(value or "—").strip()
    if len(text) >= 16:
        return text[:16]
    return text or "—"


def _normalize_action_type(raw: str) -> str:
    key = (raw or "?").strip().lower()
    if key.startswith("engagement_"):
        key = key.replace("engagement_", "", 1)
    return ACTION_LABELS.get(key, ACTION_LABELS.get(raw, raw or "?"))


def _format_action_row(row: dict[str, Any]) -> str:
    plat_key = str(row.get("platform", "")).lower()
    plat = PLATFORM_LABELS.get(plat_key, row.get("platform", "?"))
    if plat in ("?", "—", "") and row.get("summary"):
        plat = "—"
    type_label = _normalize_action_type(str(row.get("type", "?")))
    status = row.get("status", "")
    mark = "✅" if status == "completed" else ("❌" if status == "failed" else "·")
    ts = _short_ts(str(row.get("at", "")))
    extra = row.get("summary") or ""
    if extra and len(extra) > 28:
        extra = extra[:27] + "…"
    suffix = f" · {extra}" if extra else ""
    return f"{ts}  {mark}  {plat:<10}  {type_label}{suffix}"


def _browse_feed_line(summary: dict[str, Any]) -> list[str]:
    browse = summary.get("browse_feed") or {}
    if not browse and BROWSE_STATE_FILE.is_file():
        browse = _load_json(BROWSE_STATE_FILE, {})
        if isinstance(browse, dict):
            total = 0
            if RESEARCH_NOTES_FILE.is_file():
                try:
                    total = sum(1 for line in RESEARCH_NOTES_FILE.read_text(encoding="utf-8").splitlines() if line.strip())
                except OSError:
                    pass
            browse = {
                "last_session_at": browse.get("last_session_at"),
                "last_duration_minutes": browse.get("duration_minutes"),
                "last_notes_saved": browse.get("notes_saved", 0),
                "total_notes": total,
            }
    enabled = summary.get("browse_enabled")
    in_browse = summary.get("in_browse_hours")
    engine_leads = browse.get("last_engine_leads", 0)
    total_engine = browse.get("total_engine_leads", 0)
    lines = [
        f"上次浏览 {_short_ts(str(browse.get('last_session_at') or '—'))} · "
        f"{browse.get('last_duration_minutes') or '—'} 分钟 · "
        f"情报 {browse.get('last_intel_saved', browse.get('last_notes_saved', 0))} 条",
        f"今晚发动机线索 {engine_leads} 条 · 累计 {total_engine} 条 · fb_friends_market_intel.jsonl",
    ]
    if enabled is False:
        lines.append("⏸ 浏览功能未启用（policy browse_feed.enabled）")
    elif in_browse:
        lines.append("✅ 当前在浏览时段（UTC 20:00–08:00 · Mac 本地）")
    else:
        lines.append("⏸ 当前非浏览时段 — 发帖时段优先")
    lines.append("Mac 一键：docs/一键运行-FB浏览好友动态.command")
    return lines


def _load_fb_dm_stats() -> dict[str, Any]:
    try:
        from integrations.social_browser.facebook_messenger import get_dm_stats, load_dm_policy

        stats = get_dm_stats()
        policy = load_dm_policy()
        state = _load_json(FB_DM_STATE_FILE, {})
        last_run = ""
        blocked = False
        if isinstance(state, dict):
            last_run = _short_ts(str(state.get("last_run_at") or ""))
            blocked = bool(state.get("blocked"))
        return {
            "sent_today": stats.get("sent_today", 0),
            "remaining_today": stats.get("remaining_today", 0),
            "max_per_day": stats.get("max_per_day", 15),
            "max_per_run": stats.get("max_per_run", 5),
            "total_sent": stats.get("total_sent", 0),
            "last_run_at": last_run or "—",
            "blocked": blocked,
            "enabled": policy.get("enabled", True),
            "log_file": stats.get("log_file", "memory/customer_gateway/fb_friend_dm_log.jsonl"),
        }
    except Exception:
        sent_today = 0
        if FB_DM_LOG_FILE.is_file():
            today = _now().strftime("%Y-%m-%d")
            try:
                for line in FB_DM_LOG_FILE.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    if row.get("status") == "sent" and str(row.get("sent_at", "")).startswith(today):
                        sent_today += 1
            except (json.JSONDecodeError, OSError):
                pass
        return {
            "sent_today": sent_today,
            "remaining_today": max(0, 15 - sent_today),
            "max_per_day": 15,
            "max_per_run": 5,
            "total_sent": 0,
            "last_run_at": "—",
            "blocked": False,
            "enabled": True,
            "log_file": "memory/customer_gateway/fb_friend_dm_log.jsonl",
        }


def build_live_status() -> dict[str, Any]:
    """Structured JSON for web live dashboard + API."""
    sessions = _load_session_status()
    summary = _load_engagement_summary()
    totals = _queue_totals(summary)
    start_h, end_h, tz_note = _load_policy_hours()
    markets = summary.get("markets") or _markets_payload()
    any_awake = any(m.get("awake") for m in markets)
    night_slow = False
    next_wake = None
    try:
        from customer_gateway.social_engagement_engine import in_night_slow_mode, next_market_wake_utc

        night_slow = in_night_slow_mode()
        wake_dt = next_market_wake_utc()
        next_wake = wake_dt.strftime("%Y-%m-%d %H:%M UTC") if wake_dt else None
        if not any_awake:
            any_awake = any(m.get("awake") for m in (summary.get("markets") or _markets_payload()))
    except Exception:
        pass
    if any_awake:
        active_label = "✅ 有市场营业中 — 全速互动"
    elif night_slow:
        active_label = "🌙 夜间慢速 — 浏览/情报继续"
    else:
        active_label = "⏸ 全球市场休眠"

    platforms = sessions.get("platforms") or {}
    login: dict[str, Any] = {}
    for key in PLATFORM_ORDER:
        info = platforms.get(key) or {}
        login[key] = {
            "label": PLATFORM_LABELS.get(key, key),
            "logged_in": bool(info.get("logged_in")),
            "method": info.get("method") or "",
            "account_label": info.get("account_label") or "",
        }

    by_platform = summary.get("by_platform") or {}
    queue_platforms: dict[str, Any] = {}
    for key in ("facebook", "x", "instagram"):
        plat = by_platform.get(key) or {}
        queue_platforms[key] = {
            "label": PLATFORM_LABELS.get(key, key),
            "pending": int(plat.get("pending", 0)),
            "completed": int(plat.get("completed", 0)),
            "failed": int(plat.get("failed", 0)),
        }

    browse = summary.get("browse_feed") or {}
    if not browse and BROWSE_STATE_FILE.is_file():
        raw_browse = _load_json(BROWSE_STATE_FILE, {})
        if isinstance(raw_browse, dict):
            total = 0
            if RESEARCH_NOTES_FILE.is_file():
                try:
                    total = sum(
                        1 for line in RESEARCH_NOTES_FILE.read_text(encoding="utf-8").splitlines() if line.strip()
                    )
                except OSError:
                    pass
            browse = {
                "last_session_at": raw_browse.get("last_session_at"),
                "last_duration_minutes": raw_browse.get("duration_minutes"),
                "last_notes_saved": raw_browse.get("notes_saved", 0),
                "total_notes": total,
            }

    last_actions = []
    for row in _last_actions(10):
        plat_key = str(row.get("platform", "")).lower()
        last_actions.append(
            {
                "at": _short_ts(str(row.get("at", ""))),
                "platform": PLATFORM_LABELS.get(plat_key, row.get("platform", "?")),
                "type": _normalize_action_type(str(row.get("type", "?"))),
                "status": row.get("status", ""),
                "summary": row.get("summary") or "",
            }
        )

    cron_lines = _next_cron_runs()
    cron: list[dict[str, str]] = []
    for line in cron_lines:
        parts = line.split("≈", 1)
        cron.append({"label": parts[0].strip(), "next": parts[1].strip() if len(parts) > 1 else ""})

    reply_state = _load_json(REPLY_STATE_FILE, {})
    reply_watch: dict[str, Any] = {}
    if isinstance(reply_state, dict) and reply_state:
        reply_watch = {
            "last_run": _short_ts(str(reply_state.get("last_run", "—"))),
            "due_posts": reply_state.get("due_posts", 0),
            "pending_replies": reply_state.get("pending_replies", 0),
            "drafted": reply_state.get("drafted", 0),
        }

    progress = _load_json(PROGRESS_FILE, {})
    progress_summary: dict[str, Any] = {}
    if isinstance(progress, dict) and progress:
        progress_summary = {
            "last_verified_action_at": _short_ts(str(progress.get("last_verified_action_at") or "—")),
            "updated_at": _short_ts(str(progress.get("updated_at") or "—")),
        }

    activity_stream: list[dict[str, Any]] = []
    current_action: dict[str, Any] | None = None
    events_per_minute = 0
    try:
        from customer_gateway.zijing_activity_stream import (
            events_per_minute as _epm,
            format_action_label,
            get_current_action,
            read_recent,
        )

        activity_stream = read_recent(50, include_idle=False)
        current_row = get_current_action(within_sec=5)
        if not current_row and activity_stream:
            latest = activity_stream[0]
            if latest.get("action") == "sleep" or latest.get("status") == "sleep":
                current_row = latest
            elif latest.get("action") == "idle":
                current_row = latest
        current_action = {
            "label": format_action_label(current_row),
            "action": (current_row or {}).get("action", "idle"),
            "detail": (current_row or {}).get("detail", ""),
            "platform": (current_row or {}).get("platform", ""),
            "status": (current_row or {}).get("status", "idle"),
            "ts": (current_row or {}).get("ts", ""),
        }
        events_per_minute = _epm(60)
    except Exception:
        current_action = {"label": "—", "action": "idle", "status": "idle"}

    next_action: dict[str, Any] | None = None
    wave_ctx: dict[str, Any] = {}
    try:
        from customer_gateway.social_engagement_engine import get_next_pending_action_summary, wave_context

        next_action = get_next_pending_action_summary()
        wave_ctx = wave_context()
    except Exception:
        try:
            from customer_gateway.social_engagement_engine import get_next_pending_action_summary

            next_action = get_next_pending_action_summary()
        except Exception:
            raw_next = _next_pending_action()
            if raw_next:
                next_action = {
                    "platform": raw_next.get("platform"),
                    "action_type": raw_next.get("action_type"),
                    "not_before": raw_next.get("not_before"),
                    "label": f"下一动作：{raw_next.get('platform', '?')} {raw_next.get('action_type', '?')}",
                }

    platform_probe_mode = False
    platform_limits: dict[str, Any] = {}
    operating_mode: dict[str, Any] = {}
    alternate_mode = False
    next_alternate_sequence: list[dict[str, Any]] = []
    try:
        from customer_gateway.social_engagement_engine import (
            _alternate_mode_enabled,
            _platform_block_only,
            load_policy,
            preview_alternate_sequence,
        )
        from customer_gateway.fb_platform_limits import get_limits_summary, get_operating_mode

        pol = load_policy()
        platform_probe_mode = _platform_block_only(pol)
        platform_limits = get_limits_summary()
        operating_mode = get_operating_mode()
        alternate_mode = _alternate_mode_enabled(pol)
        next_alternate_sequence = preview_alternate_sequence(10)
    except Exception:
        pass

    return {
        "updated_at": _now_str(),
        "dashboard_url": "https://asia-power.com/admin/apsales-zijing-live.html",
        "platform_probe_mode": platform_probe_mode,
        "platform_limits": platform_limits,
        "operating_mode": operating_mode,
        "alternate_mode": alternate_mode,
        "next_alternate_sequence": next_alternate_sequence,
        "login": login,
        "any_session_ready": bool(sessions.get("any_ready")),
        "next_action": next_action,
        "wave_context": wave_ctx,
        "queue": {
            "date": summary.get("date", _now().strftime("%Y-%m-%d")),
            "planned_at": summary.get("planned_at") or "—",
            "totals": totals,
            "by_platform": queue_platforms,
            "instagram_status": summary.get("instagram_status") or "paused_today",
        },
        "browse": {
            "last_session_at": _short_ts(str(browse.get("last_session_at") or "—")),
            "last_duration_minutes": browse.get("last_duration_minutes") or browse.get("duration_minutes"),
            "last_notes_saved": browse.get("last_intel_saved", browse.get("last_notes_saved", 0)),
            "last_intel_saved": browse.get("last_intel_saved", browse.get("last_notes_saved", 0)),
            "last_engine_leads": browse.get("last_engine_leads", 0),
            "total_notes": browse.get("total_intel", browse.get("total_notes", 0)),
            "total_intel": browse.get("total_intel", browse.get("total_notes", 0)),
            "total_engine_leads": browse.get("total_engine_leads", 0),
            "enabled": summary.get("browse_enabled"),
            "in_browse_hours": summary.get("in_browse_hours"),
        },
        "last_actions": last_actions,
        "active_hours": {
            "start": start_h,
            "end": end_h,
            "timezone_note": tz_note,
            "in_active_hours": any_awake,
            "in_night_slow_mode": night_slow,
            "any_market_awake": any_awake,
            "next_market_wake_utc": next_wake,
            "markets": markets,
            "label": active_label,
        },
        "cron": cron,
        "waiting_reasons": _why_waiting(summary, sessions),
        "reply_watch": reply_watch,
        "progress": progress_summary,
        "friend_dm": _load_fb_dm_stats(),
        "current_action": current_action,
        "activity_stream": activity_stream,
        "events_per_minute": events_per_minute,
    }


def render_dashboard() -> str:
    sessions = _load_session_status()
    summary = _load_engagement_summary()
    totals = _queue_totals(summary)
    start_h, end_h, tz_note = _load_policy_hours()
    markets = _markets_payload()
    any_awake = any(m.get("awake") for m in markets)
    night_slow = False
    try:
        from customer_gateway.social_engagement_engine import in_night_slow_mode

        night_slow = in_night_slow_mode()
    except Exception:
        pass
    if any_awake:
        active_label = "✅ 有市场营业中 — 全速互动"
    elif night_slow:
        active_label = "🌙 夜间慢速 — 浏览/情报继续"
    else:
        active_label = "⏸ 全球市场休眠"

    login_lines: list[str] = []
    platforms = sessions.get("platforms") or {}
    for key in PLATFORM_ORDER:
        info = platforms.get(key) or {}
        logged = info.get("logged_in")
        mark = "✅" if logged else "❌"
        label = PLATFORM_LABELS.get(key, key)
        method = info.get("method") or ""
        account = info.get("account_label") or ""
        extra = f"（{method}）" if method and logged else ""
        acct = f" · {account}" if account else ""
        if key == "instagram" and not logged:
            login_lines.append(f"{mark} {label:<12} 今日暂停 / 未登录{extra}")
        else:
            login_lines.append(f"{mark} {label:<12} {'已登录' if logged else '需子敬登录一次'}{extra}{acct}")

    queue_lines = [
        f"今日 {summary.get('date', _now().strftime('%Y-%m-%d'))} · 计划于 {summary.get('planned_at') or '—'}",
        f"合计  待执行 {totals['pending']}  ·  已完成 {totals['completed']}  ·  失败 {totals['failed']}",
    ]
    by_platform = summary.get("by_platform") or {}
    for key in ("facebook", "x"):
        plat = by_platform.get(key) or {}
        label = PLATFORM_LABELS.get(key, key)
        queue_lines.append(
            f"  {label:<10} 待 {plat.get('pending', 0)} · 完成 {plat.get('completed', 0)} · 失败 {plat.get('failed', 0)}"
        )
    ig_status = summary.get("instagram_status") or "paused_today"
    queue_lines.append(f"  Instagram  {('启用' if ig_status == 'enabled' else '今日暂停')}")

    action_rows = _last_actions(5)
    if action_rows:
        action_lines = [_format_action_row(row) for row in action_rows]
    else:
        action_lines = ["（尚无已完成/失败记录 — 队列文件或 cron 尚未产生动作）"]

    cron_lines = _next_cron_runs()
    hours_lines = [active_label, tz_note]
    for m in markets:
        flag = m.get("flag") or ""
        name = m.get("display") or m.get("label") or "?"
        mark = "✅ 营业中" if m.get("awake") else "❌ 休眠"
        hours_lines.append(f"  {flag} {name} {mark} · 本地 {m.get('local_time', '?')}")
    wait_lines = _why_waiting(summary, sessions)

    footer_lines = [
        f"网页看板（自动刷新）  https://asia-power.com/admin/apsales-zijing-live.html",
        f"详细动作记录  {DASHBOARD_URL}",
        "本窗口每 15 秒自动刷新 · Ctrl+C 退出",
        "重新打开：双击 docs/打开-子敬工作状态.command",
    ]

    sections: list[str] = []
    sections.extend(_box("子敬 · 社媒工作状态", [f"刷新时间  {_now_str()}", "CEO 监督面板 · 只读"]))
    sections.append("")
    sections.extend(_box("登录状态（FB / X / IG）", login_lines))
    sections.append("")
    sections.extend(_box("今日互动队列", queue_lines))
    sections.append("")
    sections.extend(_box("Facebook 好友动态浏览", _browse_feed_line(summary)))
    sections.append("")
    sections.extend(_box("最近 5 条动作", action_lines))
    sections.append("")
    sections.extend(_box("定时任务（生产服务器 cron）", cron_lines))
    sections.append("")
    sections.extend(_box("工作时段", hours_lines))
    sections.append("")
    sections.extend(_box("为何暂停 / 下一步", wait_lines))
    sections.append("")
    sections.extend(
        _box(
            "其他",
            [
                _reply_watch_line(),
                _progress_line(),
            ],
        )
    )
    sections.append("")
    sections.extend(_box("快捷入口", footer_lines))
    return "\n".join(sections)


def main() -> int:
    import argparse
    import time

    parser = argparse.ArgumentParser(description="子敬 · 实时终端监控 / API JSON")
    parser.add_argument("--json", action="store_true", help="输出 JSON（供 API / 网页看板）")
    parser.add_argument("--loop", action="store_true", help="持续刷新终端（每 2s）")
    parser.add_argument("--interval", type=int, default=2, help="刷新间隔秒数（默认 2）")
    parser.add_argument("--legacy", action="store_true", help="旧版盒式看板（非实时动作流）")
    args = parser.parse_args()

    def emit() -> None:
        if args.json:
            print(json.dumps(build_live_status(), ensure_ascii=False))
        elif args.legacy:
            print(render_dashboard())
        else:
            from customer_gateway.zijing_terminal_view import render_terminal

            print(render_terminal())

    if args.loop:
        interval = max(1, args.interval)
        while True:
            print("\033[2J\033[H", end="")
            emit()
            sys.stdout.flush()
            time.sleep(interval)
        return 0

    emit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
