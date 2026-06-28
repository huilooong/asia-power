"""WhatsApp tool — preview external messages; send requires CEO approval."""

from __future__ import annotations

from tools.tool_base import BaseTool, Permission, ToolResult


class WhatsAppTool(BaseTool):
    name = "whatsapp"
    description = "WhatsApp message preview/send (send requires CEO approval)"
    permission = Permission.EXTERNAL_MESSAGE
    requires_approval = True
    default_dry_run = True
    actions = ("preview", "send")

    def run(self, action: str, args: list[str], *, dry_run: bool = False) -> ToolResult:
        act = (action or "preview").strip().lower()
        message = " ".join(args).strip()
        if not message:
            return ToolResult(
                ok=False,
                output="Usage: /tool whatsapp preview <message>",
                tool_name=self.name,
                action=act,
            )
        if act == "send" and not dry_run:
            return ToolResult(
                ok=False,
                output=(
                    "WhatsApp send blocked without CEO approval.\n"
                    "Use: /tool whatsapp send <message> | approved\n"
                    "Auto-send not enabled in Tool Engine v0.6."
                ),
                risk_level="high",
                tool_name=self.name,
                action="send",
            )
        return ToolResult(
            ok=True,
            output=(
                f"[DRY RUN] WhatsApp message preview\n"
                f"To: (customer TBD via CRM)\n"
                f"Body: {message[:500]}\n"
                "Not sent. CEO approval required for formal outbound messages."
            ),
            dry_run=True,
            risk_level="medium",
            tool_name=self.name,
            action="preview" if act != "send" else "send",
        )


TOOL = WhatsAppTool()
