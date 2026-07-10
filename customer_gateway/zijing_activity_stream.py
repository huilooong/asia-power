"""Append-only activity log for CEO live dashboard (子敬实时工作状态)."""

from __future__ import annotations

import json
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parent.parent
STREAM_FILE = ROOT / "memory" / "customer_gateway" / "zijing_activity_stream.jsonl"
CURRENT_FILE = ROOT / "memory" / "customer_gateway" / "zijing_current_action.json"

_lock = threading.Lock()
_MAX_LINES = 500


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ts() -> str:
    return _now().strftime("%Y-%m-%dT%H:%M:%S")


def _ensure_dir() -> None:
    STREAM_FILE.parent.mkdir(parents=True, exist_ok=True)


def append_event(
    action: str,
    detail: str = "",
    *,
    platform: str = "",
    status: str = "running",
    duration_ms: int | None = None,
    mode: str = "",
    result: str = "",
    counts: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Append one line to zijing_activity_stream.jsonl."""
    row: dict[str, Any] = {
        "ts": _ts(),
        "action": str(action or "").strip() or "unknown",
        "detail": str(detail or "").strip(),
        "platform": str(platform or "").strip(),
        "status": str(status or "running").strip(),
    }
    if duration_ms is not None:
        row["duration_ms"] = int(duration_ms)
    if mode:
        row["mode"] = str(mode).strip()
    if result:
        row["result"] = str(result).strip()
    if counts:
        row["counts"] = counts

    _ensure_dir()
    with _lock:
        with STREAM_FILE.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
        _trim_stream_locked()
        _update_current_locked(row)

    return row


def log_step_start(action: str, detail: str = "", *, platform: str = "") -> dict[str, Any]:
    return append_event(action, detail, platform=platform, status="running")


def log_step_end(
    action: str,
    detail: str = "",
    *,
    platform: str = "",
    status: str = "completed",
    duration_ms: int | None = None,
) -> dict[str, Any]:
    return append_event(action, detail, platform=platform, status=status, duration_ms=duration_ms)


@contextmanager
def track_step(action: str, detail: str = "", *, platform: str = "") -> Iterator[None]:
    """Log start + end (completed/failed) for a step."""
    t0 = time.monotonic()
    log_step_start(action, detail, platform=platform)
    try:
        yield
        ms = int((time.monotonic() - t0) * 1000)
        log_step_end(action, f"{detail} · 完成" if detail else "完成", platform=platform, status="completed", duration_ms=ms)
    except Exception as exc:
        ms = int((time.monotonic() - t0) * 1000)
        end_detail = f"{detail} · 失败: {exc}" if detail else f"失败: {exc}"
        log_step_end(action, end_detail, platform=platform, status="failed", duration_ms=ms)
        raise


def write_idle(detail: str = "等待下一趟 cron / 非工作时段") -> dict[str, Any]:
    return append_event("idle", detail, platform="", status="idle")


def log_sleep(seconds: float, detail: str = "", *, platform: str = "", mode: str = "") -> dict[str, Any]:
    """Log a batch pause so CEO terminal shows sleep instead of fake idle."""
    sec = max(1, int(round(seconds)))
    msg = detail or f"等待 {sec}s 下一批"
    return append_event(
        "sleep",
        msg,
        platform=platform,
        status="sleep",
        duration_ms=sec * 1000,
        mode=mode,
        counts={"sleep_sec": sec},
    )


def log_progress(
    action: str,
    detail: str,
    *,
    platform: str = "",
    mode: str = "",
    counts: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Mid-step progress (e.g. Maps query) without start/end pair."""
    return append_event(action, detail, platform=platform, status="progress", mode=mode, counts=counts)


def log_result(
    action: str,
    detail: str,
    *,
    platform: str = "",
    mode: str = "",
    result: str = "",
    counts: dict[str, Any] | None = None,
    status: str = "completed",
) -> dict[str, Any]:
    """Explicit result line with optional counts (joins, leads, drafts)."""
    return append_event(
        action,
        detail,
        platform=platform,
        status=status,
        mode=mode,
        result=result,
        counts=counts,
    )


def _trim_stream_locked() -> None:
    if not STREAM_FILE.is_file():
        return
    try:
        lines = STREAM_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    if len(lines) <= _MAX_LINES:
        return
    keep = lines[-_MAX_LINES:]
    STREAM_FILE.write_text("\n".join(keep) + "\n", encoding="utf-8")


def _update_current_locked(row: dict[str, Any]) -> None:
    status = row.get("status", "")
    if status == "running":
        CURRENT_FILE.write_text(json.dumps(row, ensure_ascii=False, indent=2), encoding="utf-8")
    elif status in ("completed", "failed", "idle", "sleep", "progress"):
        if not CURRENT_FILE.is_file():
            return
        try:
            cur = json.loads(CURRENT_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            CURRENT_FILE.unlink(missing_ok=True)
            return
        same_action = cur.get("action") == row.get("action")
        same_ts = cur.get("ts") == row.get("ts")
        if same_ts or (same_action and status in ("completed", "failed")):
            CURRENT_FILE.unlink(missing_ok=True)


def read_recent(limit: int = 50, *, include_idle: bool = True) -> list[dict[str, Any]]:
    if not STREAM_FILE.is_file():
        return []
    try:
        lines = [ln for ln in STREAM_FILE.read_text(encoding="utf-8").splitlines() if ln.strip()]
    except OSError:
        return []
    out: list[dict[str, Any]] = []
    for line in reversed(lines[-limit * 3 if not include_idle else limit :]):
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not include_idle and row.get("action") == "idle" and row.get("status") == "idle":
            continue
        out.append(row)
        if len(out) >= limit:
            break
    return out


def read_recent_real(limit: int = 10) -> list[dict[str, Any]]:
    """Last N meaningful events — skips idle heartbeats."""
    return read_recent(limit, include_idle=False)


def _parse_ts(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            dt = datetime.strptime(text.replace(" UTC", "").replace("Z", ""), fmt.replace("Z", ""))
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def get_current_action(within_sec: float = 5.0) -> dict[str, Any] | None:
    """Return action running RIGHT NOW (or within last N seconds)."""
    now = _now()
    if CURRENT_FILE.is_file():
        try:
            cur = json.loads(CURRENT_FILE.read_text(encoding="utf-8"))
            ts = _parse_ts(cur.get("ts", ""))
            if ts and (now - ts).total_seconds() <= max(within_sec, 300):
                return cur
        except (json.JSONDecodeError, OSError):
            pass

    for row in read_recent(20):
        if row.get("status") != "running":
            continue
        ts = _parse_ts(row.get("ts", ""))
        if ts and (now - ts).total_seconds() <= within_sec:
            return row
    return None


def events_per_minute(window_sec: int = 60) -> int:
    if not STREAM_FILE.is_file():
        return 0
    cutoff = _now() - timedelta(seconds=window_sec)
    count = 0
    try:
        lines = STREAM_FILE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return 0
    for line in reversed(lines):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = _parse_ts(row.get("ts", ""))
        if ts is None:
            continue
        if ts < cutoff:
            break
        if row.get("action") != "idle":
            count += 1
    return count


def format_action_label(row: dict[str, Any] | None) -> str:
    if not row:
        return "空闲 · 等待下一趟任务"
    action = str(row.get("action") or "")
    detail = str(row.get("detail") or "")
    platform = str(row.get("platform") or "")
    labels = {
        "idle": "空闲",
        "accept_friends": "通过好友请求",
        "browse_feed": "浏览好友动态",
        "friend_dm": "发送好友私信",
        "timeline_post": "时间线发帖",
        "autopilot": "Autopilot 自动运行",
        "engage": "互动队列执行",
        "alternate_run": "FB↔X 交替运行",
        "scan_replies": "扫描回复",
        "publish": "发布队列帖文",
        "daily_run": "Facebook 每日一体运行",
        "login_check": "检查登录",
        "group_actions": "小组动作",
        "group_join": "加入小组",
        "group_greeting": "小组问候",
        "group_comment": "小组评论",
        "maps_fallback": "限流 · Maps获客",
        "africa_maps_scrape": "非洲 Maps 获客",
        "maps_prospect": "Google Maps 获客",
        "zijing_run": "子敬运行",
        "sleep": "批次休息",
        "draft_email": "邮件草稿",
    }
    label = labels.get(action, action)
    parts = [label]
    if platform == "fb+x":
        parts.append("[FB↔X]")
    elif platform:
        plat_tag = {"facebook": "FB", "x": "X"}.get(platform, platform)
        parts.append(f"[{plat_tag}]")
    if detail:
        parts.append(detail)
    return " · ".join(parts)


def format_terminal_line(row: dict[str, Any]) -> str:
    """Single line for CEO terminal: [HH:MM:SS] KIND: detail | counts."""
    ts_raw = str(row.get("ts") or "")
    ts = ts_raw[11:19] if len(ts_raw) >= 19 else (ts_raw[-8:] if len(ts_raw) >= 8 else ts_raw or "—")
    action = str(row.get("action") or "")
    status = str(row.get("status") or "")
    detail = str(row.get("detail") or "")
    platform = str(row.get("platform") or "")
    result = str(row.get("result") or "")
    counts = row.get("counts") if isinstance(row.get("counts"), dict) else {}

    if status == "sleep" or action == "sleep":
        kind = "SLEEP"
    elif status == "running":
        kind = "ACTION"
    elif status == "progress":
        kind = "PROGRESS"
    elif status == "failed":
        kind = "FAIL"
    elif action == "idle":
        kind = "IDLE"
    else:
        kind = "RESULT"

    plat = ""
    if platform == "facebook":
        plat = "FB"
    elif platform == "x":
        plat = "X"
    elif platform == "maps":
        plat = "Maps"
    elif platform == "fb+x":
        plat = "FB↔X"

    label = format_action_label(row).split(" · ")[0] if action != "sleep" else action
    if action not in ("idle", "sleep") and label == action:
        labels_short = {
            "group_actions": "group_actions",
            "africa_maps_scrape": "africa_maps",
            "maps_prospect": "maps",
            "maps_fallback": "maps_fallback",
            "friend_dm": "friend_dm",
            "draft_email": "draft_email",
        }
        label = labels_short.get(action, action)

    parts = [f"[{ts}]", f"{kind}:", label]
    if plat:
        parts.append(f"| {plat}")
    if detail:
        parts.append(f"| {detail}")
    if result:
        parts.append(f"| {result}")

    count_bits: list[str] = []
    for key in (
        "joins",
        "greetings",
        "comments",
        "dms_sent",
        "sent",
        "leads",
        "new_leads",
        "drafts",
        "new_drafts",
        "phones",
        "emails",
        "sleep_sec",
    ):
        if key in counts and counts[key] is not None:
            count_bits.append(f"{key}={counts[key]}")
    if count_bits:
        parts.append("| " + ", ".join(count_bits))

    dur = row.get("duration_ms")
    if dur is not None and status != "sleep":
        parts.append(f"| {dur}ms")

    return " ".join(parts)
