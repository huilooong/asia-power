"""Dispatch user messages to COO commands or routed agents — shared by CLI and Telegram."""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

from agents.agent_registry import normalize_agent_id, profile_id_for_agent
from agents.profile_loader import load_profile
from agents.router import route_with_profile
from config.models import AGENT_MODELS, DEFAULT_MODEL
from config.prompts import build_system_prompt
from coo_core.constitution_loader import build_constitution_context_for_agent
from core.language_router import get_router
from coo_core.critic import format_review, review_text
from coo_core.planner import create_plan, format_plan_output, materialize_plan
from coo_core.reporter import generate_daily_report
from tools import memory_tool, task_tool
from tools.registry import ToolContext, list_tools, run_tool_command

MEMORY_TAG_RE = re.compile(
    r"^MEMORY_TO_SAVE:\s*category=([^|]+)\|\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
DECISION_TAG_RE = re.compile(
    r"^DECISION_TO_SAVE:\s*title=([^|]+)\|\s*reason=([^|]+)\|\s*decision=([^|]+)(?:\|\s*owner=(.+))?$",
    re.IGNORECASE | re.MULTILINE,
)

COO_COMMANDS = (
    "/plan", "/tasks", "/report", "/review", "/help",
    "/remember", "/recall", "/decision", "/log",
    "/tools", "/tool", "/ping", "/health",
)


def is_coo_command(message: str) -> bool:
    text = (message or "").strip()
    if text == "/tools" or text.startswith("/tool "):
        return True
    return any(text.startswith(cmd) for cmd in COO_COMMANDS)


def coo_help_text() -> str:
    return (
        "AsiaPower COO — commands:\n"
        "/plan <goal> — create plan + tasks\n"
        "/tasks — task summary\n"
        "/report — daily COO report\n"
        "/review <text> — Critic review\n"
        "/remember [category] | <note> — save long-term memory\n"
        "/recall <keyword> — search memory\n"
        "/decision <title> | <reason> | <decision> [| approved|pending]\n"
        "/log [summary] — show or append today's daily log\n"
        "/tools — list registered tools\n"
        "/tool <name> <action> [args] — run tool via registry\n"
        "/ping — APCOO online status\n"
        "/health — subsystem health check\n"
        "/help — this message\n\n"
        "Or send any message for routed agent chat (Sales, Inventory, etc.)."
    )


def memory_context_snippet(message: str = "", max_chars: int = 2000) -> str:
    return memory_tool.load_context_for_message(message, max_chars=max_chars)


def strip_memory_tags(text: str) -> str:
    cleaned = MEMORY_TAG_RE.sub("", text)
    cleaned = DECISION_TAG_RE.sub("", cleaned)
    return cleaned.strip()


def apply_memory_tags(text: str, source_agent: str) -> list[str]:
    actions: list[str] = []

    for match in DECISION_TAG_RE.finditer(text):
        title, reason, decision, owner = match.groups()
        actions.append(memory_tool.save_decision(
            title=title.strip(),
            reason=reason.strip(),
            decision=decision.strip(),
            owner=owner.strip() if owner else None,
        ))

    for match in MEMORY_TAG_RE.finditer(text):
        category, content = match.groups()
        cat = category.strip().lower()
        body = content.strip()
        if cat == "customer":
            actions.append(memory_tool.save_customer_note("general", body, source_agent))
        elif cat == "decision":
            actions.append(memory_tool.save_decision(
                "Recorded decision", "From agent memory tag", body, source_agent,
            ))
        else:
            actions.append(memory_tool.save_memory(cat, body, source_agent))

    return actions


def fallback_decision_from_user(message: str, source_agent: str) -> str | None:
    if "决定" not in message and "决策" not in message:
        return None
    if "记录" not in message and "记下" not in message:
        return None
    parts = re.split(r"[：:]", message, maxsplit=1)
    decision_text = parts[1].strip() if len(parts) > 1 else message.strip()
    if not decision_text:
        return None
    return memory_tool.save_decision(
        "User-recorded decision",
        "Captured from user message",
        decision_text,
        source_agent,
    )


def call_openai(client: OpenAI, model: str, system_prompt: str, user_message: str) -> str:
    response = client.responses.create(
        model=model,
        instructions=system_prompt + memory_context_snippet(user_message),
        input=user_message,
    )
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text
    chunks: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                chunks.append(text)
    return "\n".join(chunks).strip()


def dispatch_coo_command(message: str, channel: str = "cli") -> str:
    """Handle COO slash commands without OpenAI."""
    text = message.strip()

    if text.startswith("/help") or text == "/start":
        return coo_help_text()

    if text.startswith("/ping"):
        from coo_core.health_check import ping_response
        return ping_response()

    if text.startswith("/health"):
        from coo_core.health_check import health_response
        return health_response()

    if text.startswith("/plan"):
        goal = text[len("/plan"):].strip()
        if not goal:
            return "Usage: /plan <goal>"
        plan = create_plan(goal)
        created = materialize_plan(plan, created_by="coo")
        return format_plan_output(plan, created)

    if text.startswith("/tasks"):
        summary = task_tool.summarize_tasks()
        lines = [f"Task summary — total: {summary['total']}"]
        for status, count in summary["by_status"].items():
            if count:
                lines.append(f"  {status}: {count}")
        if summary["urgent_active"]:
            lines.append("\nUrgent / high:")
            for t in summary["urgent_active"][:5]:
                lines.append(f"  - [{t['id']}] {t['title']}")
        if summary["pending"]:
            lines.append("\nPending:")
            for t in summary["pending"][:8]:
                lines.append(f"  - [{t['id']}] {t['title']} → {t['owner_agent']}")
        return "\n".join(lines)

    if text.startswith("/report"):
        return generate_daily_report()

    if text.startswith("/review"):
        body = text[len("/review"):].strip()
        if not body:
            return "Usage: /review <engineer output text>"
        return format_review(review_text(body))

    if text.startswith("/remember"):
        body = text[len("/remember"):].strip()
        if not body:
            return "Usage: /remember [category] | <note>\nExample: /remember plan | Deploy VIN tool phase 1"
        category = "general"
        content = body
        if "|" in body:
            left, _, right = body.partition("|")
            category = left.strip().lower() or "general"
            content = right.strip()
        project = None
        if category.startswith("project:"):
            project = category.split(":", 1)[1].strip()
            category = "project"
        try:
            return memory_tool.remember(content, category=category, source="coo", project=project)
        except ValueError as exc:
            return f"Error: {exc}"

    if text.startswith("/recall"):
        keyword = text[len("/recall"):].strip()
        if not keyword:
            return "Usage: /recall <keyword>"
        return memory_tool.recall(keyword)

    if text.startswith("/decision"):
        body = text[len("/decision"):].strip()
        if not body:
            return (
                "Usage: /decision <title> | <reason> | <decision> [| approved|pending]\n"
                "Important decisions (deploy, production, etc.) require CEO approval status."
            )
        parts = [p.strip() for p in body.split("|")]
        if len(parts) < 3:
            return "Usage: /decision <title> | <reason> | <decision> [| approved|pending]"
        title, reason, decision = parts[0], parts[1], parts[2]
        approval = parts[3] if len(parts) > 3 else "not_required"
        try:
            return memory_tool.record_decision(
                title, reason, decision,
                owner="CEO",
                ceo_approval=approval,
                source="coo",
            )
        except ValueError as exc:
            return f"Error: {exc}"

    if text.startswith("/log"):
        body = text[len("/log"):].strip()
        if not body:
            return memory_tool.list_daily_log()
        try:
            return memory_tool.log_daily(body, source="coo", channel="cli")
        except ValueError as exc:
            return f"Error: {exc}"

    if text == "/tools":
        return list_tools()

    if text.startswith("/tool "):
        body = text[len("/tool "):].strip()
        ctx = ToolContext(source="coo", channel=channel)
        return run_tool_command(body, ctx=ctx)

    return f"Unknown command. Try: {', '.join(COO_COMMANDS)}"


def dispatch_message(
    text: str,
    source: str = "cli",
    user_id: str | None = None,
    agent_id: str = "apcoo",
) -> str:
    """Single entry for CLI and Telegram. Returns reply text."""
    message = (text or "").strip()
    if not message:
        return ""

    canonical = normalize_agent_id(agent_id)

    if canonical == "apsales":
        from sales_core.apsales_handler import (
            dispatch_apsales_command,
            is_apsales_command,
            is_slash_command,
            process_apsales_enquiry,
        )
        if is_apsales_command(message) or message == "/start":
            return dispatch_apsales_command(message, channel=source)
        if is_slash_command(message):
            return "Unknown command. Try /help"
        return process_apsales_enquiry(message, channel=source)

    # Default: APCOO (unchanged behaviour)
    if is_coo_command(message) or message == "/start":
        return dispatch_coo_command(message, channel=source)

    if message.startswith("/"):
        return "Unknown command. Try /help"

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "Error: OPENAI_API_KEY not set. COO slash commands still work without it."

    import traceback

    try:
        client = OpenAI(api_key=api_key)
        routed_id, profile = route_with_profile(message)
        model = AGENT_MODELS.get(routed_id, DEFAULT_MODEL)

        constitution_ctx = build_constitution_context_for_agent(routed_id)
        system_prompt = (
            f"{constitution_ctx}\n\n---\n\n"
            f"{build_system_prompt(routed_id, profile)}"
        )
        if source == "telegram":
            router = get_router()
            router.resolve_target_language("apcoo", "ceo", message)
            system_prompt += router.internal_channel_addon("telegram")
            print(
                f"[APCOO DEBUG] openai route agent={routed_id} model={model} "
                f"chat_len={len(message)}",
                flush=True,
            )
        reply = call_openai(client, model, system_prompt, message)
        memory_actions = apply_memory_tags(reply, source_agent=routed_id)

        if "DECISION_TO_SAVE:" not in reply and not any(
            a.startswith("Saved decision:") for a in memory_actions
        ):
            fallback = fallback_decision_from_user(message, source_agent=routed_id)
            if fallback:
                memory_actions.append(fallback)

        visible = strip_memory_tags(reply)
        if not visible and memory_actions:
            visible = "(Recorded via Memory Tool.)"

        if memory_actions:
            memory_lines = "\n".join(f"✓ {a}" for a in memory_actions)
            visible = f"{visible}\n\n— Memory —\n{memory_lines}"

        memory_tool.log_conversation(
            message, visible,
            source=routed_id,
            channel=source,
            important=bool(memory_actions) or len(message) > 20,
        )
        if source == "telegram":
            print(f"[APCOO DEBUG] reply_len={len(visible or '')}", flush=True)
        return visible
    except Exception as exc:
        print(
            f"[APCOO DEBUG] dispatch_exception error={exc}\n{traceback.format_exc()}",
            flush=True,
        )
        if source == "telegram":
            return (
                "APCOO 已收到你的消息。\n"
                "系统处理中发生异常。\n"
                "请稍后重试。\n"
                "（错误已记录）"
            )
        return f"Error: {exc}"


def log_dispatch(channel: str, inbound: str, outbound: str, sender: str = "") -> None:
    """Optional CLI session log (separate from message_tool audit)."""
    logs_dir = Path(__file__).resolve().parent.parent / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = logs_dir / f"dispatch-{day}.log"
    with path.open("a", encoding="utf-8") as f:
        f.write(
            f"[{datetime.now(timezone.utc).isoformat()}] channel={channel} sender={sender}\n"
            f"IN: {inbound}\nOUT: {outbound[:500]}\n\n"
        )
