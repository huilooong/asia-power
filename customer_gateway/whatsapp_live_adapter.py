"""WhatsApp Business App live read-only adapter interface + mock/browser backends."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from core.language_router import detect_language
from customer_gateway.whatsapp_connector import chat_id_for, hash_phone
from customer_gateway.whatsapp_safety import assert_write_blocked

CONNECTOR_NAME = "business_web_readonly"
BROWSER_CONNECTOR_NAME = "browser_readonly"
SOURCE_NAME = "whatsapp_business_app"


class BrowserAdapterError(RuntimeError):
    """Browser adapter requested but Playwright initialization failed."""


@dataclass
class AdapterResolution:
    requested_adapter: str
    active_adapter: str
    adapter: "LiveReadOnlyAdapter"
    fallback_reason: str | None = None


@dataclass
class NormalizedLiveMessage:
    source: str
    connector: str
    chat_id: str
    contact_name: str
    phone_number_hash: str
    message: str
    timestamp: str
    direction: str
    media_placeholder: str | None
    detected_language: str
    sync_time: str
    message_id: str = ""

    def to_inbox_json(self) -> dict[str, Any]:
        data = asdict(self)
        if not data.get("message_id"):
            data["message_id"] = message_fingerprint(
                data["contact_name"], data["timestamp"], data["message"],
            )
        return data


def message_fingerprint(contact: str, timestamp: str, body: str) -> str:
    raw = f"{contact}|{timestamp}|{body}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def normalize_incoming(
    *,
    contact_name: str,
    message: str,
    timestamp: str | None = None,
    phone_hint: str = "",
    chat_id: str = "",
    media_placeholder: str | None = None,
    message_id: str = "",
    connector: str = CONNECTOR_NAME,
) -> NormalizedLiveMessage:
    ts = timestamp or _now()
    cid = chat_id or chat_id_for(contact_name, phone_hint or contact_name)
    phash = hash_phone(contact_name, phone_hint or contact_name)
    mid = message_id or message_fingerprint(contact_name, ts, message)
    lang = detect_language(message, scenario="buyer")
    return NormalizedLiveMessage(
        source=SOURCE_NAME,
        connector=connector,
        chat_id=cid,
        contact_name=contact_name,
        phone_number_hash=phash,
        message=message,
        timestamp=ts,
        direction="incoming",
        media_placeholder=media_placeholder,
        detected_language=lang,
        sync_time=_now(),
        message_id=mid,
    )


class LiveReadOnlyAdapter(Protocol):
    name: str

    def is_available(self) -> bool: ...
    def connect(self) -> dict[str, Any]: ...
    def fetch_new_messages(self) -> list[NormalizedLiveMessage]: ...
    def status(self) -> dict[str, Any]: ...


class _WriteBlockedMixin:
    """Block all WhatsApp write operations with audit."""

    def send_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("send_message")

    def reply_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("reply_message")

    def type_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("type_message")

    def click_send(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("click_send")

    def delete_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("delete_message")

    def mark_read(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("mark_read")

    def archive_chat(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("archive_chat")

    def modify_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("modify_message")

    def star_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("star_message")

    def unstar_message(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("unstar_message")

    def edit_contact(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("edit_contact")

    def call_contact(self, *_args: Any, **_kwargs: Any) -> None:
        assert_write_blocked("call_contact")


class MockLiveAdapter(_WriteBlockedMixin):
    """Sample/fixture messages — not a real WhatsApp session."""

    name = "mock"

    def __init__(self, *, sample_path: Path | None = None) -> None:
        self.sample_path = sample_path
        self._connected = False
        self._poll_count = 0

    def is_available(self) -> bool:
        return True

    def connect(self) -> dict[str, Any]:
        self._connected = True
        return {
            "ok": True,
            "adapter": self.name,
            "mode": "mock_readonly",
            "logged_in": False,
            "mock_session": True,
        }

    def fetch_new_messages(self) -> list[NormalizedLiveMessage]:
        if not self._connected:
            self.connect()

        env_sample = os.getenv("WHATSAPP_MOCK_SAMPLE_FILE", "").strip()
        if env_sample:
            path = Path(env_sample).expanduser()
            if path.is_file():
                return self._from_json_file(path)

        if self.sample_path and self.sample_path.is_file():
            return self._from_json_file(self.sample_path)

        self._poll_count += 1
        suffix = self._poll_count
        return [
            normalize_incoming(
                contact_name="Ghana Motors Trading",
                message=f"Do you have G4KJ engine available? (mock poll #{suffix})",
                timestamp="2024-06-28 10:00",
                phone_hint="8616638801930",
            ),
        ]

    def _from_json_file(self, path: Path) -> list[NormalizedLiveMessage]:
        raw = json.loads(path.read_text(encoding="utf-8"))
        records = raw if isinstance(raw, list) else [raw]
        out: list[NormalizedLiveMessage] = []
        for rec in records:
            body = (rec.get("message") or rec.get("text") or "").strip()
            if not body:
                continue
            direction = (rec.get("direction") or "incoming").lower()
            if direction != "incoming":
                continue
            out.append(normalize_incoming(
                contact_name=rec.get("contact_name") or rec.get("contact") or "unknown",
                message=body,
                timestamp=rec.get("timestamp"),
                phone_hint=rec.get("phone_hint") or rec.get("phone") or "",
                chat_id=rec.get("chat_id") or "",
                media_placeholder=rec.get("media_placeholder"),
                message_id=rec.get("message_id") or "",
                connector=rec.get("connector") or CONNECTOR_NAME,
            ))
        return out

    def status(self) -> dict[str, Any]:
        return {
            "adapter": self.name,
            "available": True,
            "connected": self._connected,
            "logged_in": False,
            "mock_session": True,
            "readonly": True,
            "send_enabled": False,
            "mark_read_enabled": False,
            "backend": "mock_sample",
        }


class BrowserLiveAdapter(_WriteBlockedMixin):
    """Delegates to Playwright WhatsApp Web adapter."""

    name = "browser"

    def __init__(self) -> None:
        from customer_gateway.whatsapp_browser_adapter import WhatsAppBrowserAdapter
        self._inner = WhatsAppBrowserAdapter()

    def is_available(self) -> bool:
        return self._inner.is_available()

    def connect(self) -> dict[str, Any]:
        return self._inner.connect()

    def fetch_new_messages(self) -> list[NormalizedLiveMessage]:
        return self._inner.fetch_new_messages()

    def status(self) -> dict[str, Any]:
        return self._inner.status()


def _live_adapter_preference() -> str:
    return os.getenv("WHATSAPP_LIVE_ADAPTER", "").strip().lower()


def requested_adapter_mode(mode: str = "auto") -> str:
    pref = _live_adapter_preference()
    mode = (mode or "auto").strip().lower()
    if mode == "mock":
        return "mock"
    if mode == "browser":
        return "browser"
    if pref in ("mock", "browser"):
        return pref
    return "mock"


def _require_browser_adapter() -> BrowserLiveAdapter:
    from customer_gateway.whatsapp_browser_adapter import playwright_available

    if not playwright_available():
        raise BrowserAdapterError(
            "Playwright 未安装。请执行:\n"
            "  pip install playwright\n"
            "  python -m playwright install chromium"
        )
    try:
        adapter = BrowserLiveAdapter()
    except Exception as exc:
        raise BrowserAdapterError(f"Browser adapter 初始化失败: {exc}") from exc
    if not adapter.is_available():
        raise BrowserAdapterError(
            "Playwright 不可用。请执行:\n"
            "  pip install playwright\n"
            "  python -m playwright install chromium"
        )
    return adapter


def resolve_adapter_resolution(mode: str = "auto") -> AdapterResolution:
    requested = requested_adapter_mode(mode)

    if requested == "mock":
        return AdapterResolution(
            requested_adapter="mock",
            active_adapter="mock",
            adapter=MockLiveAdapter(),
            fallback_reason=None,
        )

    adapter = _require_browser_adapter()
    return AdapterResolution(
        requested_adapter="browser",
        active_adapter="browser",
        adapter=adapter,
        fallback_reason=None,
    )


def resolve_adapter(mode: str = "auto") -> LiveReadOnlyAdapter:
    return resolve_adapter_resolution(mode).adapter


def get_adapter_name(adapter: LiveReadOnlyAdapter) -> str:
    return getattr(adapter, "name", adapter.__class__.__name__)
