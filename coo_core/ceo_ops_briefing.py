"""CEO ops briefing — structured CEO Daily Brief from read-only runtime data."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Callable

_MISSING = "数据不足/未读取到"

# Website/content mode — checked first; takes precedence over ops briefing.
_WEBSITE_CONTENT_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"网站内容",
        r"官网文案",
        r"优化官网",
        r"首页文案",
        r"网站文案",
        r"页面文案",
        r"\bseo\b",
        r"landing\s*page",
        r"asia[- ]?power\.com.{0,20}(网站|文案|页面|seo)",
        r"(网站|文案|页面|seo).{0,20}asia[- ]?power\.com",
    )
)

# Narrow ops briefing triggers — internal CEO status, not public marketing copy.
_CEO_OPS_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"当前状态",
        r"运营状态",
        r"项目进展",
        r"今天做了什么",
        r"今天进展",
        r"内部运营",
        r"公司进展",
        r"(?:总结|汇总|简报).{0,12}(?:asiapower|asia\s*power|公司|项目|运营|内部|今天)",
        r"(?:风险|阻塞|待办).{0,8}(?:项目|运营|系统|任务)?",
        r"今天帮我总结",
    )
)

_BRIEF_SECTIONS = (
    "今日结论",
    "已完成",
    "当前运行状态",
    "数据资产",
    "风险",
    "下一步",
)


def detect_website_content_query(message: str) -> bool:
    """True when CEO asks for public website/content/SEO work — not ops briefing."""
    text = (message or "").strip()
    if not text:
        return False
    return any(p.search(text) for p in _WEBSITE_CONTENT_PATTERNS)


def detect_ceo_ops_query(message: str) -> bool:
    """True when CEO asks for internal operational status summary."""
    text = (message or "").strip()
    if not text:
        return False
    if detect_website_content_query(text):
        return False
    return any(p.search(text) for p in _CEO_OPS_PATTERNS)


def user_explicitly_requests_memory(message: str) -> bool:
    """Only persist memory when CEO clearly asks to remember."""
    text = (message or "").lower()
    return any(k in text for k in ("记住", "记录下来", "记下来", "帮我记录", "remember", "save this"))


def website_content_prompt_addon() -> str:
    return (
        "\n\nCEO 请求的是对外网站/文案/SEO 类工作。"
        "请基于公开网站定位与页面结构给出内容建议，不要输出内部任务队列、草稿队列或系统健康日志。"
        "不要追加 MEMORY_TO_SAVE 或 DECISION_TO_SAVE，除非 CEO 明确要求记住。"
    )


def _safe_load(name: str, loader: Callable[[], Any]) -> dict[str, Any]:
    try:
        data = loader()
        return {"ok": True, "name": name, "data": data}
    except Exception as exc:
        return {"ok": False, "name": name, "error": str(exc)}


def _load_tasks() -> dict[str, Any]:
    from tools import task_tool

    return task_tool.summarize_tasks()


def _load_decisions() -> list[str]:
    from tools import memory_tool

    return memory_tool.summarize_recent_decisions(5)


def _load_drafts() -> list[dict[str, Any]]:
    from customer_gateway.draft_queue import list_drafts

    return list_drafts(status="pending", limit=10)


def _load_whatsapp() -> list[str]:
    from customer_gateway.whatsapp_live_readonly import listen_status

    return listen_status().splitlines()


def _load_health() -> dict[str, str]:
    from coo_core.health_check import run_health_checks

    return run_health_checks()


def _load_daily_log() -> list[str]:
    from tools import memory_tool

    raw = memory_tool.list_daily_log()
    if not raw.strip():
        return []
    return raw.strip().splitlines()


def collect_ceo_ops_snapshot() -> dict[str, Any]:
    """Collect structured runtime snapshot; never raises."""
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "tasks": _safe_load("tasks", _load_tasks),
        "decisions": _safe_load("decisions", _load_decisions),
        "drafts": _safe_load("drafts", _load_drafts),
        "whatsapp": _safe_load("whatsapp", _load_whatsapp),
        "health": _safe_load("health", _load_health),
        "daily_log": _safe_load("daily_log", _load_daily_log),
    }


def _tasks_data(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    block = snapshot.get("tasks") or {}
    if not block.get("ok"):
        return None
    data = block.get("data")
    return data if isinstance(data, dict) else None


def _health_data(snapshot: dict[str, Any]) -> dict[str, str] | None:
    block = snapshot.get("health") or {}
    if not block.get("ok"):
        return None
    data = block.get("data")
    return data if isinstance(data, dict) else None


def _drafts_data(snapshot: dict[str, Any]) -> list[dict[str, Any]] | None:
    block = snapshot.get("drafts") or {}
    if not block.get("ok"):
        return None
    data = block.get("data")
    return data if isinstance(data, list) else None


def _section_today_conclusion(snapshot: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    tasks = _tasks_data(snapshot)
    drafts = _drafts_data(snapshot)
    health = _health_data(snapshot)

    if tasks is None and drafts is None and health is None:
        return [_MISSING]

    blocked = len((tasks or {}).get("blocked") or [])
    urgent = len((tasks or {}).get("urgent_active") or [])
    pending_drafts = len(drafts or [])
    health_bad = [
        k for k, v in (health or {}).items()
        if v not in ("OK",) and not str(v).startswith("OK ")
    ]

    if blocked:
        lines.append(f"- 存在 {blocked} 项阻塞任务，需优先处理。")
    if urgent:
        lines.append(f"- 有 {urgent} 项高优/紧急任务在办。")
    if pending_drafts:
        lines.append(f"- 回复草稿队列有 {pending_drafts} 份待 CEO 审阅。")
    if health_bad:
        lines.append(f"- 子系统异常: {', '.join(health_bad)}。")
    if not lines:
        lines.append("- 核心运营流水线可读，当前未读取到阻塞项或待审草稿积压。")
    return lines


def _section_completed(snapshot: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    tasks = _tasks_data(snapshot)
    if tasks is None:
        lines.append(_MISSING)
    else:
        completed = tasks.get("completed") or []
        if completed:
            for t in completed[-5:]:
                lines.append(f"- [{t.get('id', '?')}] {t.get('title', '?')}")
        else:
            lines.append(_MISSING)

    log_block = snapshot.get("daily_log") or {}
    if log_block.get("ok"):
        log_lines = log_block.get("data") or []
        picked = [ln for ln in log_lines[:8] if ln.strip()]
        if picked:
            lines.append("- 今日日志摘录:")
            lines.extend(f"  · {ln}" for ln in picked)
    elif not lines or lines == [_MISSING]:
        lines.append(_MISSING)
    return lines


def _section_runtime_status(snapshot: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    health = _health_data(snapshot)
    if health is None:
        lines.append(f"- 子系统健康: {_MISSING}")
    else:
        for key, value in health.items():
            lines.append(f"- {key}: {value}")

    wa_block = snapshot.get("whatsapp") or {}
    if not wa_block.get("ok"):
        lines.append(f"- WhatsApp 只读监听: {_MISSING}")
    else:
        wa_lines = [ln for ln in (wa_block.get("data") or []) if ln.strip()][:6]
        if wa_lines:
            lines.append("- WhatsApp 只读监听:")
            lines.extend(f"  · {ln}" for ln in wa_lines)
        else:
            lines.append(f"- WhatsApp 只读监听: {_MISSING}")
    return lines


def _section_data_assets(snapshot: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    health = _health_data(snapshot)
    drafts = _drafts_data(snapshot)

    if drafts is None:
        lines.append(f"- 回复草稿队列: {_MISSING}")
    else:
        lines.append(f"- 待审回复草稿: {len(drafts)}")
        for d in drafts[:3]:
            lines.append(
                f"  · {d.get('draft_id', '?')} | {d.get('customer_name', '?')}"
            )

    asset_keys = (
        ("conversation_learning", "会话学习归档"),
        ("sales_intelligence", "销售智能引擎"),
        ("reply_queue", "回复队列"),
        ("memory", "Memory"),
    )
    if health is None:
        for _, label in asset_keys:
            lines.append(f"- {label}: {_MISSING}")
    else:
        for key, label in asset_keys:
            lines.append(f"- {label}: {health.get(key, _MISSING)}")

    decisions_block = snapshot.get("decisions") or {}
    if decisions_block.get("ok"):
        decisions = decisions_block.get("data") or []
        if decisions and decisions != ["(none)"]:
            lines.append("- 近期决策记录:")
            lines.extend(f"  · {d}" for d in decisions[:3])
    return lines or [_MISSING]


def _section_risks(snapshot: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    tasks = _tasks_data(snapshot)
    health = _health_data(snapshot)

    if tasks is not None:
        for t in (tasks.get("blocked") or [])[:5]:
            lines.append(f"- [阻塞] [{t.get('id')}] {t.get('title')}")
        for t in (tasks.get("urgent_active") or [])[:3]:
            if t.get("status") == "pending":
                lines.append(f"- [高优待办] [{t.get('id')}] {t.get('title')}")

    if health is not None:
        for key, value in health.items():
            if value not in ("OK",) and not str(value).startswith("OK "):
                lines.append(f"- [系统] {key}: {value}")

    if not lines:
        return ["- 当前未读取到明确风险项。"]
    return lines


def _section_next_steps(snapshot: dict[str, Any]) -> list[str]:
    tasks = _tasks_data(snapshot)
    drafts = _drafts_data(snapshot)

    if tasks is None and drafts is None:
        return [_MISSING]

    if tasks is not None:
        blocked = tasks.get("blocked") or []
        if blocked:
            t = blocked[0]
            return [f"- 优先解除阻塞: [{t.get('id')}] {t.get('title')}"]

        urgent = tasks.get("urgent_active") or []
        if urgent:
            t = urgent[0]
            return [f"- 推进高优任务: [{t.get('id')}] {t.get('title')} → {t.get('owner_agent')}"]

        pending = tasks.get("pending") or []
        if pending:
            t = pending[0]
            return [f"- 启动下一任务: [{t.get('id')}] {t.get('title')} → {t.get('owner_agent')}"]

    if drafts:
        d = drafts[0]
        return [f"- 审阅回复草稿: {d.get('draft_id')} | {d.get('customer_name', '?')}"]

    return ["- 当前无待办阻塞；可设定下一目标: /plan <goal>"]


def format_ceo_daily_brief(snapshot: dict[str, Any] | None = None) -> str:
    """Render fixed CEO Daily Brief sections from structured snapshot."""
    snap = snapshot or collect_ceo_ops_snapshot()
    builders = {
        "今日结论": _section_today_conclusion,
        "已完成": _section_completed,
        "当前运行状态": _section_runtime_status,
        "数据资产": _section_data_assets,
        "风险": _section_risks,
        "下一步": _section_next_steps,
    }

    parts = [
        "CEO Daily Brief",
        f"生成时间: {snap.get('generated_at', _MISSING)}",
        "",
    ]
    for title in _BRIEF_SECTIONS:
        lines = builders[title](snap)
        parts.append(f"## {title}")
        parts.extend(lines)
        parts.append("")
    return "\n".join(parts).strip()


def render_ceo_daily_brief() -> str:
    """Collect snapshot and return CEO Daily Brief (deterministic, no LLM)."""
    return format_ceo_daily_brief(collect_ceo_ops_snapshot())


def build_ceo_ops_briefing() -> str:
    """Legacy raw snapshot string — used by tests/debug."""
    snap = collect_ceo_ops_snapshot()
    sections: list[str] = ["内部运营快照（只读，供 CEO 简报使用）:", ""]
    for key in ("tasks", "decisions", "drafts", "whatsapp", "health", "daily_log"):
        block = snap.get(key) or {}
        title = {
            "tasks": "任务",
            "decisions": "近期决策",
            "drafts": "回复草稿队列",
            "whatsapp": "WhatsApp 只读监听",
            "health": "子系统健康",
            "daily_log": "今日日志摘录",
        }[key]
        sections.append(f"## {title}")
        if not block.get("ok"):
            sections.append(f"- 读取失败: {block.get('error', _MISSING)}")
        elif key == "tasks" and isinstance(block.get("data"), dict):
            data = block["data"]
            sections.append(
                f"- 任务总数: {data.get('total', 0)} | "
                f"待办: {data['by_status'].get('pending', 0)} | "
                f"阻塞: {data['by_status'].get('blocked', 0)}"
            )
        elif key == "drafts" and isinstance(block.get("data"), list):
            sections.append(f"- 待审草稿: {len(block['data'])}")
        elif key == "health" and isinstance(block.get("data"), dict):
            for k, v in block["data"].items():
                sections.append(f"- {k}: {v}")
        elif key == "daily_log" and isinstance(block.get("data"), list):
            if block["data"]:
                sections.extend(f"- {ln}" for ln in block["data"][:8])
            else:
                sections.append(_MISSING)
        elif isinstance(block.get("data"), list):
            if block["data"]:
                sections.extend(f"- {ln}" for ln in block["data"][:8])
            else:
                sections.append(_MISSING)
        else:
            sections.append(_MISSING)
        sections.append("")
    return "\n".join(sections).strip()
