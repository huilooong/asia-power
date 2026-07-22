"""COO approval gate — make "the agent needs authorization" a real, CEO-gated, audited event.

Safe-scope design: the COO holds NO destructive executors. This module turns L3/L4 intent
into an explicit approval request that is (1) logged, (2) pushed to the CEO on Telegram, and
(3) resolved only by an explicit CEO reply. It is the hard gate future tools will sit behind —
not a prompt suggestion.

Two detection paths:
- LLM tag: the COO emits `APPROVAL_REQUEST: action=<a> | risk=<level> | why=<reason>` (parsed here),
  mirroring the existing MEMORY_TO_SAVE / DECISION_TO_SAVE tag convention.
- Catastrophic regex net: unambiguous L4 intents (delete db/memory, payment, keys) are gated
  even if the model forgets the tag.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.approval_router import ApprovalLevel
from audit.logger import log_approval_granted, log_approval_required, log_event
from integrations.telegram_access import parse_allowed_chat_ids

ROOT = Path(__file__).resolve().parent.parent
PENDING_DIR = ROOT / "memory" / "approvals" / "pending"
RESOLVED_DIR = ROOT / "memory" / "approvals" / "resolved"

# Action → required approval level, aligned with constitution L1–L4.
# L4 actions are human-only: the agent escalates and never executes, even if "approved".
_ACTION_LEVEL: dict[str, ApprovalLevel] = {
    "deploy": ApprovalLevel.CRITICAL,
    "git_push": ApprovalLevel.HIGH,
    "server_change": ApprovalLevel.CRITICAL,
    "create_agent": ApprovalLevel.HIGH,
    "external_api": ApprovalLevel.HIGH,
    "delete_data": ApprovalLevel.CRITICAL,
    "delete_memory": ApprovalLevel.CRITICAL,
    "modify_constitution": ApprovalLevel.CRITICAL,
    "payment": ApprovalLevel.CRITICAL,
    "api_key": ApprovalLevel.CRITICAL,
    "bank_operation": ApprovalLevel.CRITICAL,
    # Sales Coach → CEO → Cursor plan file (no direct prod code change).
    "agent_prompt_fix": ApprovalLevel.MEDIUM,
}

# L4 — human only. Agent must escalate; "approved" still does NOT authorize agent execution.
L4_ACTIONS = frozenset({"payment", "api_key", "bank_operation", "delete_data", "delete_memory"})

def _verb_noun(verbs: str, nouns: str, gap: int = 10) -> re.Pattern[str]:
    """Match verb+noun in EITHER order (Chinese word order is flexible: 清空数据库 / 数据库清空)."""
    return re.compile(rf"(?:{verbs}).{{0,{gap}}}(?:{nouns})|(?:{nouns}).{{0,{gap}}}(?:{verbs})", re.I)


# Catastrophic intents that are gated regardless of any LLM tag.
_CATASTROPHIC_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("delete_data", _verb_noun(r"删除|清空|删掉|抹掉|drop|truncate", r"数据库|数据表|台账|生产数据")),
    ("delete_memory", _verb_noun(r"删除|清空|删掉|抹掉", r"记忆|memory")),
    ("payment", re.compile(r"(付款|转账|打款|汇款|支付给|bank\s*transfer|wire\s*transfer)", re.I)),
    ("api_key", _verb_noun(r"轮换|更换|读取|导出|发送|泄露", r"api\s*key|密钥|私钥|secret")),
)

_LEVEL_ZH = {
    ApprovalLevel.LOW: "低",
    ApprovalLevel.MEDIUM: "中",
    ApprovalLevel.HIGH: "高",
    ApprovalLevel.CRITICAL: "严重",
}

APPROVAL_TAG_RE = re.compile(
    r"APPROVAL_REQUEST:\s*action=([^|]+)\|\s*risk=([^|]+)\|\s*why=(.+)",
    re.IGNORECASE,
)

_APPROVE_WORDS = {"approved", "approve", "同意", "批准", "ok", "可以", "通过"}
_REJECT_WORDS = {
    "reject",
    "rejected",
    "拒绝",
    "不批",
    "no",
    "驳回",
    "不用改",
    "不用管",
    "先不管",
    "这条先不管",
    "这条不用管",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def level_for(action: str) -> ApprovalLevel:
    return _ACTION_LEVEL.get((action or "").strip().lower().replace("-", "_"), ApprovalLevel.HIGH)


def detect_catastrophic_intent(text: str) -> tuple[str, ApprovalLevel] | None:
    """Hard net for unambiguous L4 intents — gated even without an LLM tag."""
    msg = (text or "").strip()
    if not msg:
        return None
    for action, pattern in _CATASTROPHIC_PATTERNS:
        if pattern.search(msg):
            return action, level_for(action)
    return None


def parse_approval_tag(text: str) -> tuple[str, str, str] | None:
    """Extract an APPROVAL_REQUEST tag emitted by the COO. Returns (action, risk, why)."""
    m = APPROVAL_TAG_RE.search(text or "")
    if not m:
        return None
    return m.group(1).strip(), m.group(2).strip(), m.group(3).strip()


def strip_approval_tag(text: str) -> str:
    return APPROVAL_TAG_RE.sub("", text or "").strip()


def open_approval(
    action: str,
    *,
    why: str = "",
    request_text: str = "",
    chat_id: str = "",
    agent: str = "apcoo",
) -> dict[str, Any]:
    """Record a pending approval and log it. Returns the record."""
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    level = level_for(action)
    approval_id = f"AP-{datetime.now(timezone.utc).strftime('%y%m%d')}-{uuid.uuid4().hex[:6]}"
    record = {
        "id": approval_id,
        "action": action,
        "level": level.value,
        "human_only": action in L4_ACTIONS,
        "why": why,
        "request_text": request_text[:600],
        "agent": agent,
        "chat_id": chat_id,
        "status": "pending",
        "created_at": _now(),
    }
    (PENDING_DIR / f"{approval_id}.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    log_approval_required(
        action=f"{agent}.{action}", risk_level=level.value, command=request_text[:200],
        approval_id=approval_id,
    )
    return record


def format_ceo_request(record: dict[str, Any]) -> str:
    """CEO-facing approval card (Chinese, conclusion-first)."""
    level = ApprovalLevel(record["level"])
    lines = [
        "🔐 授权请求（未执行）",
        "",
        f"结论：需要你批准才能进行「{record['action']}」。",
        f"风险等级：{_LEVEL_ZH.get(level, level.value)}（{record['level']}）",
    ]
    if record.get("why"):
        lines.append(f"原因：{record['why']}")
    if record.get("request_text"):
        lines.append(f"事项：{record['request_text'][:300]}")
    lines.append(f"编号：{record['id']}")
    lines.append("")
    if record.get("human_only"):
        lines.append("⚠️ 这是 L4 人类专属动作（密钥/付款/删库/删记忆）。")
        lines.append("即使你回复同意，我也不会代为执行——只会记录授权，由你亲自操作。")
    else:
        lines.append("回复「同意 / approved」执行；「拒绝 / reject」放弃；「revise: …」让我改方案。")
    return "\n".join(lines)


def _load_pending() -> list[dict[str, Any]]:
    if not PENDING_DIR.exists():
        return []
    items = []
    for p in PENDING_DIR.glob("*.json"):
        try:
            items.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    items.sort(key=lambda r: r.get("created_at", ""))
    return items


def _classify_reply(text: str) -> str | None:
    body = (text or "").strip().lower()
    token = body.split(":", 1)[0].split("：", 1)[0].strip()
    if body.startswith("revise:") or body.startswith("revise：") or token in {"revise", "修改"}:
        return "revise"
    if token in _APPROVE_WORDS:
        return "approved"
    if token in _REJECT_WORDS:
        return "rejected"
    return None


def resolve_reply(text: str) -> dict[str, Any] | None:
    """Resolve the oldest open approval against a CEO reply. Returns a result dict or None."""
    decision = _classify_reply(text)
    if decision is None:
        return None
    pending = _load_pending()
    if not pending:
        return None

    # Optional explicit id like "approved AP-260629-ab12cd"
    target = None
    id_match = re.search(r"AP-\d{6}-[0-9a-f]{6}", text or "", re.I)
    if id_match:
        wanted = id_match.group(0).upper()
        target = next((r for r in pending if r["id"].upper() == wanted), None)
    if target is None:
        target = pending[0]

    RESOLVED_DIR.mkdir(parents=True, exist_ok=True)
    target["status"] = decision
    target["resolved_at"] = _now()
    note = ""
    if decision == "revise":
        note = re.split(r"[:：]", text, maxsplit=1)[-1].strip() if (":" in text or "：" in text) else ""
        target["revise_note"] = note

    (RESOLVED_DIR / f"{target['id']}.json").write_text(
        json.dumps(target, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    try:
        (PENDING_DIR / f"{target['id']}.json").unlink()
    except FileNotFoundError:
        pass

    if decision == "approved":
        log_approval_granted(
            action=f"{target['agent']}.{target['action']}", risk_level=target["level"],
            command=target.get("request_text", "")[:200], approved_by="CEO", result="granted",
        )
    else:
        log_event("approval_resolved", action=target["action"], status=decision, approval_id=target["id"])

    return {"decision": decision, "record": target, "note": note}


def format_resolution(result: dict[str, Any]) -> str:
    rec = result["record"]
    if result["decision"] == "approved":
        if rec.get("human_only"):
            return (
                f"已记录你对「{rec['action']}」的授权（{rec['id']}）。\n"
                "这是 L4 人类专属动作,我不代为执行,请你亲自操作。已留审计记录。"
            )
        if rec.get("action") == "agent_prompt_fix":
            plan = result.get("cursor_plan_path") or "(生成失败,请看日志)"
            return (
                f"收到,已授权「{rec['action']}」（{rec['id']}）。\n"
                f"已生成 Cursor 任务文件 `{plan}`,Cursor 会自动接手,做完我会告诉你。"
            )
        return (
            f"收到,已授权「{rec['action']}」（{rec['id']}）。\n"
            "当前安全范围内我没有该破坏性工具,不会自动执行;授权与审计已记录,"
            "待对应工具开通后按此授权进行。"
        )
    if result["decision"] == "rejected":
        return f"明白,已放弃「{rec['action']}」（{rec['id']}）,不执行。"
    return f"好,我重做「{rec['action']}」的方案:{result.get('note') or '(待补充)'}（{rec['id']}）。"


def notify_ceo(text: str, *, chat_ids: set[str] | None = None) -> int:
    """Proactively push a message to the CEO Telegram chat(s). Returns count sent."""
    from tools import message_tool

    targets = chat_ids or parse_allowed_chat_ids(os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS"))
    sent = 0
    for cid in targets:
        try:
            message_tool.send_telegram_message(cid, text)
            sent += 1
        except Exception as exc:  # noqa: BLE001 — best-effort proactive push
            log_event("notify_ceo_failed", chat_id=cid, error=str(exc))
    return sent


def request_and_notify(
    action: str, *, why: str = "", request_text: str = "", chat_id: str = "", agent: str = "apcoo",
) -> dict[str, Any]:
    """Open an approval AND push the request card to the CEO. For agent-initiated gates."""
    record = open_approval(action, why=why, request_text=request_text, chat_id=chat_id, agent=agent)
    notify_ceo(format_ceo_request(record))
    return record
