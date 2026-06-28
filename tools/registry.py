"""Tool Registry — single entry for agent tool execution with permission + approval gates."""

from __future__ import annotations

from dataclasses import dataclass

from tools import memory_tool
from tools.deploy_tool import TOOL as DEPLOY_TOOL
from tools.git_tool import TOOL as GIT_TOOL
from tools.inventory_tool import TOOL as INVENTORY_TOOL
from tools.telegram_tool import TOOL as TELEGRAM_TOOL
from tools.tool_base import APPROVAL_REQUIRED_ACTIONS, BaseTool, Permission, ToolResult
from tools.vin_tool import TOOL as VIN_TOOL
from tools.whatsapp_tool import TOOL as WHATSAPP_TOOL

from audit.logger import (
    log_approval_required,
    log_deployment,
    log_error,
    log_external_message,
    log_tool_call,
)
from safety.approval_gate import check_approval, record_approval_if_granted
from safety.policy import LIVE_DEPLOY_BLOCKED
from safety.risk_classifier import classify_tool_risk

# APCOO default allowed permissions (L1/L2 from constitution).
AGENT_ALLOWED_PERMISSIONS = frozenset({
    Permission.READ_ONLY,
    Permission.WRITE,
})

HIGH_RISK_PERMISSIONS = frozenset({
    Permission.DEPLOY,
    Permission.PAYMENT,
    Permission.EXTERNAL_MESSAGE,
})


@dataclass
class ToolContext:
    source: str = "coo"
    channel: str = "cli"
    ceo_approved: bool = False


_REGISTRY: dict[str, BaseTool] = {}


def _register(tool: BaseTool) -> BaseTool:
    _REGISTRY[tool.name] = tool
    return tool


def bootstrap_registry() -> None:
    """Register all built-in tools (idempotent)."""
    if _REGISTRY:
        return
    for tool in (
        VIN_TOOL, INVENTORY_TOOL, DEPLOY_TOOL, GIT_TOOL,
        WHATSAPP_TOOL, TELEGRAM_TOOL,
    ):
        _register(tool)


def get_tool(name: str) -> BaseTool | None:
    bootstrap_registry()
    return _REGISTRY.get((name or "").strip().lower())


def list_tools() -> str:
    bootstrap_registry()
    lines = ["AsiaPower Tool Registry:", ""]
    for name in sorted(_REGISTRY):
        t = _REGISTRY[name]
        approval = "CEO approval for live" if t.requires_approval else "no approval"
        dry = "dry-run default" if t.default_dry_run else "live ok"
        lines.append(
            f"- {name} [{t.permission.value}] — {t.description}\n"
            f"  actions: {t.list_actions()} | {approval} | {dry}"
        )
    lines.extend([
        "",
        "Usage: /tool <name> <action> [args...]",
        "High-risk live actions: append | approved",
        "Examples:",
        "  /tool git status",
        "  /tool deploy dry-run",
        "  /tool vin LFMAY86C3K0406545",
        "  /tool inventory search G4KJ",
    ])
    return "\n".join(lines)


def _parse_approval_flag(parts: list[str]) -> tuple[list[str], bool]:
    if parts and parts[-1].lower() in ("approved", "ceo_approved", "yes"):
        return parts[:-1], True
    return parts, False


def _needs_approval(tool: BaseTool, action: str, *, dry_run: bool) -> bool:
    if dry_run:
        return False
    act = action.lower().replace("_", "-")
    if tool.requires_approval:
        return True
    if tool.permission in HIGH_RISK_PERMISSIONS:
        return True
    if act in APPROVAL_REQUIRED_ACTIONS:
        return True
    return False


def _check_permission(tool: BaseTool, action: str, *, ceo_approved: bool, dry_run: bool) -> str | None:
    act = (action or "").lower()
    read_actions = ("status", "search", "lookup", "branch", "log")
    if act in read_actions and tool.permission == Permission.READ_ONLY:
        return None
    if dry_run:
        return None
    if tool.permission in AGENT_ALLOWED_PERMISSIONS:
        return None
    if ceo_approved:
        return None
    return (
        f"Permission denied: {tool.name} requires {tool.permission.value}. "
        "Use dry-run/preview or append | approved for CEO-authorized execution."
    )


def _log_tool_call(
    tool: BaseTool,
    action: str,
    args: list[str],
    result: ToolResult,
    ctx: ToolContext,
    *,
    risk_level: str = "low",
) -> None:
    summary = (
        f"tool={tool.name} action={action} args={' '.join(args)[:120]} "
        f"ok={result.ok} dry_run={result.dry_run} risk={risk_level}"
    )
    try:
        log_tool_call(
            tool.name, action,
            args=args,
            ok=result.ok,
            dry_run=result.dry_run,
            risk_level=risk_level,
            source=ctx.source,
            channel=ctx.channel,
            result_summary=result.output,
        )
    except OSError:
        pass

    try:
        memory_tool.log_daily(
            summary,
            source=ctx.source,
            channel=ctx.channel,
            inbound=f"/tool {tool.name} {action}",
            outbound=result.output[:300],
        )
    except (ValueError, OSError):
        pass

    if result.risk_level in ("high", "medium", "critical") or tool.permission in HIGH_RISK_PERMISSIONS:
        try:
            memory_tool.record_decision(
                title=f"Tool call: {tool.name}.{action}",
                reason=f"Channel={ctx.channel} approved={ctx.ceo_approved} risk={risk_level}",
                decision=summary[:400],
                owner="APCOO",
                ceo_approval="approved" if ctx.ceo_approved else "pending",
                source=ctx.source,
                also_legacy=False,
            )
        except ValueError:
            pass

    if tool.name == "deploy":
        log_deployment(
            command=f"/tool {tool.name} {action}",
            dry_run=result.dry_run,
            ok=result.ok,
            detail=result.output[:300],
        )
    if tool.name in ("whatsapp", "telegram") and action in ("send", "preview"):
        log_external_message(
            channel=tool.name,
            preview=result.dry_run or action == "preview",
            ok=result.ok,
            summary=result.output[:200],
        )


