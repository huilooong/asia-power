"""Operational safety policy definitions."""

from __future__ import annotations

# Risk levels that require explicit CEO approval for live (non-dry-run) execution.
APPROVAL_REQUIRED_RISKS = frozenset({"high", "critical"})

# Critical actions are always blocked without | approved.
BLOCKED_WITHOUT_APPROVAL = frozenset({
    "deploy.run",
    "deploy.execute",
    "git.push",
    "git.commit",
    "whatsapp.send",
    "telegram.send",
    "payment",
    "delete",
    "modify_constitution",
})

# Tools that may never auto-execute live deploy in current policy version.
LIVE_DEPLOY_BLOCKED = True

# Directories included in operational backups.
BACKUP_DIRECTORIES = ("constitution", "memory", "runtime", "audit")
