"""APCOO /ping and /health status checks."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def system_version() -> str:
    version_file = ROOT / "constitution" / "VERSION"
    if version_file.is_file():
        return version_file.read_text(encoding="utf-8").strip()
    return "v1.0"


def ping_response() -> str:
    checks = run_health_checks()
    return "\n".join([
        "APCOO Online",
        f"Telegram {'OK' if checks['telegram'] == 'OK' else checks['telegram']}",
        f"Memory {'OK' if checks['memory'] == 'OK' else checks['memory']}",
        f"OpenAI {'OK' if checks['openai'] == 'OK' else checks['openai']}",
        f"Version {system_version()}",
    ])


def run_health_checks() -> dict[str, str]:
    results: dict[str, str] = {}

    from tools import message_tool
    results["telegram"] = "OK" if message_tool.coo_telegram_token() else "MISSING_TOKEN"

    try:
        from tools import memory_tool
        memory_tool._ensure_memory_dir()
        results["memory"] = "OK"
    except Exception as exc:
        results["memory"] = f"ERROR: {exc}"

    results["openai"] = "OK" if os.getenv("OPENAI_API_KEY") else "MISSING_KEY"

    try:
        from sales_core.apsales_handler import is_apsales_command
        results["sales_brain"] = "OK" if callable(is_apsales_command) else "ERROR"
    except Exception as exc:
        results["sales_brain"] = f"ERROR: {exc}"

    try:
        from core.constitution_runtime import load_authority_matrix
        results["constitution_runtime"] = "OK" if load_authority_matrix() else "EMPTY"
    except Exception as exc:
        results["constitution_runtime"] = f"ERROR: {exc}"

    try:
        from customer_gateway import conversation_paths as cp
        cp.ensure_conversation_dirs()
        results["conversation_learning"] = "OK"
    except Exception as exc:
        results["conversation_learning"] = f"ERROR: {exc}"

    try:
        from customer_gateway import sales_intelligence_paths as sip
        sip.ensure_dirs()
        results["sales_intelligence"] = "OK"
    except Exception as exc:
        results["sales_intelligence"] = f"ERROR: {exc}"

    try:
        from customer_gateway.whatsapp_browser_adapter import playwright_available
        results["browser_adapter"] = "OK" if playwright_available() else "PLAYWRIGHT_UNAVAILABLE"
    except Exception as exc:
        results["browser_adapter"] = f"ERROR: {exc}"

    try:
        from customer_gateway import gateway_readonly as gw
        gw.ensure_gateway_dirs()
        pending = len(list(gw.DRAFT_QUEUE_DIR.glob("draft-*.json")))
        results["reply_queue"] = f"OK ({pending} drafts)"
    except Exception as exc:
        results["reply_queue"] = f"ERROR: {exc}"

    try:
        from knowledge.runtime import bootstrap_knowledge_runtime
        kr = bootstrap_knowledge_runtime()
        results["knowledge_runtime"] = (
            f"OK ({kr.get('agent_count', 0)} agents)"
        )
    except Exception as exc:
        results["knowledge_runtime"] = f"ERROR: {exc}"

    return results


def health_response() -> str:
    checks = run_health_checks()
    lines = ["APCOO Health Check", ""]
    labels = {
        "telegram": "Telegram",
        "openai": "OpenAI",
        "memory": "Memory",
        "sales_brain": "Sales Brain",
        "constitution_runtime": "Constitution Runtime",
        "conversation_learning": "Conversation Learning",
        "sales_intelligence": "Sales Intelligence",
        "browser_adapter": "Browser Adapter",
        "reply_queue": "Reply Queue",
        "knowledge_runtime": "Knowledge Runtime",
    }
    for key, label in labels.items():
        lines.append(f"- {label}: {checks.get(key, 'UNKNOWN')}")
    return "\n".join(lines)
