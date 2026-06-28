"""Base types for AsiaPower Tool Engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Permission(str, Enum):
    READ_ONLY = "read_only"
    WRITE = "write"
    DEPLOY = "deploy"
    PAYMENT = "payment"
    EXTERNAL_MESSAGE = "external_message"


# Actions that always require explicit CEO approval before live execution.
APPROVAL_REQUIRED_ACTIONS = frozenset({
    "deploy",
    "run",
    "execute",
    "send",
    "commit",
    "push",
    "delete",
    "payment",
    "quote_commit",
    "modify_constitution",
})


@dataclass
class ToolResult:
    ok: bool
    output: str
    dry_run: bool = False
    risk_level: str = "low"
    tool_name: str = ""
    action: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseTool:
    """Base class for registered tools."""

    name: str = ""
    description: str = ""
    permission: Permission = Permission.READ_ONLY
    requires_approval: bool = False
    default_dry_run: bool = False
    actions: tuple[str, ...] = ()

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        raise NotImplementedError

    def list_actions(self) -> str:
        if self.actions:
            return ", ".join(self.actions)
        return "(default)"
