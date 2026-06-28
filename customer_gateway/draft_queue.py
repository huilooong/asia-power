"""Draft queue — Telegram approval workflow (approve does NOT send WhatsApp)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit.logger import log_approval_granted, log_event
from customer_gateway import gateway_readonly as gw
from customer_gateway.gateway_readonly import assert_readonly

VALID_STATUSES = ("pending", "approved", "rejected", "revised")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _draft_path(draft_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", draft_id)
    return gw.DRAFT_QUEUE_DIR / f"{safe}.json"


def save_draft(payload: dict[str, Any]) -> dict[str, Any]:
    gw.ensure_gateway_dirs()
    assert_readonly("save_draft_queue")

    draft_id = payload.get("draft_id") or f"draft-{_now().replace(' ', 'T').replace(':', '')}-{uuid.uuid4().hex[:8]}"
    record = {
        "draft_id": draft_id,
        "customer_hash": payload.get("customer_hash", ""),
        "customer_name": payload.get("customer_name", "unknown"),
        "detected_language": payload.get("detected_language", "en"),
        "original_message": payload.get("original_message", ""),
        "internal_analysis_zh": payload.get("internal_analysis_zh", ""),
        "customer_reply_draft": payload.get("customer_reply_draft", ""),
        "risk_level": payload.get("risk_level", "medium"),
        "approval_required": bool(payload.get("approval_required", True)),
        "next_action": payload.get("next_action", "monitor"),
        "category": payload.get("category", "unknown"),
        "status": "pending",
        "created_at": _now(),
        "updated_at": _now(),
        "message_id": payload.get("message_id", ""),
        "chat_id": payload.get("chat_id", ""),
        "products": payload.get("products", []),
        "revision_note": "",
        "approved_by": "",
    }

    _draft_path(draft_id).write_text(
        json.dumps(record, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log_event("draft_created", draft_id=draft_id, customer=record["customer_name"])
    return record


def load_draft(draft_id: str) -> dict[str, Any] | None:
    path = _draft_path(draft_id)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_drafts(*, status: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    gw.ensure_gateway_dirs()
    drafts: list[dict[str, Any]] = []
    for path in sorted(gw.DRAFT_QUEUE_DIR.glob("draft-*.json"), reverse=True):
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if status and d.get("status") != status:
            continue
        drafts.append(d)
        if len(drafts) >= limit:
            break
    return drafts


def approve_draft(draft_id: str, *, approved_by: str = "CEO") -> dict[str, Any]:
    """CEO approves draft content — does NOT send WhatsApp (phase 1)."""
    assert_readonly("approve_draft_record")
    draft = load_draft(draft_id)
    if not draft:
        raise ValueError(f"Draft not found: {draft_id}")

    draft["status"] = "approved"
    draft["approved_by"] = approved_by
    draft["updated_at"] = _now()
    _draft_path(draft_id).write_text(json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8")

    log_approval_granted(
        action="apsales.whatsapp_draft",
        risk_level=draft.get("risk_level", "medium"),
        command=f"draft:{draft_id}",
        approved_by=approved_by,
        result="approved_not_sent",
    )
    log_event(
        "draft_approved",
        draft_id=draft_id,
        approved_by=approved_by,
        note="WhatsApp NOT sent — phase 1",
    )
    return draft


def reject_draft(draft_id: str, *, rejected_by: str = "CEO") -> dict[str, Any]:
    draft = load_draft(draft_id)
    if not draft:
        raise ValueError(f"Draft not found: {draft_id}")
    draft["status"] = "rejected"
    draft["approved_by"] = rejected_by
    draft["updated_at"] = _now()
    _draft_path(draft_id).write_text(json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8")
    log_event("draft_rejected", draft_id=draft_id, rejected_by=rejected_by)
    return draft


def revise_draft(draft_id: str, note: str, *, by: str = "CEO") -> dict[str, Any]:
    draft = load_draft(draft_id)
    if not draft:
        raise ValueError(f"Draft not found: {draft_id}")
    draft["status"] = "revised"
    draft["revision_note"] = note.strip()
    draft["approved_by"] = by
    draft["updated_at"] = _now()
    _draft_path(draft_id).write_text(json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8")
    log_event("draft_revise_requested", draft_id=draft_id, note=note[:200], by=by)
    return draft


def format_draft_list(drafts: list[dict[str, Any]]) -> str:
    if not drafts:
        return "暂无待处理草稿。运行 /whatsapp listen --readonly 监听新消息。"
    lines = ["WhatsApp 回复草稿队列（只读阶段 — approve 不发送）", ""]
    for d in drafts:
        lines.append(
            f"- {d['draft_id']} | {d['customer_name']} | "
            f"{d.get('category', '?')} | {d.get('status', 'pending')} | "
            f"风险:{d.get('risk_level')} | 审批:{'是' if d.get('approval_required') else '否'}"
        )
    lines.append("")
    lines.append("查看: /drafts show <draft_id>")
    return "\n".join(lines)


def format_draft_detail(draft: dict[str, Any]) -> str:
    lines = [
        f"草稿 ID: {draft['draft_id']}",
        f"客户: {draft['customer_name']} ({draft.get('customer_hash', '')[:8]}…)",
        f"语言: {draft.get('detected_language')}",
        f"分类: {draft.get('category')}",
        f"风险: {draft.get('risk_level')}",
        f"需审批: {'是' if draft.get('approval_required') else '否'}",
        f"下一步: {draft.get('next_action')}",
        f"状态: {draft.get('status')}",
        f"创建: {draft.get('created_at')}",
        "",
        "—— 客户原消息 ——",
        draft.get("original_message", ""),
        "",
        "—— 中文内部分析 ——",
        draft.get("internal_analysis_zh", ""),
        "",
        "—— 客户回复草稿（未发送）——",
        draft.get("customer_reply_draft", ""),
        "",
        "操作: /drafts approve | reject | revise <draft_id> [意见]",
        "注意: approve 仅表示 CEO 同意草稿，本阶段不发送 WhatsApp。",
    ]
    if draft.get("revision_note"):
        lines.extend(["", f"修改意见: {draft['revision_note']}"])
    return "\n".join(lines)
