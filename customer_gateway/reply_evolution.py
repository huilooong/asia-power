"""APBRAIN-002 Stage 6 — Reply evolution with CEO approval gate."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import sales_intelligence_paths as sip


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _reply_id() -> str:
    return f"rv-{uuid.uuid4().hex[:8]}"


def propose_reply_versions(talk: dict[str, Any]) -> dict[str, Any]:
    """Propose reply versions from talk optimization — pending CEO approval."""
    sip.ensure_dirs()
    pending_path = sip.REPLIES_DIR / "pending.json"
    approved_path = sip.REPLIES_DIR / "approved.json"

    existing_approved: list[dict[str, Any]] = []
    if approved_path.is_file():
        existing_approved = json.loads(approved_path.read_text(encoding="utf-8")).get("versions", [])

    proposals: list[dict[str, Any]] = []
    mapping = {
        "opening": talk.get("top_opening", []),
        "follow_up": talk.get("top_follow_up", []),
        "price_reply": talk.get("top_price_reply", []),
        "negotiation": talk.get("top_negotiation", []),
        "closing": talk.get("top_closing", []),
        "recovery": talk.get("top_recovery", []),
    }

    for category, items in mapping.items():
        for rank, item in enumerate(items[:2], 1):
            rate = item.get("success_rate_pct", 0)
            prev = next(
                (v for v in existing_approved if v.get("category") == category and v.get("rank") == rank),
                None,
            )
            version = (prev.get("version", 0) + 1) if prev else 1
            proposals.append({
                "reply_id": _reply_id(),
                "category": category,
                "rank": rank,
                "version": f"v{version}",
                "text": item.get("text", ""),
                "success_rate_pct": rate,
                "samples": item.get("samples", 0),
                "status": "pending_ceo_review",
                "approved": False,
                "proposed_at": _now(),
                "evidence": f"Based on {item.get('samples', 0)} historical samples, success rate {rate}%.",
            })

    pending = {"proposed_at": _now(), "versions": proposals}
    pending_path.write_text(json.dumps(pending, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"proposed": len(proposals), "pending_path": str(pending_path)}


def list_pending_replies() -> list[dict[str, Any]]:
    path = sip.REPLIES_DIR / "pending.json"
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("versions", [])


def load_approved_replies() -> list[dict[str, Any]]:
    """CEO-approved replies only — safe for Sales Brain context injection."""
    path = sip.REPLIES_DIR / "approved.json"
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("versions", [])


def approve_reply(reply_id: str) -> str:
    """CEO approves a reply version for Sales Brain use."""
    pending = list_pending_replies()
    target = next((v for v in pending if v.get("reply_id") == reply_id), None)
    if not target:
        raise ValueError(f"Reply not found in pending: {reply_id}")

    target["status"] = "approved"
    target["approved"] = True
    target["approved_at"] = _now()

    approved_path = sip.REPLIES_DIR / "approved.json"
    data = {"versions": []}
    if approved_path.is_file():
        data = json.loads(approved_path.read_text(encoding="utf-8"))

    versions = [v for v in data.get("versions", []) if not (
        v.get("category") == target.get("category") and v.get("rank") == target.get("rank")
    )]
    versions.append(target)
    data["versions"] = versions
    data["updated_at"] = _now()
    approved_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    remaining = [v for v in pending if v.get("reply_id") != reply_id]
    (sip.REPLIES_DIR / "pending.json").write_text(
        json.dumps({"versions": remaining, "updated_at": _now()}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return f"Reply {reply_id} ({target.get('category')} {target.get('version')}) approved for Sales Brain."


def reject_reply(reply_id: str) -> str:
    pending = list_pending_replies()
    remaining = [v for v in pending if v.get("reply_id") != reply_id]
    if len(remaining) == len(pending):
        raise ValueError(f"Reply not found: {reply_id}")
    (sip.REPLIES_DIR / "pending.json").write_text(
        json.dumps({"versions": remaining, "updated_at": _now()}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return f"Reply {reply_id} rejected (not applied to Sales Brain)."


def format_approved_context() -> str:
    """Read-only context block for Sales Brain — approved replies only."""
    approved = load_approved_replies()
    if not approved:
        return ""
    lines = ["--- Top Performing Replies (CEO Approved) ---"]
    for v in approved[:6]:
        lines.append(
            f"[{v.get('category')} {v.get('version')} | {v.get('success_rate_pct')}%] "
            f"{v.get('text', '')[:150]}"
        )
    lines.append("Use as reference patterns only — do not copy verbatim if context differs.")
    return "\n".join(lines)
