"""Deploy tool — dry-run preview only unless CEO approved."""

from __future__ import annotations

from pathlib import Path

from tools.tool_base import BaseTool, Permission, ToolResult

ROOT = Path(__file__).resolve().parent.parent
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy-production.mjs"
DEFAULT_REMOTE = "root@159.65.86.24"
SITE_PATH = "/root/.openclaw/workspace/inventory-site"


class DeployTool(BaseTool):
    name = "deploy"
    description = "Production deploy preview (live deploy requires CEO approval)"
    permission = Permission.DEPLOY
    requires_approval = True
    default_dry_run = True
    actions = ("dry-run", "dry_run", "preview", "run")

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        act = (action or "dry-run").strip().lower().replace("_", "-")
        if act in ("dry-run", "preview", ""):
            return self._preview()
        if act == "run":
            if dry_run:
                return self._preview(extra="(run requested but dry_run forced)")
            return ToolResult(
                ok=False,
                output=(
                    "Production deploy blocked.\n"
                    "Live deploy requires CEO approval: /tool deploy run | approved\n"
                    "Tool Engine will not execute rsync/SSH automatically in v0.6."
                ),
                risk_level="high",
                tool_name=self.name,
                action="run",
            )
        return ToolResult(
            ok=False,
            output="Usage: /tool deploy dry-run\n       /tool deploy run | approved (blocked in v0.6)",
            tool_name=self.name,
            action=act,
        )

    def _preview(self, extra: str = "") -> ToolResult:
        excludes = [
            ".git", ".venv", "data", "server", "memory", ".env", "node_modules",
        ]
        lines = [
            "[DRY RUN] Production deploy preview",
            f"Script: {DEPLOY_SCRIPT.relative_to(ROOT)}",
            f"Remote: {DEFAULT_REMOTE}",
            f"Target: {SITE_PATH}/public/",
            "",
            "Would sync:",
            "  - Static site → public/",
            "  - server.js + lib/",
            "  - systemd service + health-watch",
            "  - Telegram reminder scripts",
            "",
            "Excluded (not deployed): " + ", ".join(excludes[:6]) + ", ...",
            "",
            "No rsync/SSH executed. CEO approval required for live deploy.",
        ]
        if extra:
            lines.append(extra)
        return ToolResult(
            ok=True,
            output="\n".join(lines),
            dry_run=True,
            risk_level="high",
            tool_name=self.name,
            action="dry-run",
        )


TOOL = DeployTool()
