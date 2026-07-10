"""子敬 · 自动找客户 + 流量动作（扫描 → 草稿 → Telegram 汇报，不自动外发）."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
STATE_FILE = ROOT / "memory" / "customer_gateway" / "growth_autopilot_state.json"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def autopilot_enabled() -> bool:
    return os.getenv("APSALES_GROWTH_AUTOPILOT", "0").strip() == "1"


def always_notify() -> bool:
    return os.getenv("APSALES_GROWTH_ALWAYS_NOTIFY", "0").strip() == "1"


def _site_data_dir() -> Path:
    env = os.getenv("EMAIL_DATA_DIR", "").strip()
    if env:
        return Path(env)
    inv = os.getenv("INVENTORY_SITE_ROOT", "").strip()
    if inv:
        return Path(inv) / "data"
    sibling = ROOT.parent / "inventory-site" / "data"
    if sibling.is_dir():
        return sibling
    return ROOT / "data"


def _load_state() -> dict[str, Any]:
    if not STATE_FILE.is_file():
        return {}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_state(state: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def pending_outreach_candidate_ids() -> set[str]:
    from customer_gateway.outreach_engine import list_outreach_drafts

    ids: set[str] = set()
    for draft in list_outreach_drafts(status="pending", limit=200):
        cand = draft.get("candidate") or {}
        cid = cand.get("candidate_id")
        if cid:
            ids.add(str(cid))
    return ids


def _summarize_traffic() -> dict[str, Any]:
    analytics_file = _site_data_dir() / "site-analytics-daily.json"
    if not analytics_file.is_file():
        return {"available": False, "reason": "no analytics file"}

    try:
        store = json.loads(analytics_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return {"available": False, "reason": str(exc)}

    if not isinstance(store, dict) or not store:
        return {"available": True, "pageviews": 0, "unique_ips": 0, "whatsapp_clicks": 0}

    day = sorted(store.keys())[-1]
    bucket = store.get(day) or {}
    paths = bucket.get("paths") or {}
    countries = bucket.get("countries") or {}
    top_paths = sorted(paths.items(), key=lambda x: x[1], reverse=True)[:5]
    top_countries = sorted(countries.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "available": True,
        "day": day,
        "pageviews": int(bucket.get("pageviews") or 0),
        "unique_ips": len(bucket.get("ips") or {}),
        "whatsapp_clicks": int(bucket.get("whatsappClicks") or 0),
        "top_paths": top_paths,
        "top_countries": top_countries,
    }


def _count_open_leads() -> int:
    leads_file = _site_data_dir() / "contact-leads.json"
    if not leads_file.is_file():
        return 0
    try:
        data = json.loads(leads_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return 0
    leads = data if isinstance(data, list) else list(data.get("leads") or [])
    return sum(1 for lead in leads if lead.get("replyStatus") != "replied")


def _traffic_actions(traffic: dict[str, Any], open_leads: int) -> list[str]:
    actions: list[str] = []
    if not traffic.get("available"):
        actions.append("网站访问统计暂不可用 — 检查 inventory-site 数据分析是否正常写入。")
        return actions

    pv = int(traffic.get("pageviews") or 0)
    wa = int(traffic.get("whatsapp_clicks") or 0)
    top_countries = traffic.get("top_countries") or []

    if pv == 0:
        actions.append("今日暂无自然访问 — 建议检查 SEO 收录、Facebook 帖子外链是否指向 asia-power.com。")
    elif pv < 20:
        actions.append(f"访问量偏低（{pv} PV）— 可发库存亮点帖到 FB/WhatsApp 群，链到半切车目录。")

    if wa > 0:
        actions.append(f"WhatsApp 按钮被点 {wa} 次 — 优先跟进今日新询盘。")

    if open_leads:
        actions.append(f"网站还有 {open_leads} 条询价未回复 — 子敬已纳入主动开发扫描。")

    for country, hits in top_countries[:2]:
        if hits >= 3 and country and country not in ("Unknown", "?"):
            actions.append(f"{country} 访问 {hits} 次 — 优先匹配该区域客户画像与库存。")

    top_paths = traffic.get("top_paths") or []
    for path, hits in top_paths[:2]:
        if hits >= 5 and "/half-cuts" in str(path):
            actions.append("半切车目录浏览多 — 确保首页与 FB 分享链到最新库存。")
            break

    if not actions:
        actions.append("流量正常 — 维持每日主动跟进 + 邮件回复节奏。")
    return actions


def _draft_outreach_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    from customer_gateway.outreach_engine import build_outreach_enquiry, save_outreach_draft
    from sales_core.apsales_handler import _split_apsales_sections, process_apsales_enquiry

    analysis = process_apsales_enquiry(build_outreach_enquiry(candidate), channel="outreach_autopilot")
    internal, _, draft_text = _split_apsales_sections(analysis)
    record = save_outreach_draft(
        candidate,
        internal_analysis=internal,
        customer_draft=draft_text,
    )
    return record


def run_growth_autopilot() -> dict[str, Any]:
    """One autopilot cycle: pending emails → outreach drafts → traffic brief."""
    max_email = max(0, int(os.getenv("APSALES_GROWTH_MAX_EMAIL_DRAFTS", "5")))
    max_outreach = max(0, int(os.getenv("APSALES_GROWTH_MAX_OUTREACH_DRAFTS", "3")))

    result: dict[str, Any] = {
        "ran_at": _now(),
        "emails_drafted": [],
        "outreach_drafted": [],
        "traffic": {},
        "traffic_actions": [],
        "open_leads": 0,
        "errors": [],
    }

    if max_email:
        try:
            from customer_gateway.email_inbound import process_pending_emails

            for draft in process_pending_emails(limit=max_email):
                if draft.get("status") == "skipped_test":
                    continue
                result["emails_drafted"].append({
                    "draft_id": draft.get("draft_id", ""),
                    "customer": draft.get("customer_name", ""),
                })
        except Exception as exc:  # noqa: BLE001
            result["errors"].append(f"email: {exc}")

    if max_outreach:
        try:
            from customer_gateway.outreach_engine import scan_outreach_candidates

            pending_ids = pending_outreach_candidate_ids()
            drafted = 0
            for candidate in scan_outreach_candidates(limit=40):
                if drafted >= max_outreach:
                    break
                if candidate.get("priority") != "high":
                    continue
                cid = candidate.get("candidate_id")
                if not cid or cid in pending_ids:
                    continue
                record = _draft_outreach_candidate(candidate)
                pending_ids.add(str(cid))
                result["outreach_drafted"].append({
                    "outreach_id": record.get("outreach_id", ""),
                    "candidate_id": cid,
                    "name": candidate.get("name", ""),
                    "channel": candidate.get("channel", ""),
                })
                drafted += 1
        except Exception as exc:  # noqa: BLE001
            result["errors"].append(f"outreach: {exc}")

    result["open_leads"] = _count_open_leads()
    result["traffic"] = _summarize_traffic()
    result["traffic_actions"] = _traffic_actions(result["traffic"], result["open_leads"])

    state = _load_state()
    state["last_run"] = result["ran_at"]
    state["last_result"] = {
        "emails": len(result["emails_drafted"]),
        "outreach": len(result["outreach_drafted"]),
        "errors": len(result["errors"]),
    }
    _save_state(state)
    return result


def format_autopilot_report(result: dict[str, Any]) -> str:
    lines = ["🎯 子敬 · 获客/流量自动任务", f"时间: {result.get('ran_at', '')}", ""]

    emails = result.get("emails_drafted") or []
    outreach = result.get("outreach_drafted") or []
    if emails:
        lines.append(f"📧 邮件自动起草 {len(emails)} 封（待 CEO 批准发送）:")
        for row in emails[:8]:
            lines.append(f"  · {row.get('draft_id')} | {row.get('customer', '')}")
        lines.append("")

    if outreach:
        lines.append(f"🤝 主动开发草稿 {len(outreach)} 条（未发送）:")
        for row in outreach[:8]:
            lines.append(
                f"  · {row.get('outreach_id')} | {row.get('name')} | {row.get('channel', '')}"
            )
        lines.append("")

    traffic = result.get("traffic") or {}
    if traffic.get("available"):
        lines.append(
            f"🌐 流量 ({traffic.get('day', '?')}): "
            f"{traffic.get('pageviews', 0)} PV · "
            f"{traffic.get('unique_ips', 0)} IP · "
            f"WhatsApp {traffic.get('whatsapp_clicks', 0)} 次"
        )
        lines.append("")

    actions = result.get("traffic_actions") or []
    if actions:
        lines.append("📈 建议动作:")
        for action in actions[:6]:
            lines.append(f"  · {action}")
        lines.append("")

    open_leads = int(result.get("open_leads") or 0)
    if open_leads:
        lines.append(f"📥 未回复网站询价: {open_leads} 条")

    errors = result.get("errors") or []
    if errors:
        lines.append("")
        lines.append("⚠️ 异常:")
        for err in errors[:5]:
            lines.append(f"  · {err}")

    if not emails and not outreach and not errors:
        lines.append("本轮无新草稿（候选已处理或暂无高优先级客户）。")

    lines.append("")
    lines.append("批准: /drafts approve · /outreach queue · 邮件回信「同意」")
    return "\n".join(lines)


def notify_ceo_report(result: dict[str, Any]) -> int:
    text = format_autopilot_report(result)
    from coo_core.approval_gate import notify_ceo, parse_allowed_chat_ids
    from tools import message_tool

    chat_ids = parse_allowed_chat_ids(os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS"))
    if chat_ids and message_tool.coo_telegram_token():
        return notify_ceo(text)

    fallback_chat = (
        os.getenv("ASIAPOWER_TELEGRAM_CHAT_ID")
        or os.getenv("TELEGRAM_CHAT_ID")
        or ""
    ).strip()
    fallback_token = (
        os.getenv("ASIAPOWER_TELEGRAM_BOT_TOKEN")
        or os.getenv("TELEGRAM_BOT_TOKEN")
        or ""
    ).strip()
    if fallback_chat and fallback_token:
        message_tool.send_telegram_message(fallback_chat, text, token=fallback_token)
        return 1
    return 0


def should_notify(result: dict[str, Any]) -> bool:
    if always_notify():
        return True
    if result.get("errors"):
        return True
    if result.get("emails_drafted") or result.get("outreach_drafted"):
        return True
    return False
