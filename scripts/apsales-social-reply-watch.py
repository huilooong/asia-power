#!/usr/bin/env python3
"""Hourly social reply scan reminder for 子敬 — notify CEO when replies need follow-up drafts."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

REGISTRY_FILE = ROOT / "memory" / "customer_gateway" / "social_posts_registry.json"
REPLY_INBOX_FILE = ROOT / "memory" / "customer_gateway" / "social_reply_inbox.json"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "social_reply_watch_state.json"
SCAN_INTERVAL_HOURS = float(os.getenv("APSALES_SOCIAL_SCAN_HOURS", "1"))


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _load_json(path: Path, default: object) -> object:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _parse_ts(value: str) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M UTC", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            dt = datetime.strptime(value.replace("+00:00", " UTC"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _hours_since(value: str) -> float | None:
    dt = _parse_ts(value)
    if not dt:
        return None
    return (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0


def posts_due_for_scan(registry: list[dict]) -> list[dict]:
    due: list[dict] = []
    for post in registry:
        if post.get("status") not in ("live", "posted", "active"):
            continue
        last = post.get("last_scan_at") or post.get("posted_at") or ""
        hours = _hours_since(last)
        if hours is None or hours >= SCAN_INTERVAL_HOURS:
            due.append(post)
    return due


def pending_replies(inbox: list[dict]) -> list[dict]:
    return [row for row in inbox if row.get("status") == "pending_draft"]


def format_report(
    due_posts: list[dict],
    replies: list[dict],
    drafted: list[dict],
) -> str:
    lines = ["⏰ 子敬 · 社媒回复扫描（每小时）", f"时间: {_now()}", ""]

    if due_posts:
        lines.append(f"📌 待扫描帖文 {len(due_posts)} 条（距上次扫描 ≥{SCAN_INTERVAL_HOURS:g}h）：")
        for post in due_posts[:12]:
            platform = post.get("platform", "?")
            market = post.get("language_market", post.get("market", ""))
            scheme = post.get("scheme_id", "")
            url = post.get("post_url", "")
            lines.append(f"  · [{platform}] {scheme} {market} — {url or post.get('title', '')}")
        lines.append("")
        lines.append("子敬动作：打开帖文 → 看评论/DM → 有客户问价/感兴趣 → 记入 social_reply_inbox → 起草跟进（引导进站 + sales@asia-power.com）")
        lines.append("")

    if replies:
        lines.append(f"💬 待起草跟进 {len(replies)} 条（CEO 批准后才回复）：")
        for row in replies[:10]:
            lines.append(
                f"  · {row.get('platform', '?')} | {row.get('customer_handle', '?')} "
                f"| {row.get('snippet', '')[:80]}"
            )
        lines.append("")

    if drafted:
        lines.append(f"✅ 本轮已生成跟进草稿 {len(drafted)} 条 → 等 CEO 批准")
        for row in drafted[:8]:
            lines.append(f"  · {row.get('draft_id', '?')} | {row.get('customer_handle', '?')}")
        lines.append("")

    if not due_posts and not replies and not drafted:
        lines.append("暂无待扫描帖文或未处理回复。")
        lines.append("（在 social_posts_registry.json 登记已发布帖文后，每小时会提醒扫描。）")

    lines.append("")
    lines.append("KPI：进站 asia-power.com · 邮件 sales@asia-power.com · 社媒不硬销")
    lines.append("批准: /drafts approve · Telegram 回复「同意」")
    try:
        from customer_gateway.distribution_progress import progress_summary_line
        lines.append(progress_summary_line())
    except Exception:  # noqa: BLE001 — progress is best-effort
        pass
    return "\n".join(lines)


def _draft_follow_up(reply: dict) -> dict | None:
    """Create a pending draft in draft_queue for CEO approval."""
    from customer_gateway.draft_queue import save_draft

    platform = reply.get("platform", "social")
    handle = reply.get("customer_handle", "customer")
    lang = reply.get("language", "en")
    listing = reply.get("listing_url", "https://asia-power.com/half-cuts/")
    scheme = reply.get("scheme_id", "")

    if lang.startswith("fr"):
        body = (
            f"Bonjour — merci pour votre message sur {platform}.\n\n"
            f"Consultez le catalogue avec photos sur : {listing}\n"
            f"Pour un devis, écrivez à sales@asia-power.com — nous répondons avec options et photos.\n"
            f"WhatsApp +233 54 091 1111 si vous préférez.\n\n"
            f"AsiaPower Sales"
        )
    elif lang.startswith("pt"):
        body = (
            f"Olá — obrigado pela sua mensagem no {platform}.\n\n"
            f"Veja o catálogo com fotos em: {listing}\n"
            f"Para orçamento, envie email para sales@asia-power.com.\n"
            f"WhatsApp +233 54 091 1111.\n\n"
            f"AsiaPower Sales"
        )
    elif lang.startswith("ar"):
        body = (
            f"شكراً لرسالتك على {platform}.\n\n"
            f"تصفح القائمة: {listing}\n"
            f"للعرض: sales@asia-power.com\n"
            f"WhatsApp +233 54 091 1111.\n\n"
            f"AsiaPower Sales"
        )
    else:
        body = (
            f"Hi — thanks for your comment on {platform}.\n\n"
            f"Browse verified listings with photos here: {listing}\n"
            f"For a quote, email sales@asia-power.com — we'll reply with options and photos.\n"
            f"WhatsApp +233 54 091 1111 if easier.\n\n"
            f"We don't close deals in DMs — visit the site first.\n\n"
            f"AsiaPower Sales"
        )

    record = save_draft({
        "customer_name": f"{platform}:{handle}",
        "detected_language": lang,
        "original_message": reply.get("snippet", ""),
        "internal_analysis_zh": f"社媒回复跟进 · 方案 {scheme} · 引导进站+邮件",
        "customer_reply_draft": body,
        "risk_level": "low",
        "category": "social_reply",
        "next_action": "await_ceo_approval",
    })
    return record


def run_reply_watch() -> dict:
    registry = _load_json(REGISTRY_FILE, [])
    inbox = _load_json(REPLY_INBOX_FILE, [])
    if not isinstance(registry, list):
        registry = []
    if not isinstance(inbox, list):
        inbox = []

    due = posts_due_for_scan(registry)
    pending = pending_replies(inbox)
    drafted: list[dict] = []

    max_drafts = max(0, int(os.getenv("APSALES_SOCIAL_MAX_DRAFTS", "5")))
    for reply in pending[:max_drafts]:
        try:
            record = _draft_follow_up(reply)
            if record:
                drafted.append({
                    "draft_id": record.get("draft_id"),
                    "customer_handle": reply.get("customer_handle"),
                })
                reply["status"] = "draft_created"
                reply["draft_id"] = record.get("draft_id")
                reply["updated_at"] = _now()
        except Exception as exc:  # noqa: BLE001
            reply["draft_error"] = str(exc)

    if drafted:
        _save_json(REPLY_INBOX_FILE, inbox)

    state = _load_json(STATE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    state["last_run"] = _now()
    state["due_posts"] = len(due)
    state["pending_replies"] = len(pending)
    state["drafted"] = len(drafted)
    _save_json(STATE_FILE, state)

    report = format_report(due, pending, drafted)

    try:
        from customer_gateway.distribution_progress import record_event

        if due:
            record_event(
                "scan_done",
                notify=False,
                posts_scanned=len(due),
                pending_replies=len(pending),
            )
        for row in drafted:
            record_event(
                "followup_drafted",
                notify=False,
                draft_id=row.get("draft_id", ""),
                customer_handle=row.get("customer_handle", ""),
            )
    except Exception:  # noqa: BLE001 — progress tracking must not break watch
        pass

    return {
        "ran_at": _now(),
        "due_posts": due,
        "pending_replies": pending,
        "drafted": drafted,
        "report": report,
    }


def notify_if_needed(result: dict) -> int:
    due = result.get("due_posts") or []
    pending = result.get("pending_replies") or []
    drafted = result.get("drafted") or []
    always = os.getenv("APSALES_SOCIAL_ALWAYS_NOTIFY", "0").strip() == "1"

    digest_hour = os.getenv("APSALES_DISTRIBUTION_DIGEST_HOUR", "9").strip()
    try:
        utc_hour = datetime.now(timezone.utc).hour
        if str(utc_hour) == digest_hour:
            from customer_gateway.distribution_progress import send_daily_digest
            send_daily_digest()
    except Exception:  # noqa: BLE001
        pass

    if not always and not due and not pending and not drafted:
        return 0

    text = result.get("report", "")
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


def main() -> int:
    if os.getenv("APSALES_SOCIAL_REPLY_WATCH", "1").strip() == "0":
        print("APSALES_SOCIAL_REPLY_WATCH=0 — skipped")
        return 0

    result = run_reply_watch()
    print(result["report"])
    sent = notify_if_needed(result)
    print(f"\nTelegram notified: {sent} chat(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
