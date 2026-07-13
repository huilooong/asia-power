"""Read-only loaders (reuse Draft Queue / Conversation Memory)."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sales_coach import config


def parse_day(day: str | date | None) -> date:
    if day is None:
        return datetime.now(timezone.utc).date()
    if isinstance(day, date) and not isinstance(day, datetime):
        return day
    return date.fromisoformat(str(day)[:10])


def _in_day(ts: str, day: date) -> bool:
    m = re.match(r"(\d{4}-\d{2}-\d{2})", str(ts or "").strip())
    return bool(m and m.group(1) == day.isoformat())


def load_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_drafts_for_day(day: date, root: Path | None = None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    ddir = config.draft_queue_dir(root)
    if not ddir.is_dir():
        return out
    for path in sorted(ddir.glob("draft-*.json")):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        if _in_day(str(data.get("created_at") or ""), day) or _in_day(
            str(data.get("updated_at") or ""), day
        ):
            data["_path"] = str(path)
            out.append(data)
    return out


def load_conversations_for_day(day: date, root: Path | None = None) -> list[dict[str, Any]]:
    cdir = config.conversations_dir(root)
    if not cdir.is_dir():
        return []
    rows: list[dict[str, Any]] = []
    for path in sorted(cdir.glob("*.json")):
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        msgs = [m for m in (data.get("messages") or []) if isinstance(m, dict)]
        day_msgs = [m for m in msgs if _in_day(str(m.get("timestamp") or ""), day)]
        if day_msgs:
            rows.append({**data, "day_messages": day_msgs, "_path": str(path)})
    return rows
