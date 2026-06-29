#!/usr/bin/env python3
"""Telegram APSales Bot — internal work console (private + whitelist only)."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from coo_core.dispatcher import dispatch_message
from integrations.telegram_access import authorize_chat, parse_allowed_chat_ids
from tools import message_tool

POLL_TIMEOUT = 30

WHATSAPP_INTEL_COMMANDS_ZH = (
    "APSales WhatsApp 业务入口（只读 → 草稿 → Telegram 审批）\n"
    "━━━━━━━━━━━━━━━━━━━━\n"
    "/whatsapp business connect — Business App 关联设备\n"
    "/whatsapp business status — 连接器状态\n"
    "/whatsapp business poll — 轮询新消息 → 收件箱\n"
    "/whatsapp listen --readonly — 消费收件箱 → 生成草稿\n"
    "/whatsapp listen status — 监听状态\n"
    "/whatsapp sync --readonly — 只读同步历史\n"
    "/whatsapp analyze — 销售智能报告\n"
    "/whatsapp report — 查看最新报告\n"
    "/drafts list — 草稿队列\n"
    "/drafts show <draft_id> — 查看草稿\n"
    "/drafts approve <draft_id> — 批准（不发送）\n"
    "/drafts reject <draft_id> — 拒绝\n"
    "/drafts revise <draft_id> <意见> — 修改意见\n"
    "/customer followups — 跟进清单\n"
    "/customer search <关键词> — 搜索历史\n"
    "\n"
    "安全：禁止发送/修改 WhatsApp，禁止承诺价格/库存/交期。\n"
    "approve = 同意草稿，本阶段不发送 WhatsApp。"
)


def _is_whatsapp_intel_command(text: str) -> bool:
    t = (text or "").strip().lower()
    if t.startswith("/whatsapp"):
        return True
    if t.startswith("/drafts"):
        return True
    if t.startswith("/customer followups") or t.startswith("/customer search"):
        return True
    return False


def _token() -> str:
    return message_tool.apsales_telegram_token()


def _allowed_chat_ids() -> set[str]:
    return parse_allowed_chat_ids(os.getenv("APSALES_TELEGRAM_ALLOWED_CHAT_IDS"))


def _api(method: str, params: dict | None = None) -> dict:
    token = _token()
    query = urllib.parse.urlencode(params or {})
    url = f"https://api.telegram.org/bot{token}/{method}"
    if query:
        url = f"{url}?{query}"
    with urllib.request.urlopen(url, timeout=POLL_TIMEOUT + 10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _handle_update(update: dict, allowed: set[str]) -> None:
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    text = (message.get("text") or "").strip()
    if not text:
        return

    ok, reason = authorize_chat(chat, allowed)
    if not ok:
        message_tool.log_message(
            "telegram_apsales", "inbound", chat_id, text, status=f"rejected:{reason}",
        )
        return

    message_tool.log_message("telegram_apsales", "inbound", chat_id, text, status="ok")

    user = message.get("from") or {}
    user_id = str(user.get("id", chat_id))

    try:
        if text.strip() in ("/start", "/whatsapp", "/whatsapp help"):
            reply = WHATSAPP_INTEL_COMMANDS_ZH + "\n\n" + dispatch_message(
                "/help", source="telegram_apsales", user_id=user_id, agent_id="apsales",
            )
        else:
            reply = dispatch_message(
                text,
                source="telegram_apsales",
                user_id=user_id,
                agent_id="apsales",
            )
        message_tool.send_apsales_telegram_message(chat_id, reply)
        message_tool.log_message("telegram_apsales", "outbound", chat_id, reply, status="ok")
    except Exception as exc:
        err = f"APSales error: {exc}"
        message_tool.log_message("telegram_apsales", "outbound", chat_id, err, status="error")
        try:
            message_tool.send_apsales_telegram_message(chat_id, "处理出错，请查看服务器日志。")
        except Exception:
            pass


def run_bot(once: bool = False) -> int:
    load_dotenv(ROOT / ".env")

    if not _token():
        print("Error: APSALES_TELEGRAM_BOT_TOKEN is required", file=sys.stderr)
        return 1

    allowed = _allowed_chat_ids()
    if not allowed:
        print("Error: APSALES_TELEGRAM_ALLOWED_CHAT_IDS is required", file=sys.stderr)
        return 1

    offset = 0
    print("AsiaPower APSales Telegram (internal console). Ctrl+C to stop.")
    print(WHATSAPP_INTEL_COMMANDS_ZH)

    try:
        while True:
            result = _api("getUpdates", {"timeout": POLL_TIMEOUT, "offset": offset})
            if not result.get("ok"):
                print(f"getUpdates failed: {result}", file=sys.stderr)
                time.sleep(3)
                continue

            for update in result.get("result", []):
                offset = max(offset, int(update.get("update_id", 0)) + 1)
                try:
                    _handle_update(update, allowed)
                except Exception as exc:
                    print(f"handle update error: {exc}", file=sys.stderr)

            if once:
                break
    except KeyboardInterrupt:
        print("\nStopped.")

    return 0


def main() -> int:
    once = "--once" in sys.argv
    return run_bot(once=once)


if __name__ == "__main__":
    raise SystemExit(main())
