"""Real WhatsApp Web read-only adapter via Playwright persistent browser session."""

from __future__ import annotations

import hashlib
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway.whatsapp_business_session import mark_connected, session_dir
from customer_gateway.whatsapp_live_adapter import (
    NormalizedLiveMessage,
    message_fingerprint,
    normalize_incoming,
)
from customer_gateway.whatsapp_live_adapter import BrowserAdapterError
from customer_gateway.whatsapp_safety import SafetyError, assert_write_blocked

WHATSAPP_WEB_URL = "https://web.whatsapp.com"
BROWSER_CONNECTOR = "browser_readonly"
STORE_WAIT_MS = 120_000

_EXTRACT_FULL_HISTORY_JS = """
(batchIndex, batchSize, perChatLimit) => {
  const Store = window.Store;
  if (!Store || !Store.Chat) {
    return { error: "store_unavailable", messages: [], done: true };
  }

  const allChats = Store.Chat.getModels();
  const start = batchIndex * batchSize;
  const end = Math.min(start + batchSize, allChats.length);
  const out = [];

  for (let ci = start; ci < end; ci++) {
    const chat = allChats[ci];
    const contactName = chat.formattedTitle || chat.name || chat.contact?.formattedName || "unknown";
    const rawId = chat.id?._serialized || chat.id?.user || String(chat.id || contactName);
    const msgs = chat.msgs ? chat.msgs.getModels() : [];
    const slice = msgs.length > perChatLimit ? msgs.slice(-perChatLimit) : msgs;

    for (const msg of slice) {
      const body = (msg.body || msg.caption || "").trim();
      if (!body) continue;
      const isMe = msg.isSentByMe || msg.id?.fromMe;
      const ts = msg.t ? new Date(msg.t * 1000).toISOString().replace("T", " ").slice(0, 16) : "";
      out.push({
        contact_name: contactName,
        chat_id_raw: rawId,
        message: body,
        timestamp: ts,
        direction: isMe ? "outgoing" : "incoming",
        media_placeholder: (msg.isMedia || msg.mediaData) ? "[media]" : null,
      });
    }
  }

  return {
    error: null,
    messages: out,
    done: end >= allChats.length,
    total_chats: allChats.length,
    batch_end: end,
  };
}
"""

_EXTRACT_MESSAGES_JS = """
(maxChats, perChatLimit) => {
  const Store = window.Store;
  if (!Store || !Store.Chat) {
    return { error: "store_unavailable", messages: [] };
  }

  const chats = Store.Chat.getModels().slice(0, maxChats);
  const out = [];

  for (const chat of chats) {
    const contactName = chat.formattedTitle || chat.name || chat.contact?.formattedName || "unknown";
    const rawId = chat.id?._serialized || chat.id?.user || String(chat.id || contactName);
    const msgs = chat.msgs ? chat.msgs.getModels().slice(-perChatLimit) : [];

    for (const msg of msgs) {
      if (msg.isSentByMe || msg.id?.fromMe) continue;
      const body = (msg.body || msg.caption || "").trim();
      if (!body) continue;
      const ts = msg.t ? new Date(msg.t * 1000).toISOString().replace("T", " ").slice(0, 16) : "";
      out.push({
        contact_name: contactName,
        chat_id_raw: rawId,
        message: body,
        timestamp: ts,
        direction: "incoming",
        media_placeholder: (msg.isMedia || msg.mediaData) ? "[media]" : null,
      });
    }
  }
  return { error: null, messages: out };
}
"""

_SIDEBAR_PREVIEW_JS = """
(maxChats) => {
  const rows = document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="list-item"]');
  const out = [];
  for (let i = 0; i < Math.min(rows.length, maxChats); i++) {
    const row = rows[i];
    const titleEl = row.querySelector('span[title][dir="auto"]') || row.querySelector('[title]');
    const contact = titleEl ? (titleEl.getAttribute("title") || titleEl.innerText || "unknown") : "unknown";
    const spans = row.querySelectorAll('span[dir="ltr"], span[dir="auto"]');
    let preview = "";
    for (const span of spans) {
      const t = (span.innerText || "").trim();
      if (t && t !== contact && !t.match(/^\\d{1,2}:\\d{2}$/)) {
        preview = t.replace(/^You:\\s*/i, "");
        break;
      }
    }
    if (!preview || preview.toLowerCase().startsWith("you:")) continue;
    out.push({ contact_name: contact, chat_id_raw: contact, message: preview, timestamp: "", direction: "incoming" });
  }
  return { error: null, messages: out };
}
"""


