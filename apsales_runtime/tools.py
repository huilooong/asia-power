"""APSales tool framework — registry wrapper + future tool stubs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from tools.registry import ToolContext, bootstrap_registry, get_tool, list_tools, run_tool
from tools.tool_base import BaseTool, Permission, ToolResult

# Future tools — runtime stubs (no business logic)
_STUB_TOOLS: dict[str, BaseTool] = {}


class _StubTool(BaseTool):
    def __init__(self, name: str, description: str) -> None:
        self.name = name
        self.description = description
        self.permission = Permission.READ_ONLY
        self.requires_approval = name in {"whatsapp", "email"}
        self.default_dry_run = name in {"whatsapp", "email"}
        self.actions = ("status", "help")

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        return ToolResult(
            ok=True,
            output=(
                f"[{self.name}] runtime stub — tool registered, business handler not wired.\n"
                f"action={action} dry_run={dry_run}\n"
                "Implement handler in future APSales task processors."
            ),
            dry_run=True,
            tool_name=self.name,
            action=action,
            metadata={"stub": True},
        )


def _ensure_stub_tools() -> None:
    if _STUB_TOOLS:
        return
    for name, desc in (
        ("email", "Email inbox/outbox integration (stub)"),
        ("browser", "Social browser automation (stub)"),
        ("search", "Web/platform search (stub)"),
        ("pricing", "Quote/pricing engine (stub)"),
        ("translation", "Customer language translation (stub)"),
        ("memory", "Persistent memory read/write (stub routes to memory_tool)"),
    ):
        _STUB_TOOLS[name] = _StubTool(name, desc)


@dataclass
class ToolFramework:
    """APSales-facing tool layer over AsiaPower registry."""

    enabled: list[str]

    def bootstrap(self) -> None:
        bootstrap_registry()
        _ensure_stub_tools()

    def available_tools(self) -> list[str]:
        self.bootstrap()
        names = set(self.enabled)
        names.update({"vin", "inventory", "whatsapp", "telegram"})
        return sorted(names)

    def describe(self) -> str:
        self.bootstrap()
        lines = ["APSales Tool Framework:", ""]
        for name in self.available_tools():
            tool = get_tool(name) or _STUB_TOOLS.get(name)
            if tool:
                lines.append(f"- {name}: {tool.description}")
            else:
                lines.append(f"- {name}: (not registered)")
        lines.append("")
        lines.append(list_tools().split("\n")[0])
        return "\n".join(lines)

    def invoke(
        self,
        tool_name: str,
        action: str,
        args: list[str] | None = None,
        *,
        ctx: ToolContext | None = None,
        dry_run: bool | None = None,
    ) -> ToolResult:
        self.bootstrap()
        name = (tool_name or "").strip().lower()
        if name == "memory":
            return ToolResult(
                ok=True,
                output="Use memory_tool via APSales memory scopes (MemoryStore).",
                dry_run=True,
                tool_name="memory",
                action=action,
            )
        stub = _STUB_TOOLS.get(name)
        real = get_tool(name)
        if real:
            return run_tool(name, action, args or [], ctx=ctx, dry_run=dry_run)
        if stub and name in self.enabled:
            return stub.run(action, args or [], dry_run=dry_run if dry_run is not None else True)
        return ToolResult(
            ok=False,
            output=f"Tool not enabled or unknown: {name}",
            tool_name=name,
            action=action,
        )

    def health(self) -> dict[str, Any]:
        self.bootstrap()
        report: dict[str, Any] = {"tools": {}}
        for name in self.available_tools():
            real = get_tool(name)
            stub = _STUB_TOOLS.get(name)
            report["tools"][name] = {
                "registered": bool(real or stub),
                "implementation": "live" if real else ("stub" if stub else "missing"),
            }
        return report
