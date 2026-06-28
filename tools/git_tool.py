"""Git tool — read-only repository inspection."""

from __future__ import annotations

import subprocess
from pathlib import Path

from tools.tool_base import BaseTool, Permission, ToolResult

ROOT = Path(__file__).resolve().parent.parent


class GitTool(BaseTool):
    name = "git"
    description = "Git repository status (read-only in Tool Engine)"
    permission = Permission.READ_ONLY
    requires_approval = False  # push/commit blocked inside tool; status is read-only
    default_dry_run = False
    actions = ("status", "branch", "log")

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        act = (action or "status").strip().lower()
        if act in ("push", "commit"):
            return ToolResult(
                ok=False,
                output=f"git {act} is blocked in Tool Engine. Use manual CEO workflow.",
                tool_name=self.name,
                action=act,
                risk_level="high",
            )
        if act == "branch":
            return self._run_git(["branch", "--show-current"], action="branch")
        if act == "log":
            n = args[0] if args else "5"
            return self._run_git(["log", f"-{n}", "--oneline"], action="log")
        return self._run_git(["status", "--short", "--branch"], action="status")

    def _run_git(self, git_args: list[str], *, action: str) -> ToolResult:
        try:
            proc = subprocess.run(
                ["git", *git_args],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=15,
            )
        except (subprocess.SubprocessError, FileNotFoundError) as exc:
            return ToolResult(
                ok=False,
                output=f"git {action} failed: {exc}",
                tool_name=self.name,
                action=action,
            )
        out = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        if proc.returncode != 0:
            return ToolResult(
                ok=False,
                output=err or out or f"git {action} exit {proc.returncode}",
                tool_name=self.name,
                action=action,
            )
        return ToolResult(
            ok=True,
            output=out or f"(git {action}: no output)",
            tool_name=self.name,
            action=action,
        )


TOOL = GitTool()
