"""Honest terminal progress view for 子敬 — reads jsonl + state files, no fake %."""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
MEM = ROOT / "memory" / "customer_gateway"

ZIJING_SCRIPT_RE = re.compile(
    r"apsales-(zijing-run|facebook-daily-run|social-alternate-run|africa-maps-scrape|"
    r"social-autopilot|facebook-dm-friends|facebook-browse-friends|maps-leads-run|"
    r"zijing-idle-heartbeat)\.py"
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> str:
    return _now().strftime("%Y-%m-%d")


def _load_json(path: Path, default: object) -> object:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def find_running_processes() -> list[dict[str, Any]]:
    """Return apsales worker PIDs (real processes only, not shell wrappers)."""
    try:
        out = subprocess.run(
            ["pgrep", "-fl", "apsales-"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []

    seen_pids: set[int] = set()
    procs: list[dict[str, Any]] = []
    for line in (out.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        try:
            pid = int(parts[0])
        except ValueError:
            continue
        cmd = parts[1]
        if "/bin/zsh" in cmd or " zsh -c " in cmd or cmd.startswith("/bin/bash"):
            continue
        if "Python" not in cmd and "python" not in cmd.lower():
            continue
        m = ZIJING_SCRIPT_RE.search(cmd)
        if not m:
            continue
        script = m.group(0)
        if any(p["script"] == script for p in procs):
            continue
        if pid in seen_pids:
            continue
        seen_pids.add(pid)
        procs.append({"pid": pid, "script": script, "cmd": cmd})

    procs.sort(key=lambda p: p["script"])
    return procs


def load_today_counters() -> dict[str, Any]:
    """Real counts from state files — not inferred."""
    today = _today()
    counters: dict[str, Any] = {
        "date": today,
        "groups_joined": 0,
        "greetings": 0,
        "comments": 0,
        "dms_sent": 0,
        "maps_leads_tonight": 0,
        "maps_leads_total": 0,
        "africa_leads_tonight": 0,
        "email_drafts_tonight": 0,
        "email_drafts_total": 0,
        "maps_by_country": {},
    }

    grp = _load_json(MEM / "fb_groups_state.json", {})
    if isinstance(grp, dict) and str(grp.get("date") or "") == today:
        counters["groups_joined"] = int(grp.get("joins_today") or 0)
        counters["greetings"] = int(grp.get("greetings_today") or 0)
        counters["comments"] = int(grp.get("comments_today") or 0)

    dm_log = MEM / "fb_friend_dm_log.jsonl"
    if dm_log.is_file():
        try:
            for line in dm_log.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                if row.get("status") == "sent" and str(row.get("sent_at") or "").startswith(today):
                    counters["dms_sent"] += 1
        except (json.JSONDecodeError, OSError):
            pass

    africa_leads = MEM / "africa_maps_leads.jsonl"
    if africa_leads.is_file():
        try:
            for line in africa_leads.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                ts = str(row.get("scraped_at") or row.get("saved_at") or row.get("ts") or "")
                if ts.startswith(today):
                    counters["africa_leads_tonight"] += 1
                country = str(row.get("country") or "—")
                if ts.startswith(today):
                    by = counters["maps_by_country"]
                    by[country] = int(by.get(country) or 0) + 1
        except (json.JSONDecodeError, OSError):
            pass

    maps_leads = MEM / "maps_leads.jsonl"
    if maps_leads.is_file():
        try:
            for line in maps_leads.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                ts = str(row.get("scraped_at") or row.get("saved_at") or row.get("ts") or "")
                if ts.startswith(today):
                    counters["maps_leads_tonight"] += 1
                country = str(row.get("country") or "—")
                if ts.startswith(today):
                    by = counters["maps_by_country"]
                    by[country] = int(by.get(country) or 0) + 1
        except (json.JSONDecodeError, OSError):
            pass

    counters["maps_leads_tonight"] = counters["maps_leads_tonight"] + counters["africa_leads_tonight"]

    progress = _load_json(MEM / "africa_maps_progress.json", {})
    if isinstance(progress, dict):
        totals = progress.get("totals") or {}
        counters["maps_leads_total"] = int(totals.get("total") or totals.get("leads") or 0)
        counters["progress_updated_at"] = str(progress.get("updated_at") or "")

    draft_dir = MEM / "outreach_queue"
    if draft_dir.is_dir():
        for fp in draft_dir.glob("*.json"):
            try:
                row = json.loads(fp.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            created = str(row.get("created_at") or row.get("queued_at") or "")
            counters["email_drafts_total"] += 1
            if created.startswith(today):
                counters["email_drafts_tonight"] += 1

    return counters


def _parse_ts(value: str) -> datetime | None:
    from customer_gateway.zijing_activity_stream import _parse_ts as _p

    return _p(value)


def _operating_mode() -> dict[str, Any]:
    try:
        from customer_gateway.fb_platform_limits import get_operating_mode

        return get_operating_mode()
    except Exception:
        return {"mode": "unknown", "mode_label": "—", "active_pauses": {}}


def _next_cron_countdown() -> str:
    now = _now()
    if now.minute < 30:
        nxt = now.replace(minute=30, second=0, microsecond=0)
    else:
        nxt = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    delta = int((nxt - now).total_seconds())
    return f"Autopilot cron ≈ {nxt.strftime('%H:%M UTC')} ({delta}s)"


def _detect_active_sleep() -> dict[str, Any] | None:
    """If the latest meaningful event was sleep, estimate remaining wait."""
    from customer_gateway.zijing_activity_stream import read_recent

    rows = read_recent(15, include_idle=False)
    if not rows:
        return None
    latest = rows[0]
    if latest.get("status") == "running":
        return None
    if latest.get("action") != "sleep" and latest.get("status") != "sleep":
        return None
    ts = _parse_ts(str(latest.get("ts") or ""))
    counts = latest.get("counts") if isinstance(latest.get("counts"), dict) else {}
    sleep_sec = int(counts.get("sleep_sec") or 0)
    if not ts or sleep_sec <= 0:
        return None
    elapsed = (_now() - ts).total_seconds()
    remaining = max(0, sleep_sec - int(elapsed))
    if remaining > 0:
        return {"detail": latest.get("detail", ""), "remaining_sec": remaining, "total_sec": sleep_sec}
    return None


def _current_action_row() -> dict[str, Any] | None:
    from customer_gateway.zijing_activity_stream import get_current_action, read_recent

    cur = get_current_action(within_sec=120)
    if cur and cur.get("action") not in ("idle",) and cur.get("status") == "running":
        ts = _parse_ts(str(cur.get("ts") or ""))
        if ts and (_now() - ts).total_seconds() > 180:
            cur = None
        else:
            recent = read_recent(5, include_idle=False)
            if recent:
                latest = recent[0]
                if latest.get("status") in ("completed", "failed") and latest.get("action") == cur.get("action"):
                    lt = _parse_ts(str(latest.get("ts") or ""))
                    ct = _parse_ts(str(cur.get("ts") or ""))
                    if lt and ct and lt >= ct:
                        cur = None

    if cur and cur.get("status") == "running" and cur.get("action") not in ("idle",):
        return cur

    cur_file = MEM / "zijing_current_action.json"
    if cur_file.is_file() and not cur:
        try:
            row = json.loads(cur_file.read_text(encoding="utf-8"))
            if row.get("status") == "running":
                ts = _parse_ts(str(row.get("ts") or ""))
                stale = ts is None or (_now() - ts).total_seconds() > 180
                recent = read_recent(3, include_idle=False)
                if recent and recent[0].get("status") in ("completed", "failed"):
                    if recent[0].get("action") == row.get("action"):
                        stale = True
                if not stale:
                    return row
        except (json.JSONDecodeError, OSError):
            pass
    return cur


def build_terminal_state() -> dict[str, Any]:
    procs = find_running_processes()
    mode = _operating_mode()
    counters = load_today_counters()
    current = _current_action_row()
    sleep = _detect_active_sleep()

    from customer_gateway.zijing_activity_stream import read_recent_real

    recent = read_recent_real(10)

    next_action = None
    try:
        from customer_gateway.social_engagement_engine import get_next_pending_action_summary

        next_action = get_next_pending_action_summary()
    except Exception:
        pass

    return {
        "updated_at": _now().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "running": bool(procs),
        "processes": procs,
        "mode": mode,
        "counters": counters,
        "current": current,
        "sleep": sleep,
        "recent_actions": recent,
        "next_cron": _next_cron_countdown(),
        "next_action": next_action,
    }


def _ansi(code: str, text: str, enabled: bool) -> str:
    if not enabled:
        return text
    return f"\033[{code}m{text}\033[0m"


def _use_color() -> bool:
    import sys

    return sys.stdout.isatty()


def _try_rich_render(lines: list[str]) -> str | None:
    try:
        from rich.console import Console
        from rich.panel import Panel
        from rich.table import Table
        from rich.text import Text

        console = Console(force_terminal=True, width=min(100, console.width if False else 96))
        # Build rich layout
        parts: list[Any] = []
        for block in lines:
            if block.startswith("##PANEL:"):
                title, body = block[8:].split("::", 1)
                parts.append(Panel(body, title=title, border_style="cyan"))
            else:
                parts.append(Text(block))
        # Fallback: plain join if rich layout too complex
        out = Console(width=96, force_terminal=True)
        with out.capture() as cap:
            for line in lines:
                if line.startswith("##PANEL:"):
                    title, body = line[8:].split("::", 1)
                    out.print(Panel(body, title=title, border_style="cyan"))
                elif line.startswith("##HDR:"):
                    out.print(_ansi("1;36", line[6:], True))
                elif line.startswith("##WARN:"):
                    out.print(_ansi("1;33", line[7:], True))
                elif line.startswith("##OK:"):
                    out.print(_ansi("1;32", line[5:], True))
                elif line.startswith("##BAD:"):
                    out.print(_ansi("1;31", line[6:], True))
                elif line.startswith("##DIM:"):
                    out.print(_ansi("2", line[6:], True))
                else:
                    out.print(line)
        return cap.get()
    except Exception:
        return None


def render_terminal(*, use_color: bool | None = None) -> str:
    """Render honest CEO terminal view."""
    if use_color is None:
        use_color = _use_color()

    state = build_terminal_state()
    mode = state["mode"]
    counters = state["counters"]
    procs = state["processes"]
    current = state.get("current")
    sleep = state.get("sleep")
    recent = state.get("recent_actions") or []

    from customer_gateway.zijing_activity_stream import format_terminal_line

    lines: list[str] = []
    lines.append(f"##HDR:子敬 · 实时终端监控 · {state['updated_at']}")
    lines.append("")

    if procs:
        proc_lines = [f"PID {p['pid']} · {p['script']}" for p in procs]
        lines.append("##OK:进程运行中")
        for pl in proc_lines:
            lines.append(f"  {pl}")
    else:
        lines.append("##BAD:子敬未运行")
        lines.append("  启动: cd AsiaPower && .venv/bin/python3 scripts/apsales-zijing-run.py")
        lines.append("  或 FB 探测: .venv/bin/python3 scripts/apsales-facebook-daily-run.py --all --aggressive")

    lines.append("")
    mode_name = str(mode.get("mode") or "unknown")
    mode_label = str(mode.get("mode_label") or mode_name)
    pauses = mode.get("active_pauses") or {}
    if mode_name == "limited":
        pause_bits = []
        for action, until in pauses.items():
            until_short = str(until).replace(" UTC", "").replace("2026-", "") if until else "?"
            pause_bits.append(f"{action} blocked until {until_short}")
        pause_txt = " · ".join(pause_bits) if pause_bits else str(mode.get("reason") or "")
        lines.append(f"##WARN:MODE: limited ({mode_label})")
        if pause_txt:
            lines.append(f"  FB limits: {pause_txt}")
    else:
        lines.append(f"##OK:MODE: normal ({mode_label})")

    lines.append("")
    if current and current.get("status") == "running" and current.get("action") not in ("idle",):
        from customer_gateway.zijing_activity_stream import format_action_label

        ts = _parse_ts(str(current.get("ts") or ""))
        age = int((_now() - ts).total_seconds()) if ts else 0
        lines.append(f"##OK:当前 ACTION: {format_action_label(current)} · 已运行 {age}s")
    elif sleep:
        rem = sleep.get("remaining_sec", 0)
        lines.append(f"##WARN:当前 SLEEP: {rem}s 剩余 · {sleep.get('detail', '')}")
    elif procs:
        lines.append("##DIM:当前: 进程在跑 · 可能在浏览器/批次休息（见下方动作流）")
    else:
        lines.append("##DIM:当前: 空闲 · 等待 cron 或手动启动")

    lines.append(f"  下一趟: {state.get('next_cron', '—')}")
    nxt = state.get("next_action")
    if nxt and nxt.get("label"):
        lines.append(f"  队列下一动作: {nxt.get('label')}")

    lines.append("")
    by_country = counters.get("maps_by_country") or {}
    progress = _load_json(MEM / "africa_maps_progress.json", {})
    target = 500
    if isinstance(progress, dict):
        try:
            from customer_gateway.africa_maps_prospect import _per_country_target, load_africa_config

            target = _per_country_target(load_africa_config())
        except Exception:
            pass
        country_stats = progress.get("country_stats") or {}
        if country_stats:
            bits: list[str] = []
            cfg = _load_json(ROOT / "config" / "apsales_africa_maps.yaml", {})
            order = [
                str(m.get("country") or "")
                for m in (cfg.get("countries") or [])
                if isinstance(m, dict)
            ]
            seen: set[str] = set()
            for cname in order + sorted(country_stats.keys()):
                if not cname or cname in seen:
                    continue
                seen.add(cname)
                st = country_stats.get(cname) or {}
                valid = int(st.get("valid") or st.get("total") or 0)
                bits.append(f"{cname} {valid}/{int(st.get('target') or target)}")
            country_bits = ", ".join(bits[:8])
            if len(bits) > 8:
                country_bits += f" …+{len(bits) - 8}国"
        else:
            country_bits = ", ".join(f"{k} {v}" for k, v in sorted(by_country.items(), key=lambda x: -x[1])[:5])
    else:
        country_bits = ", ".join(f"{k} {v}" for k, v in sorted(by_country.items(), key=lambda x: -x[1])[:5])
    lines.append("##HDR:今日计数（真实 state/jsonl，非估算）")
    try:
        from customer_gateway.africa_maps_prospect import compute_leads_live_stats

        live = compute_leads_live_stats()
        live_line = (
            f"  Maps 实时 · 最后写入 {live.get('last_saved_at') or '—'} · "
            f"过去1h +{live.get('last_hour_count', 0)} · "
            f"{live.get('rate_per_hour', 0)}/h"
        )
    except Exception:
        live_line = ""
    lines.append(
        f"  入组 {counters.get('groups_joined', 0)} · "
        f"问候 {counters.get('greetings', 0)} · "
        f"评论 {counters.get('comments', 0)} · "
        f"私信 {counters.get('dms_sent', 0)}"
    )
    lines.append(
        f"  Maps 线索今晚 +{counters.get('maps_leads_tonight', 0)} · "
        f"累计 {counters.get('maps_leads_total', 0)} · "
        f"更新 {counters.get('progress_updated_at', '—')}"
    )
    lines.append(
        f"  邮件草稿今晚 +{counters.get('email_drafts_tonight', 0)} · "
        f"草稿累计 {counters.get('email_drafts_total', 0)}"
    )
    if country_bits:
        lines.append(f"  Maps 按国家(有效/目标): {country_bits}")
    if live_line:
        lines.append(live_line)

    lines.append("")
    lines.append("##HDR:最近 10 条真实动作")
    if recent:
        for row in recent:
            line = format_terminal_line(row)
            if row.get("status") == "failed":
                lines.append(f"##BAD:{line}")
            elif row.get("status") == "sleep":
                lines.append(f"##WARN:{line}")
            elif row.get("status") == "running":
                lines.append(f"##OK:{line}")
            else:
                lines.append(f"  {line}")
    else:
        lines.append("  （尚无动作 — 启动子敬或等待 cron）")

    lines.append("")
    lines.append("##DIM:Ctrl+C 退出 · --loop 每 2s 刷新 · 网页看板仅供参考")

    # Plain render with ANSI
    plain: list[str] = []
    for line in lines:
        if line.startswith("##HDR:"):
            plain.append(_ansi("1;36", line[6:], use_color))
        elif line.startswith("##WARN:"):
            plain.append(_ansi("1;33", line[7:], use_color))
        elif line.startswith("##OK:"):
            plain.append(_ansi("1;32", line[5:], use_color))
        elif line.startswith("##BAD:"):
            plain.append(_ansi("1;31", line[6:], use_color))
        elif line.startswith("##DIM:"):
            plain.append(_ansi("2", line[6:], use_color))
        else:
            plain.append(line)

    return "\n".join(plain)
