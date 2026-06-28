"""Read-only WhatsApp sync — normalize messages, update sync_state.json."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway.gateway_readonly import (
    PARSED_DIR,
    RAW_DIR,
    SYNC_STATE_PATH,
    ensure_gateway_dirs,
)
from customer_gateway.whatsapp_connector import (
    ConnectorConfig,
    WhatsAppReadOnlyConnector,
    assert_send_blocked,
)


def sync_readonly(*, import_export_dir: Path | None = None) -> dict[str, Any]:
    """
    Sync historical chats read-only.
    Sources: WHATSAPP_READONLY_EXPORT_DIR, or parsed store fallback.
    Optionally auto-import .txt from export dir into gateway raw/parsed.
    """
    assert_send_blocked("sync_readonly")
    ensure_gateway_dirs()

    config = ConnectorConfig.from_env()
    if import_export_dir:
        config.export_dir = import_export_dir

    if config.export_dir and config.export_dir.is_dir():
        _import_export_dir_txt(config.export_dir)

    connector = WhatsAppReadOnlyConnector(config)
    messages = connector.fetch_messages()

    if not messages and not list(PARSED_DIR.glob("*.json")):
        return {
            "ok": False,
            "message": (
                "无可同步数据。请设置 WHATSAPP_READONLY_EXPORT_DIR 指向 WhatsApp 导出 .txt 目录，"
                "或先运行 /whatsapp import path/to/chat.txt"
            ),
            "messages_synced": 0,
        }

    if not messages:
        connector = WhatsAppReadOnlyConnector(ConnectorConfig())
        messages = connector.fetch_messages()

    payload = {
        "last_sync": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "mode": "read_only",
        "message_count": len(messages),
        "chat_count": len({m.chat_id for m in messages}),
        "contacts": sorted({m.contact_name for m in messages}),
        "messages": [asdict(m) for m in messages],
    }

    SYNC_STATE_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "ok": True,
        "message": "只读同步完成 — 未发送、未修改任何 WhatsApp 消息",
        "messages_synced": len(messages),
        "chats": payload["chat_count"],
        "contacts": payload["contacts"],
        "last_sync": payload["last_sync"],
    }


def load_sync_state() -> dict[str, Any]:
    ensure_gateway_dirs()
    if not SYNC_STATE_PATH.is_file():
        return {}
    return json.loads(SYNC_STATE_PATH.read_text(encoding="utf-8"))


def format_sync_result(result: dict[str, Any]) -> str:
    if not result.get("ok"):
        return f"WhatsApp 只读同步失败\n{result.get('message', '')}"

    lines = [
        "WhatsApp 只读同步完成",
        "=" * 36,
        f"模式: READ-ONLY（禁止发送/修改/删除）",
        f"同步时间: {result.get('last_sync')}",
        f"会话数: {result.get('chats', 0)}",
        f"消息数: {result.get('messages_synced', 0)}",
    ]
    contacts = result.get("contacts") or []
    if contacts:
        lines.append("联系人:")
        for c in contacts[:10]:
            lines.append(f"  - {c}")
        if len(contacts) > 10:
            lines.append(f"  … 另有 {len(contacts) - 10} 个")
    lines.append("")
    lines.append("下一步: /whatsapp analyze  或  /whatsapp report")
    return "\n".join(lines)


def _import_export_dir_txt(export_dir: Path) -> int:
    from customer_gateway.whatsapp_importer import import_whatsapp_txt

    count = 0
    for path in sorted(export_dir.glob("*.txt")):
        dest = RAW_DIR / path.name
        if dest.exists():
            continue
        import_whatsapp_txt(path)
        count += 1
    return count
