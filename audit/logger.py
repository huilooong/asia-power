"""Audit log writers — append-only JSONL under audit/."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
AUDIT_DIR = ROOT / "audit"

EVENTS_FILE = "events.jsonl"
APPROVALS_FILE = "approvals.jsonl"
TOOL_CALLS_FILE = "tool_calls.jsonl"
ERRORS_FILE = "errors.jsonl"


def reconfigure_audit_dir(audit_dir: Path) -> None:
    global AUDIT_DIR
    AUDIT_DIR = audit_dir


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _append(filename: str, record: dict[str, Any]) -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    path = AUDIT_DIR / filename
    if not path.exists():
        path.touch()
    entry = {"timestamp": _timestamp(), **record}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def log_event(event_type: str, **payload: Any) -> None:
    """Write to events.jsonl (agent_start, agent_stop, deployment, etc.)."""
    _append(EVENTS_FILE, {"event": event_type, **payload})


def log_tool_call(
    tool: str,
    action: str,
    *,
    args: list[str] | None = None,
    ok: bool = True,
    dry_run: bool = False,
    risk_level: str = "low",
    source: str = "coo",
    channel: str = "cli",
    result_summary: str = "",
) -> None:
    _append(TOOL_CALLS_FILE, {
        "tool": tool,
        "action": action,
        "args": args or [],
        "ok": ok,
        "dry_run": dry_run,
        "risk_level": risk_level,
        "source": source,
        "channel": channel,
        "result_summary": result_summary[:500],
    })
    _append(EVENTS_FILE, {
        "event": "tool_call",
        "tool": tool,
        "action": action,
        "ok": ok,
        "risk_level": risk_level,
    })


def log_approval_required(action: str, risk_level: str, command: str, **extra: Any) -> None:
    log_event("approval_required", action=action, risk_level=risk_level, command=command, **extra)


def log_approval_granted(
    action: str,
    risk_level: str,
    command: str,
    approved_by: str = "CEO",
    result: str = "granted",
) -> None:
    record = {
        "action": action,
        "risk_level": risk_level,
        "approved_by": approved_by,
        "command": command,
        "result": result,
    }
    _append(APPROVALS_FILE, record)
    log_event("approval_granted", **record)


def log_deployment(command: str, dry_run: bool, ok: bool, detail: str = "") -> None:
    log_event(
        "deployment",
        command=command,
        dry_run=dry_run,
        ok=ok,
        detail=detail[:500],
    )


def log_external_message(channel: str, preview: bool, ok: bool, summary: str = "") -> None:
    log_event(
        "external_message",
        channel=channel,
        preview=preview,
        ok=ok,
        summary=summary[:500],
    )


def log_error(message: str, *, context: str = "", exc_type: str = "") -> None:
    _append(ERRORS_FILE, {
        "message": message[:1000],
        "context": context,
        "exc_type": exc_type,
    })
    log_event("error", message=message[:500], context=context)
