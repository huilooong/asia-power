"""Risk classification for tool and agent actions."""

from __future__ import annotations

from tools.tool_base import Permission

CRITICAL_ACTIONS = frozenset({
    "run", "execute", "deploy", "delete", "payment",
    "modify_constitution", "push",
})

HIGH_ACTIONS = frozenset({
    "send", "commit", "quote_commit",
})

MEDIUM_ACTIONS = frozenset({
    "preview_update", "write", "update",
})


def classify_tool_risk(
    tool_name: str,
    action: str,
    permission: Permission | str,
    *,
    dry_run: bool = False,
) -> str:
    """Return risk level: low | medium | high | critical."""
    act = (action or "").lower().replace("_", "-")
    perm = permission.value if isinstance(permission, Permission) else str(permission)
    key = f"{tool_name}.{act}"

    if dry_run:
        if act in CRITICAL_ACTIONS or perm in ("deploy", "payment"):
            return "medium"
        return "low"

    if perm == "payment" or act in ("payment", "delete", "modify_constitution"):
        return "critical"
    if tool_name == "deploy" and act in ("run", "execute"):
        return "critical"
    if perm == "deploy":
        return "critical"
    if key in ("whatsapp.send", "telegram.send") or (
        perm == "external_message" and act == "send"
    ):
        return "high"
    if act in CRITICAL_ACTIONS:
        return "critical"
    if act in HIGH_ACTIONS or perm == "external_message":
        return "high"
    if act in MEDIUM_ACTIONS or perm == "write":
        return "medium"
    return "low"