def playwright_available() -> bool:
    try:
        import importlib.util
        return importlib.util.find_spec("playwright") is not None
    except ImportError:
        return False


def browser_profile_dir() -> Path:
    return session_dir() / "browser_profile"


def headless_mode() -> bool:
    return os.getenv("WHATSAPP_BROWSER_HEADLESS", "false").strip().lower() in ("1", "true", "yes")


def history_batch_size() -> int:
    try:
        return max(1, int(os.getenv("WHATSAPP_HISTORY_BATCH_SIZE", "50")))
    except ValueError:
        return 50


def history_per_chat_limit() -> int:
    try:
        return max(1, int(os.getenv("WHATSAPP_HISTORY_PER_CHAT", "500")))
    except ValueError:
        return 500


def poll_recent_limit() -> int:
    try:
        return max(1, int(os.getenv("WHATSAPP_POLL_RECENT_MESSAGES", "20")))
    except ValueError:
        return 20


def poll_max_chats() -> int:
    try:
        return max(1, int(os.getenv("WHATSAPP_POLL_MAX_CHATS", "15")))
    except ValueError:
        return 15


def connect_timeout_sec() -> int:
    try:
        return max(30, int(os.getenv("WHATSAPP_CONNECT_TIMEOUT_SEC", "120")))
    except ValueError:
        return 120


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _hash_chat_id(raw: str) -> str:
    return hashlib.sha256(f"wa-chat:{raw}".encode()).hexdigest()[:16]


