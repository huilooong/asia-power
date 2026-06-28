"""Message Tool — outbound messaging and inbound/outbound audit log."""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MESSAGE_LOG = DATA_DIR / "message_log.jsonl"

TELEGRAM_CHUNK_LIMIT = 3900


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def safe_text_summary(text: str, max_chars: int = 500) -> str:
    """Short summary for audit log — never store huge payloads."""
    cleaned = (text or "").replace("\n", " ").strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max_chars - 3] + "..."


def log_message(
    channel: str,
    direction: str,
    chat_id: str,
    text: str,
    status: str = "ok",
) -> dict[str, Any]:
    """Append message audit row to data/message_log.jsonl (summary only)."""
    _ensure_data_dir()
    row = {
        "ts": _now_iso(),
        "channel": channel,
        "direction": direction,
        "chat_id": str(chat_id),
        "text_summary": safe_text_summary(text),
        "status": status,
    }
    with MESSAGE_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return row


def read_message_log(
    limit: int = 50,
    channel: str | None = None,
    direction: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    """Read recent audit rows."""
    if not MESSAGE_LOG.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in MESSAGE_LOG.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if channel and row.get("channel") != channel:
            continue
        if direction and row.get("direction") != direction:
            continue
        if status and row.get("status") != status:
            continue
        rows.append(row)
    return rows[-limit:]


def split_message(text: str, limit: int = TELEGRAM_CHUNK_LIMIT) -> list[str]:
    """Split long text into Telegram-safe chunks."""
    body = (text or "").strip()
    if not body:
        return []
    if len(body) <= limit:
        return [body]

    chunks: list[str] = []
    while body:
        if len(body) <= limit:
            chunks.append(body)
            break
        split_at = body.rfind("\n", 0, limit)
        if split_at < limit // 2:
            split_at = limit
        chunks.append(body[:split_at].rstrip())
        body = body[split_at:].lstrip()
    return chunks


def coo_telegram_token() -> str:
    """COO bot token only — no fallback to other bots."""
    return (os.getenv("COO_TELEGRAM_BOT_TOKEN") or "").strip()


def apsales_telegram_token() -> str:
    """APSales bot token only — no fallback to COO or other bots."""
    return (os.getenv("APSALES_TELEGRAM_BOT_TOKEN") or "").strip()


def send_telegram_message(chat_id: str | int, text: str, *, token: str | None = None) -> dict[str, Any]:
    """Send text to a Telegram chat."""
    tok = (token or coo_telegram_token()).strip()
    if not tok:
        raise RuntimeError("Telegram bot token not set")

    target = str(chat_id)
    chunks = split_message(text)
    last_result: dict[str, Any] = {"ok": True, "chunks": len(chunks)}

    for chunk in chunks:
        url = f"https://api.telegram.org/bot{tok}/sendMessage"
        payload = urllib.parse.urlencode({
            "chat_id": target,
            "text": chunk,
            "disable_web_page_preview": "true",
        }).encode("utf-8")
        req = urllib.request.Request(
            url, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if not body.get("ok"):
            raise RuntimeError(f"Telegram API error: {body}")
        last_result = body

    return last_result


def send_apsales_telegram_message(chat_id: str | int, text: str) -> dict[str, Any]:
    """Send via APSALES_TELEGRAM_BOT_TOKEN only."""
    token = apsales_telegram_token()
    if not token:
        raise RuntimeError("APSALES_TELEGRAM_BOT_TOKEN not set")
    return send_telegram_message(chat_id, text, token=token)
