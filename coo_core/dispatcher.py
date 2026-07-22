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


def call_openai(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_message: str,
    *,
    knowledge_addon: str = "",
) -> str:
    extra = knowledge_addon or memory_context_snippet(user_message)
    response = client.responses.create(
        model=model,
        instructions=system_prompt + extra,
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

    if canonical == "apinventory":
        from inventory_core.apinventory_handler import (
            dispatch_apinventory_command,
            is_apinventory_command,
            is_slash_command,
            process_inventory_query,
        )
        if is_apinventory_command(message) or message == "/start":
            return dispatch_apinventory_command(message, channel=source)
        if is_slash_command(message):
            return "Unknown command. Try /help"
        return process_inventory_query(message, channel=source)

    # Default: APCOO (unchanged behaviour)
    if is_coo_command(message) or message == "/start":
        return dispatch_coo_command(message, channel=source)

    if message.startswith("/"):
        return "Unknown command. Try /help"

    # COO approval gate — works without OpenAI.
    from coo_core.approval_gate import (
        detect_catastrophic_intent,
        format_ceo_request,
        format_resolution,
        open_approval,
        resolve_reply,
    )

    resolved = resolve_reply(message)
    if resolved:
        # Sales Coach closed loop: approved agent_prompt_fix → write Cursor plan file only.
        if (
            resolved.get("decision") == "approved"
            and (resolved.get("record") or {}).get("action") == "agent_prompt_fix"
        ):
            try:
                from sales_coach.dispatch_to_cursor import write_coach_fix_plan

                plan_path = write_coach_fix_plan(resolved["record"])
                resolved["cursor_plan_path"] = str(plan_path)
                print(f"[APCOO DEBUG] mode=coach_dispatch_plan path={plan_path}", flush=True)
            except Exception as exc:  # noqa: BLE001
                resolved["cursor_plan_path"] = ""
                print(f"[APCOO DEBUG] mode=coach_dispatch_failed error={exc}", flush=True)
        # Explicit reject → remember rule_id so auto-dispatch will skip forever (until cleared).
        if (
            resolved.get("decision") == "rejected"
            and (resolved.get("record") or {}).get("action") == "agent_prompt_fix"
        ):
            try:
                from sales_coach.escalation import mark_rejected_from_approval_record

                rid = mark_rejected_from_approval_record(
                    resolved["record"],
                    note=str(resolved.get("note") or message or "")[:200],
                )
                print(f"[APCOO DEBUG] mode=coach_reject_rule rule_id={rid}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"[APCOO DEBUG] mode=coach_reject_failed error={exc}", flush=True)
        visible = format_resolution(resolved)
        memory_tool.log_conversation(
            message, visible, source="apcoo", channel=source, important=True,
        )
        return visible

    catastrophic = detect_catastrophic_intent(message)
    if catastrophic:
        action, _level = catastrophic
        rec = open_approval(action, request_text=message, chat_id=user_id or "")
        visible = format_ceo_request(rec)
        print("[APCOO DEBUG] mode=approval_gate_catastrophic action=" + action, flush=True)
        memory_tool.log_conversation(
            message, visible, source="apcoo", channel=source, important=True,
        )
        return visible

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "Error: OPENAI_API_KEY not set. COO slash commands still work without it."

    import traceback

    try:
        client = OpenAI(api_key=api_key, timeout=60.0, max_retries=1)
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

        from coo_core.ceo_ops_briefing import (
            detect_ceo_ops_query,
            detect_website_content_query,
            render_ceo_daily_brief,
            user_explicitly_requests_memory,
            website_content_prompt_addon,
        )
        allow_memory_save = user_explicitly_requests_memory(message)
        if detect_website_content_query(message):
            system_prompt += website_content_prompt_addon()
        elif detect_ceo_ops_query(message):
            visible = render_ceo_daily_brief()
            print(
                f"[APCOO DEBUG] mode=ceo_ops_briefing reply_len={len(visible)} "
                f"(deterministic CEO Daily Brief)",
                flush=True,
            )
            memory_tool.log_conversation(
                message, visible,
                source="apcoo",
                channel=source,
                important=True,
            )
            return visible
        from truth.truth_guard import is_business_intelligence_query
        if is_business_intelligence_query(message):
            from truth.verified_sales_intelligence import build_verified_ceo_report
            visible = build_verified_ceo_report(message)
            print(
                f"[APCOO DEBUG] mode=verified_sales_intelligence reply_len={len(visible)} "
                f"(deterministic, no LLM)",
                flush=True,
            )
            memory_tool.log_conversation(
                message, visible,
                source="apcoo",
                channel=source,
                important=True,
            )
            return visible

        # Optional knowledge-runtime augmentation. The `knowledge` package is not
        # present in this build; when it is unavailable we skip augmentation and
        # the post-reply audit, falling back to the base prompt. Verified-data
        # protection for BI/data queries already ran above via truth.*.
        knowledge_addon = ""
        bundle = None
        audit_and_enforce = None
        try:
            from knowledge.guard import (
                audit_and_enforce,
                knowledge_system_addon,
                requires_knowledge_query,
            )
            from knowledge.runtime import bootstrap_knowledge_runtime, get_runtime

            bootstrap_knowledge_runtime()
            runtime = get_runtime()
            bundle = runtime.query(message, agent_id=routed_id)

            if requires_knowledge_query(message):
                if not bundle.has_facts():
                    visible = bundle.format_no_data_response()
                    print(
                        f"[APCOO DEBUG] mode=knowledge_runtime_no_data reply_len={len(visible)}",
                        flush=True,
                    )
                    memory_tool.log_conversation(
                        message, visible,
                        source="apcoo",
                        channel=source,
                        important=True,
                    )
                    return visible
                system_prompt += knowledge_system_addon(bundle)
                knowledge_addon = "\n"  # memory already in bundle via memory provider
            elif bundle.has_facts():
                system_prompt += (
                    "\n\n--- Knowledge Runtime (read-only facts) ---\n"
                    + bundle.format_context(max_chars=2500)
                )
                knowledge_addon = "\n"
        except ImportError:
            pass

        if source == "telegram":
            print(
                f"[APCOO DEBUG] openai route agent={routed_id} model={model} "
                f"chat_len={len(message)} knowledge_domains={bundle.domains_queried if bundle else 'n/a'}",
                flush=True,
            )
        reply = call_openai(
            client, model, system_prompt, message, knowledge_addon=knowledge_addon,
        )

        # COO emitted an APPROVAL_REQUEST tag → open a gated, audited approval.
        from coo_core.approval_gate import (
            format_ceo_request as _fmt_req,
            open_approval as _open_approval,
            parse_approval_tag,
            strip_approval_tag,
        )
        approval_card = ""
        _tag = parse_approval_tag(reply)
        if _tag:
            _action, _risk, _why = _tag
            _rec = _open_approval(_action, why=_why, request_text=message, chat_id=user_id or "")
            approval_card = "\n\n" + _fmt_req(_rec)
            reply = strip_approval_tag(reply)
            print(f"[APCOO DEBUG] mode=approval_gate_tag action={_action}", flush=True)

        memory_actions = (
            apply_memory_tags(reply, source_agent=routed_id) if allow_memory_save else []
        )

        if allow_memory_save and "DECISION_TO_SAVE:" not in reply and not any(
            a.startswith("Saved decision:") for a in memory_actions
        ):
            fallback = fallback_decision_from_user(message, source_agent=routed_id)
            if fallback:
                memory_actions.append(fallback)

        if audit_and_enforce is not None:
            ok, audited = audit_and_enforce(strip_memory_tags(reply), bundle=bundle)
        else:
            ok, audited = True, strip_memory_tags(reply)
        if not ok:
            print("[APCOO DEBUG] mode=knowledge_audit_blocked", flush=True)
            visible = audited
        else:
            visible = strip_memory_tags(reply)
        if not visible and memory_actions:
            visible = "(Recorded via Memory Tool.)"

        if memory_actions:
            memory_lines = "\n".join(f"✓ {a}" for a in memory_actions)
            visible = f"{visible}\n\n— Memory —\n{memory_lines}"

        if approval_card:
            visible = f"{visible}{approval_card}".strip()

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