def run_tool(
    tool_name: str,
    action: str,
    args: list[str],
    ctx: ToolContext | None = None,
    *,
    dry_run: bool | None = None,
) -> ToolResult:
    """Execute a registered tool with permission and approval checks."""
    bootstrap_registry()
    ctx = ctx or ToolContext()
    args, ceo_flag = _parse_approval_flag(list(args))
    if ceo_flag:
        ctx.ceo_approved = True

    tool = get_tool(tool_name)
    if not tool:
        return ToolResult(
            ok=False,
            output=f"Unknown tool: {tool_name}. Try /tools",
            tool_name=tool_name,
            action=action,
        )

    act = (action or "").strip().lower()
    if dry_run is None:
        if act in ("dry-run", "dry_run", "preview", "preview_update"):
            dry_run = True
        elif act in ("run", "send", "execute", "push", "commit"):
            dry_run = False
        else:
            dry_run = tool.default_dry_run and act not in ("status", "search", "lookup", "branch", "log")

    risk_level = classify_tool_risk(tool.name, act, tool.permission, dry_run=dry_run)
    command_str = f"/tool {tool_name} {act} {' '.join(args)}".strip()

    allowed, gate_reason = check_approval(
        tool.name, act, risk_level,
        ceo_approved=ctx.ceo_approved,
        dry_run=dry_run,
    )
    if not allowed:
        log_approval_required(act, risk_level, command_str, tool=tool.name)
        return ToolResult(
            ok=False,
            output=gate_reason,
            risk_level=risk_level,
            tool_name=tool.name,
            action=act,
        )

    perm_err = _check_permission(tool, act, ceo_approved=ctx.ceo_approved, dry_run=dry_run)
    if perm_err:
        return ToolResult(ok=False, output=perm_err, tool_name=tool.name, action=act, risk_level=risk_level)

    if _needs_approval(tool, act, dry_run=dry_run) and not ctx.ceo_approved:
        log_approval_required(act, risk_level, command_str, tool=tool.name)
        return ToolResult(
            ok=False,
            output=(
                f"CEO approval required for {tool.name} {act}.\n"
                "Use dry-run/preview first, then append | approved if authorized."
            ),
            risk_level=risk_level,
            tool_name=tool.name,
            action=act,
        )

    if ctx.ceo_approved:
        record_approval_if_granted(tool.name, act, risk_level, command_str, ceo_approved=True)

    # VIN tool: first arg may be the VIN when action looks like a VIN
    if tool.name == "vin" and act and act != "lookup" and not args:
        args = [act]
        act = "lookup"

    try:
        result = tool.run(act, args, dry_run=dry_run)
    except Exception as exc:
        log_error(str(exc), context=f"tool={tool.name} action={act}")
        return ToolResult(
            ok=False,
            output=f"Tool error: {exc}",
            risk_level=risk_level,
            tool_name=tool.name,
            action=act,
        )

    result.tool_name = tool.name
    result.action = act
    result.risk_level = risk_level

    if LIVE_DEPLOY_BLOCKED and tool.name == "deploy" and act == "run" and not dry_run:
        result = ToolResult(
            ok=False,
            output=(
                "Production deploy blocked by safety policy.\n"
                "Live deploy requires CEO approval and manual execution in v0.9."
            ),
            dry_run=False,
            risk_level="critical",
            tool_name=tool.name,
            action=act,
        )

    _log_tool_call(tool, act, args, result, ctx, risk_level=risk_level)
    return result


def run_tool_command(command_tail: str, ctx: ToolContext | None = None) -> str:
    """Parse '/tool name action args...' tail and return formatted output."""
    text = (command_tail or "").strip()
    if not text:
        return "Usage: /tool <name> <action> [args...]\nTry /tools to list registered tools."

    parts = text.split()
    tool_name = parts[0].lower()
    if tool_name == "vin" and len(parts) >= 2 and parts[1].upper() not in ("LOOKUP",):
        # /tool vin LFMAY86C3K0406545
        result = run_tool("vin", "lookup", parts[1:], ctx=ctx)
        return result.output

    if len(parts) < 2:
        # Default action per tool
        defaults = {
            "git": "status",
            "deploy": "dry-run",
            "telegram": "status",
            "inventory": "search",
            "whatsapp": "preview",
        }
        action = defaults.get(tool_name, "help")
        args: list[str] = []
    else:
        action = parts[1]
        args = parts[2:]

    result = run_tool(tool_name, action, args, ctx=ctx)
    prefix = "[DRY RUN] " if result.dry_run else ""
    status = "OK" if result.ok else "ERROR"
    return f"{prefix}[{status}] {result.output}"


def reset_registry_for_tests() -> None:
    """Clear registry (tests only)."""
    _REGISTRY.clear()
