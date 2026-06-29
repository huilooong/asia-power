"""Raw read-only conversation archive — audit/learning source, not long-term memory."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import conversation_paths as cp


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _day_dir() -> Path:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = cp.RAW_DIR / day
    path.mkdir(parents=True, exist_ok=True)
    return path


def archive_exists(message_id: str) -> bool:
    return any(cp.RAW_DIR.rglob(f"{message_id[:32]}.json"))


def archive_raw_message(
    payload: dict[str, Any],
    *,
    source: str = "poll",
) -> Path | None:
    """Save incoming message JSON to raw archive. Returns path or None if duplicate."""
    cp.ensure_conversation_dirs()
    message_id = str(payload.get("message_id") or "").strip()
    if not message_id:
        return None
    if archive_exists(message_id):
        return None

    record = {
        "message_id": message_id,
        "captured_at": _now(),
        "source": source,
        "read_only": True,
        "payload": payload,
    }
    path = _day_dir() / f"{message_id[:32]}.json"
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def list_raw_messages(*, limit: int = 20) -> list[dict[str, Any]]:
    cp.ensure_conversation_dirs()
    files = sorted(cp.RAW_DIR.rglob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    out: list[dict[str, Any]] = []
    for path in files[:limit]:
        try:
            out.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out
