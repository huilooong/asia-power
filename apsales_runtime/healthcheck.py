"""APSales runtime healthcheck."""

from __future__ import annotations

import os
from typing import Any

from apsales_runtime.config import load_apsales_runtime_config
from apsales_runtime.memory import MemoryStore
from apsales_runtime.paths import ensure_runtime_dirs
from apsales_runtime.tools import ToolFramework


def _check(name: str, ok: bool, detail: str, *, required: bool = True) -> dict[str, Any]:
    return {"name": name, "ok": ok, "detail": detail, "required": required}


def run_healthcheck(config: dict[str, Any] | None = None) -> tuple[bool, list[dict[str, Any]]]:
    cfg = config or load_apsales_runtime_config()
    checks: list[dict[str, Any]] = []
    ensure_runtime_dirs()

    memory = MemoryStore()
    mem = memory.health()
    checks.append(_check(
        "memory_scopes",
        all(s["exists"] for s in mem.get("scopes", {}).values()),
        f"index={mem.get('memory_index')}",
    ))

    tools = ToolFramework(enabled=list((cfg.get("tools") or {}).get("enabled") or []))
    th = tools.health()
    checks.append(_check(
        "tool_framework",
        all(v.get("registered") for v in th.get("tools", {}).values()),
        f"{len(th.get('tools', {}))} tools",
    ))

    tg = bool((os.getenv("APSALES_TELEGRAM_BOT_TOKEN") or os.getenv("COO_TELEGRAM_BOT_TOKEN") or "").strip())
    checks.append(_check(
        "telegram_token",
        tg,
        "set" if tg else "missing (supervisor may idle)",
        required=False,
    ))

    oai = bool((os.getenv("OPENAI_API_KEY") or "").strip())
    checks.append(_check(
        "openai_key",
        oai,
        "set" if oai else "missing",
        required=False,
    ))

    critical_ok = all(c["ok"] for c in checks if c["required"])
    return critical_ok, checks


def format_healthcheck_report(checks: list[dict[str, Any]]) -> str:
    lines = ["APSales Runtime Healthcheck", ""]
    for c in checks:
        mark = "OK" if c["ok"] else ("WARN" if not c["required"] else "FAIL")
        req = "" if c["required"] else " (optional)"
        lines.append(f"[{mark}] {c['name']}{req}: {c['detail']}")
    lines.append("")
    critical_fail = any(not c["ok"] and c["required"] for c in checks)
    lines.append("Overall: OK" if not critical_fail else "Overall: FAIL")
    return "\n".join(lines)