class WhatsAppBrowserAdapter:
    """Playwright persistent Chromium session for WhatsApp Web (read-only)."""

    name = "browser"

    def __init__(self) -> None:
        self._logged_in = False
        self._playwright: Any = None
        self._context: Any = None
        self._page: Any = None

    def is_available(self) -> bool:
        return playwright_available()

    def session_dir(self) -> Path:
        return session_dir()

    def browser_profile_path(self) -> Path:
        path = browser_profile_dir()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def connect(self) -> dict[str, Any]:
        assert_write_blocked("connect_readonly")
        try:
            page = self._launch(headless=headless_mode())
            page.goto(WHATSAPP_WEB_URL, wait_until="domcontentloaded", timeout=60_000)
            logged_in = self._wait_for_login(page, timeout_sec=connect_timeout_sec())
            if logged_in:
                self._logged_in = True
                mark_connected(adapter=self.name, linked_device=True)
                return {
                    "ok": True,
                    "adapter": self.name,
                    "mode": "browser_readonly",
                    "logged_in": True,
                    "mock_session": False,
                    "session_dir": str(self.session_dir()),
                    "message": "WhatsApp Web 已登录，会话已保存。",
                }
            return {
                "ok": False,
                "adapter": self.name,
                "error": "login_timeout",
                "logged_in": False,
                "mock_session": False,
                "hint": "请在浏览器中扫描 QR 码：WhatsApp Business → 关联设备",
            }
        except BrowserAdapterError:
            raise
        except Exception as exc:
            raise BrowserAdapterError(f"Playwright Chromium 启动失败: {exc}") from exc
        finally:
            self.close()

    def fetch_new_messages(self) -> list[NormalizedLiveMessage]:
        assert_write_blocked("poll_readonly")
        try:
            page = self._launch(headless=headless_mode())
            page.goto(WHATSAPP_WEB_URL, wait_until="domcontentloaded", timeout=60_000)
            if not self._wait_for_login(page, timeout_sec=45):
                return []
            self._logged_in = True
            raw_messages = self._read_messages(page)
            return self._normalize_batch(raw_messages)
        except BrowserAdapterError:
            raise
        except Exception as exc:
            raise BrowserAdapterError(f"Playwright poll 失败: {exc}") from exc
        finally:
            self.close()

    def fetch_history_batches(self) -> list[list[dict[str, Any]]]:
        """Paginated full chat history for intelligence import (read-only, both directions)."""
        assert_write_blocked("history_import_readonly")
        batches: list[list[dict[str, Any]]] = []
        try:
            page = self._launch(headless=headless_mode())
            page.goto(WHATSAPP_WEB_URL, wait_until="domcontentloaded", timeout=60_000)
            if not self._wait_for_login(page, timeout_sec=connect_timeout_sec()):
                return batches
            self._logged_in = True

            batch_size = history_batch_size()
            per_chat = history_per_chat_limit()
            batch_index = 0
            while True:
                result = page.evaluate(
                    _EXTRACT_FULL_HISTORY_JS,
                    batch_index,
                    batch_size,
                    per_chat,
                )
                if not isinstance(result, dict):
                    break
                msgs = list(result.get("messages") or [])
                if msgs:
                    batches.append(msgs)
                if result.get("done") or result.get("error"):
                    break
                batch_index += 1
                if batch_index > 200:
                    break
        except BrowserAdapterError:
            raise
        except Exception as exc:
            raise BrowserAdapterError(f"History import 失败: {exc}") from exc
        finally:
            self.close()
        return batches

    def status(self) -> dict[str, Any]:
        profile_exists = self.browser_profile_path().is_dir() and any(
            self.browser_profile_path().iterdir()
        ) if self.browser_profile_path().exists() else False
        return {
            "adapter": self.name,
            "available": self.is_available(),
            "connected": self._logged_in,
            "logged_in": self._logged_in or profile_exists,
            "mock_session": False,
            "session_dir": str(self.session_dir()),
            "browser_profile": str(self.browser_profile_path()),
            "headless": headless_mode(),
            "readonly": True,
            "send_enabled": False,
            "mark_read_enabled": False,
            "backend": "playwright_chromium",
        }

    def close(self) -> None:
        try:
            if self._context:
                self._context.close()
        except Exception:
            pass
        try:
            if self._playwright:
                self._playwright.stop()
        except Exception:
            pass
        self._context = None
        self._playwright = None
        self._page = None

    def _launch(self, *, headless: bool):
        from playwright.sync_api import sync_playwright

        self.close()
        self._playwright = sync_playwright().start()
        self._context = self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.browser_profile_path()),
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
            viewport={"width": 1280, "height": 900},
            locale="en-US",
        )
        self._page = self._context.pages[0] if self._context.pages else self._context.new_page()
        return self._page

    def _wait_for_login(self, page, *, timeout_sec: int) -> bool:
        app_selectors = "#pane-side, [data-testid='chat-list'], [data-testid='chatlist-header']"
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            try:
                if page.locator(app_selectors).first.is_visible(timeout=2000):
                    self._wait_for_store(page)
                    return True
            except Exception:
                pass
            time.sleep(2)
        return False

    def _wait_for_store(self, page) -> None:
        try:
            page.wait_for_function(
                "window.Store && window.Store.Chat",
                timeout=STORE_WAIT_MS,
            )
        except Exception:
            pass

    def _read_messages(self, page) -> list[dict[str, Any]]:
        max_chats = poll_max_chats()
        per_chat = poll_recent_limit()
        try:
            result = page.evaluate(_EXTRACT_MESSAGES_JS, max_chats, per_chat)
            if isinstance(result, dict) and result.get("messages") and not result.get("error"):
                return list(result["messages"])
        except Exception:
            pass
        try:
            fallback = page.evaluate(_SIDEBAR_PREVIEW_JS, max_chats)
            if isinstance(fallback, dict):
                return list(fallback.get("messages") or [])
        except Exception:
            pass
        return []

    def _normalize_batch(self, raw_messages: list[dict[str, Any]]) -> list[NormalizedLiveMessage]:
        out: list[NormalizedLiveMessage] = []
        for rec in raw_messages:
            body = (rec.get("message") or "").strip()
            if not body:
                continue
            contact = rec.get("contact_name") or "unknown"
            ts = rec.get("timestamp") or _now()
            raw_chat = rec.get("chat_id_raw") or contact
            chat_id = _hash_chat_id(raw_chat)
            mid = message_fingerprint(contact, ts, body)
            msg = normalize_incoming(
                contact_name=contact,
                message=body,
                timestamp=ts,
                phone_hint=raw_chat,
                chat_id=chat_id,
                media_placeholder=rec.get("media_placeholder"),
                message_id=mid,
                connector=BROWSER_CONNECTOR,
            )
            out.append(msg)
        return out

    # --- blocked write operations ---
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
