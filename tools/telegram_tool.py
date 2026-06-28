"""Telegram tool — COO bot utilities (preview/send gated)."""

from __future__ import annotations

import os

from tools.tool_base import BaseTool, Permission, ToolResult


class TelegramTool(BaseTool):
    name = "telegram"
    description = "Telegram COO bot status and message preview"
    permission = Permission.EXTERNAL_MESSAGE
    requires_approval = True
    default_dry_run = True
    actions = ("status", "preview", "send")

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        act = (action or "status").strip().lower()
        if act == "status":
            token = bool(os.getenv("COO_TELEGRAM_BOT_TOKEN"))
            allowed = os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS", "")
            return ToolResult(
                ok=True,
                output=(
                    "Telegram COO bot status:\n"
                    f"- COO_TELEGRAM_BOT_TOKEN: {'set' if token else 'missing'}\n"
                    f"- COO_TELEGRAM_ALLOWED_CHAT_IDS: {allowed or '(empty)'}\n"
                    "- Run: python integrations/telegram_coo_bot.py"
                ),
                tool_name=self.name,
                action="status",
            )
        message = " ".join(args).strip()
        if not message:
            return ToolResult(
                ok=False,
                output="Usage: /tool telegram preview <message>",
                tool_name=self.name,
                action=act,
            )
        if act == "send" and not dry_run:
            return ToolResult(
                ok=False,
                output=(
                    "Telegram send via Tool Engine blocked without CEO approval.\n"
                    "Use COO chat or: /tool telegram send <msg> | approved"
                ),
                risk_level="high",
                tool_name=self.name,
                action="send",
            )
        return ToolResult(
            ok=True,
            output=(
                f"[DRY RUN] Telegram message preview\n"
                f"Body: {message[:500]}\n"
                "Not sent via tool layer."
            ),
            dry_run=True,
            tool_name=self.name,
            action="preview",
        )


TOOL = TelegramTool()
