"""WhatsApp read-only connector — direct connection interface, send disabled."""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

SEND_ENABLED = False
MODIFY_ENABLED = False
DELETE_ENABLED = False


@dataclass
class SyncMessage:
    chat_id: str
    contact_name: str
    phone_number_hash: str
    timestamp: str
    direction: str  # inbound | outbound
    message: str
    detected_language: str = "en"
    media_placeholder: str | None = None
    sync_time: str = ""


@dataclass
class ConnectorConfig:
    export_dir: Path | None = None
    api_url: str | None = None

    @classmethod
    def from_env(cls) -> ConnectorConfig:
        export = os.getenv("WHATSAPP_READONLY_EXPORT_DIR", "").strip()
        api = os.getenv("WHATSAPP_READONLY_API_URL", "").strip()
        return cls(
            export_dir=Path(export).expanduser() if export else None,
            api_url=api or None,
        )


def hash_phone(contact: str, hint: str = "") -> str:
    """Mask phone — store SHA-256 prefix only."""
    raw = f"{contact}|{hint}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def chat_id_for(contact: str, source: str = "") -> str:
    return hashlib.sha256(f"chat:{contact}:{source}".encode()).hexdigest()[:12]


def assert_send_blocked(operation: str) -> None:
    blocked = ("send", "reply", "delete", "modify", "auto_reply", "auto_send", "mark-read", "mark_read")
    if any(b in operation.lower() for b in blocked):
        raise PermissionError(f"WhatsApp send disabled (read-only phase): {operation}")


class ReadOnlyBackend(Protocol):
    def fetch_messages(self) -> list[SyncMessage]: ...


class ExportDirBackend:
    """Read-only: scan WHATSAPP_READONLY_EXPORT_DIR for .txt exports."""

    def __init__(self, export_dir: Path) -> None:
        self.export_dir = export_dir

    def fetch_messages(self) -> list[SyncMessage]:
        from datetime import datetime, timezone

        from core.language_router import detect_language
        from customer_gateway.conversation_parser import parse_whatsapp_txt

        sync_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        out: list[SyncMessage] = []

        if not self.export_dir.is_dir():
            return out

        for path in sorted(self.export_dir.glob("*.txt")):
            conv = parse_whatsapp_txt(path, original_name=path.name)
            contact = conv.get("contact", "unknown")
            cid = chat_id_for(contact, path.name)
            phash = hash_phone(contact, path.stem)

            for msg in conv.get("messages", []):
                direction = "outbound" if msg.get("is_ceo") else "inbound"
                out.append(SyncMessage(
                    chat_id=cid,
                    contact_name=contact,
                    phone_number_hash=phash,
                    timestamp=msg.get("timestamp", ""),
                    direction=direction,
                    message=msg.get("text", ""),
                    detected_language=msg.get("language") or detect_language(
                        msg.get("text", ""), scenario="buyer",
                    ),
                    media_placeholder=msg.get("attachment"),
                    sync_time=sync_time,
                ))
        return out


class ParsedStoreBackend:
    """Read-only: rebuild sync records from already-parsed JSON conversations."""

    def fetch_messages(self) -> list[SyncMessage]:
        from datetime import datetime, timezone

        from customer_gateway.conversation_parser import load_all_parsed

        sync_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        out: list[SyncMessage] = []

        for conv in load_all_parsed():
            contact = conv.get("contact", "unknown")
            cid = chat_id_for(contact, conv.get("raw_file", ""))
            phash = hash_phone(contact, conv.get("source_file", ""))

            for msg in conv.get("messages", []):
                direction = "outbound" if msg.get("is_ceo") else "inbound"
                out.append(SyncMessage(
                    chat_id=cid,
                    contact_name=contact,
                    phone_number_hash=phash,
                    timestamp=msg.get("timestamp", ""),
                    direction=direction,
                    message=msg.get("text", ""),
                    detected_language=msg.get("language", "en"),
                    media_placeholder=msg.get("attachment"),
                    sync_time=sync_time,
                ))
        return out


class WhatsAppReadOnlyConnector:
    """Phase-1 connector: read-only sync only. All write ops blocked."""

    def __init__(self, config: ConnectorConfig | None = None) -> None:
        self.config = config or ConnectorConfig.from_env()

    def _backend(self) -> ReadOnlyBackend:
        if self.config.export_dir and self.config.export_dir.is_dir():
            return ExportDirBackend(self.config.export_dir)
        return ParsedStoreBackend()

    def fetch_messages(self) -> list[SyncMessage]:
        return self._backend().fetch_messages()

    def send_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_send_blocked("send_message")

    def delete_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_send_blocked("delete_message")

    def modify_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_send_blocked("modify_message")

    def auto_reply(self, *_args: Any, **_kwargs: Any) -> None:
        assert_send_blocked("auto_reply")

    def connection_status(self) -> dict[str, Any]:
        return {
            "mode": "read_only",
            "send_enabled": SEND_ENABLED,
            "export_dir": str(self.config.export_dir) if self.config.export_dir else None,
            "api_url_configured": bool(self.config.api_url),
            "backend": (
                "export_dir" if self.config.export_dir and self.config.export_dir.is_dir()
                else "parsed_store"
            ),
        }
