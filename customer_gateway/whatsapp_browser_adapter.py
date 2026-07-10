"""Real WhatsApp Web read-only adapter via Playwright persistent browser session."""

from __future__ import annotations

import hashlib
import os
import re
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
from customer_gateway.whatsapp_safety import (
    SafetyError,
    assert_low_risk_auto_send_allowed,
    assert_write_blocked,
)

WHATSAPP_WEB_URL = "https://web.whatsapp.com"
BROWSER_CONNECTOR = "browser_readonly"
STORE_WAIT_MS = 120_000

_INJECT_STORE_JS = """
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + 120000;

  const tryAssign = () => {
    const pickStore = (exp) => {
      if (!exp) return null;
      const Chat = exp.Chat || exp.default?.Chat;
      if (!Chat) return null;
      const hasModels =
        typeof Chat.getModels === "function"
        || Array.isArray(Chat.models)
        || Chat._models;
      if (!hasModels) return null;
      return exp.Chat ? exp : exp.default;
    };
    if (window.Store?.Chat) {
      const ok =
        typeof window.Store.Chat.getModels === "function"
        || Array.isArray(window.Store.Chat.models)
        || window.Store.Chat._models;
      if (ok) return true;
    }
    try {
      if (typeof window.require === "function") {
        const dbg = window.require("__debug");
        const map = dbg?.modulesMap || {};
        for (const id of Object.keys(map)) {
          const picked = pickStore(map[id]?.exports);
          if (picked) {
            window.Store = picked;
            return true;
          }
        }
      }
    } catch (e) { /* ignore */ }
    try {
      if (window.webpackChunkwhatsapp_web_client) {
        window.webpackChunkwhatsapp_web_client.push([
          ["parasite"], {}, function (require) {
            const mods = require.c || {};
            for (const id of Object.keys(mods)) {
              const picked = pickStore(mods[id]?.exports);
              if (picked) window.Store = picked;
            }
          },
        ]);
      }
    } catch (e) { /* ignore */ }
    return !!(
      window.Store?.Chat
      && (
        typeof window.Store.Chat.getModels === "function"
        || Array.isArray(window.Store.Chat.models)
        || window.Store.Chat._models
      )
    );
  };

  while (Date.now() < deadline) {
    if (tryAssign()) {
      const chats =
        typeof window.Store.Chat.getModels === "function"
          ? window.Store.Chat.getModels()
          : Array.isArray(window.Store.Chat.models)
            ? window.Store.Chat.models
            : Object.values(window.Store.Chat._models || {});
      if (chats.length > 0) {
        return {
          ok: true,
          chats: chats.length,
          injected: true,
          has_conversation_msgs: !!(window.Store.ConversationMsgs?.loadEarlierMsgs),
        };
      }
    }
    await sleep(500);
  }
  return { ok: false, error: "store_unavailable" };
}
"""

_DOM_LIST_CHATS_JS = """
() => {
  const rows = Array.from(
    document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="list-item"]')
  );
  return {
    total: rows.length,
    contacts: rows.slice(0, 500).map((row) => {
      const titleEl = row.querySelector('span[title][dir="auto"]') || row.querySelector("[title]");
      return (titleEl?.getAttribute("title") || titleEl?.innerText || "unknown").trim();
    }),
  };
}
"""

_DOM_OPEN_CHAT_JS = """
async (chatIndex) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rows = Array.from(
    document.querySelectorAll('[data-testid="cell-frame-container"], [data-testid="list-item"]')
  );
  const row = rows[chatIndex];
  if (!row) return { error: "chat_not_found", chat_index: chatIndex };
  row.scrollIntoView({ block: "center" });
  row.click();
  await sleep(500);
  const title =
    document.querySelector("#main header span[title]")?.getAttribute("title")
    || document.querySelector("#main header [title]")?.getAttribute("title")
    || "unknown";
  return { error: null, contact_name: title, chat_index: chatIndex };
}
"""

_DOM_SCRAPE_CHAT_JS = """
async ([perChatLimit, scrollRounds]) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const panel =
    document.querySelector('[data-testid="conversation-panel-messages"]')
    || document.querySelector("#main [role='application']")
    || document.querySelector("#main [tabindex='-1']");
  const contact =
    document.querySelector('[data-testid="conversation-info-header-chat-title"]')?.innerText?.trim()
    || document.querySelector("#main header span[title]")?.getAttribute("title")
    || document.querySelector("#main header [title]")?.getAttribute("title")
    || "unknown";

  if (!panel) {
    return { error: "panel_not_found", messages: [], stats: { contact_name: contact } };
  }

  let prevCount = 0;
  for (let s = 0; s < scrollRounds; s++) {
    panel.scrollTop = 0;
    await sleep(350);
    const nodes = panel.querySelectorAll(
      '[data-testid="msg-container"], [data-testid="conversation-panel-body"] [role="row"]'
    );
    if (nodes.length >= perChatLimit) break;
    if (s > 2 && nodes.length === prevCount) break;
    prevCount = nodes.length;
  }

  const nodes = panel.querySelectorAll('[data-testid="msg-container"]');
  const out = [];
  const seen = new Set();

  for (const node of nodes) {
    const textEl =
      node.querySelector('[data-testid="msg-text"] span')
      || node.querySelector(".copyable-text span")
      || node.querySelector("span.selectable-text");
    const body = (textEl?.innerText || "").trim();
    if (!body || seen.has(body)) continue;
    seen.add(body);
    const isOut =
      node.closest(".message-out") != null
      || node.getAttribute("data-id")?.startsWith("true")
      || node.querySelector('[data-icon="msg-dblcheck"]') != null;
    const timeEl = node.querySelector("span[data-testid], span[dir='auto']");
    const ts = (timeEl?.innerText || "").trim();
    out.push({
      contact_name: contact,
      chat_id_raw: contact,
      message: body,
      timestamp: ts,
      direction: isOut ? "outgoing" : "incoming",
    });
    if (out.length >= perChatLimit) break;
  }

  return {
    error: null,
    messages: out,
    stats: {
      contact_name: contact,
      msgs_extracted: out.length,
      msgs_in_store: out.length,
      mode: "dom_scrape",
      scroll_rounds: scrollRounds,
      per_chat_limit: perChatLimit,
    },
  };
}
"""

_GET_STORE_CHATS_JS = """
() => {
  const Store = window.Store;
  if (!Store?.Chat) return { error: "store_unavailable", chats: [] };
  const chats =
    typeof Store.Chat.getModels === "function"
      ? Store.Chat.getModels()
      : Array.isArray(Store.Chat.models)
        ? Store.Chat.models
        : Object.values(Store.Chat._models || {});
  return {
    error: null,
    chats: chats.map((c, index) => ({
      index,
      name: (c.formattedTitle || c.name || c.contact?.formattedName || "unknown").trim(),
      id: c.id?._serialized || c.id?.user || String(c.id || index),
      phone: String(c.id?.user || c.id?._serialized || "").replace(/@.*/, ""),
      is_group: !!(c.isGroup || c.groupMetadata),
    })),
  };
}
"""

_OPEN_CHAT_STORE_JS = """
async (chatIndex) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const Store = window.Store;
  if (!Store?.Chat) return { error: "store_unavailable" };
  const chats =
    typeof Store.Chat.getModels === "function"
      ? Store.Chat.getModels()
      : Array.isArray(Store.Chat.models)
        ? Store.Chat.models
        : Object.values(Store.Chat._models || {});
  const chat = chats[chatIndex];
  if (!chat) return { error: "chat_not_found", chat_index: chatIndex };
  const name = (chat.formattedTitle || chat.name || "unknown").trim();
  const rawId = chat.id?._serialized || chat.id?.user || String(chat.id || name);
  try {
    if (Store.Cmd?.openChatAt) await Store.Cmd.openChatAt(chat);
    else if (Store.Cmd?.openChatBottom) await Store.Cmd.openChatBottom(chat);
  } catch (e) { /* read-only */ }
  await sleep(900);
  const panelMsgs = document.querySelectorAll('[data-testid="msg-container"]').length;
  return { error: null, name, raw_id: rawId, panel_msgs: panelMsgs, chat_index: chatIndex };
}
"""

_GET_CHAT_COUNT_JS = """
() => {
  const Store = window.Store;
  if (!Store || !Store.Chat) {
    return { error: "store_unavailable", total_chats: 0 };
  }
  const chats =
    typeof Store.Chat.getModels === "function"
      ? Store.Chat.getModels()
      : Array.isArray(Store.Chat.models)
        ? Store.Chat.models
        : Store.Chat._models
          ? Object.values(Store.Chat._models)
          : [];
  return {
    error: null,
    total_chats: chats.length,
    has_conversation_msgs: !!(Store.ConversationMsgs && Store.ConversationMsgs.loadEarlierMsgs),
    has_cmd_open: !!(Store.Cmd && (Store.Cmd.openChatAt || Store.Cmd.openChatBottom)),
    chat_api: typeof Store.Chat.getModels === "function" ? "getModels" : "models",
  };
}
"""

_IMPORT_SINGLE_CHAT_JS = """
async ([chatIndex, perChatLimit, maxLoadRounds, scrollRounds]) => {
  const Store = window.Store;
  if (!Store || !Store.Chat) {
    return { error: "store_unavailable", messages: [], stats: {} };
  }

  const chats =
    typeof Store.Chat.getModels === "function"
      ? Store.Chat.getModels()
      : Array.isArray(Store.Chat.models)
        ? Store.Chat.models
        : Object.values(Store.Chat._models || {});
  const chat = chats[chatIndex];
  if (!chat) {
    return { error: "chat_not_found", messages: [], stats: { chat_index: chatIndex } };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const msgModels = (collection) => {
    if (!collection) return [];
    if (typeof collection.getModels === "function") return collection.getModels();
    if (Array.isArray(collection.models)) return collection.models;
    if (collection._models) return Object.values(collection._models);
    if (Array.isArray(collection)) return collection;
    return [];
  };
  const contactName = chat.formattedTitle || chat.name || chat.contact?.formattedName || "unknown";
  const rawId = chat.id?._serialized || chat.id?.user || String(chat.id || contactName);

  try {
    if (Store.Cmd?.openChatAt) await Store.Cmd.openChatAt(chat);
    else if (Store.Cmd?.openChatBottom) await Store.Cmd.openChatBottom(chat);
  } catch (e) { /* read-only open — sidebar click done in Playwright */ }
  await sleep(600);

  const initialCount = msgModels(chat.msgs).length;
  const loaders = [];
  if (Store.ConversationMsgs?.loadEarlierMsgs) {
    loaders.push(() => Store.ConversationMsgs.loadEarlierMsgs(chat));
  }
  if (chat.msgs?.loadEarlierMsgs) {
    loaders.push(() => chat.msgs.loadEarlierMsgs());
  }
  if (Store.Msg?.loadEarlierMsgs) {
    loaders.push(() => Store.Msg.loadEarlierMsgs(chat));
  }

  let loadRounds = 0;
  while (loadRounds < maxLoadRounds) {
    const count = msgModels(chat.msgs).length;
    if (count >= perChatLimit) break;
    const state = chat.msgs?.msgLoadState;
    if (state && state.noEarlierMsgs) break;
    if (!loaders.length) break;
    let progressed = false;
    for (const fn of loaders) {
      try {
        await fn();
        progressed = true;
        break;
      } catch (e) { /* try next loader */ }
    }
    if (!progressed) break;
    loadRounds += 1;
    await sleep(200);
  }

  const panel = document.querySelector('[data-testid="conversation-panel-messages"]')
    || document.querySelector('#main [role="application"]')
    || document.querySelector('#main [tabindex="-1"]');
  let scrollRoundsUsed = 0;
  if (panel) {
    for (let s = 0; s < scrollRounds; s++) {
      panel.scrollTop = 0;
      await sleep(350);
      if (loaders.length) {
        const before = msgModels(chat.msgs).length;
        for (const fn of loaders) {
          try { await fn(); break; } catch (e) {}
        }
        const after = msgModels(chat.msgs).length;
        if (after >= perChatLimit) break;
        if (chat.msgs?.msgLoadState?.noEarlierMsgs) break;
        if (after === before && s > 2) break;
      } else {
        const domN = panel.querySelectorAll('[data-testid="msg-container"]').length;
        if (domN >= perChatLimit) break;
      }
      scrollRoundsUsed += 1;
    }
  }

  const msgs = msgModels(chat.msgs);
  const slice = msgs.length > perChatLimit ? msgs.slice(-perChatLimit) : msgs;
  const out = [];

  for (const msg of slice) {
    let body = (msg.body || msg.caption || "").trim();
    if (!body && (msg.isMedia || msg.mediaData)) body = "[media]";
    if (!body) continue;
    const isMe = !!(
      msg.isSentByMe
      || msg.fromMe
      || msg.id?.fromMe
      || msg.id?.from_me
      || msg.id?._serialized?.startsWith("true_")
      || msg.senderObj?.isMe
      || msg.__x_isSentByMe
      || msg.__x_id?.fromMe
    );
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

  const storeCount = msgModels(chat.msgs).length;

  if (out.length < perChatLimit && panel) {
    const seenBodies = new Set(out.map((m) => m.message));
    let domPrev = 0;
    for (let s = 0; s < scrollRounds; s++) {
      panel.scrollTop = 0;
      await sleep(400);
      const domNodes = panel.querySelectorAll('[data-testid="msg-container"]');
      if (domNodes.length >= perChatLimit) break;
      if (s > 3 && domNodes.length === domPrev) break;
      domPrev = domNodes.length;
    }
    const domNodes = panel.querySelectorAll('[data-testid="msg-container"]');
    for (const node of domNodes) {
      const textEl =
        node.querySelector('[data-testid="msg-text"] span')
        || node.querySelector(".copyable-text span")
        || node.querySelector("span.selectable-text");
      const body = (textEl?.innerText || "").trim();
      if (!body || seenBodies.has(body)) continue;
      seenBodies.add(body);
      const isMe =
        node.closest(".message-out") != null
        || node.querySelector('[data-icon="msg-dblcheck"]') != null;
      const timeEl = node.querySelector("span[dir='auto']");
      const ts = (timeEl?.innerText || "").trim();
      out.push({
        contact_name: contactName,
        chat_id_raw: rawId,
        message: body,
        timestamp: ts,
        direction: isMe ? "outgoing" : "incoming",
        media_placeholder: null,
      });
      if (out.length >= perChatLimit) break;
    }
  }

  return {
    error: null,
    messages: out,
    stats: {
      chat_index: chatIndex,
      contact_name: contactName,
      msgs_extracted: out.length,
      msgs_in_store: storeCount,
      initial_msgs: initialCount,
      load_rounds: loadRounds,
      scroll_rounds: scrollRoundsUsed,
      no_earlier: !!(chat.msgs?.msgLoadState?.noEarlierMsgs),
      loaders_available: loaders.length,
      per_chat_limit: perChatLimit,
    },
  };
}
"""

# Legacy batch extractor kept for reference/tests — prefer per-chat import above.
_EXTRACT_FULL_HISTORY_JS = _IMPORT_SINGLE_CHAT_JS

_EXTRACT_MESSAGES_JS = """
(maxChats, perChatLimit) => {
  const Store = window.Store;
  if (!Store || !Store.Chat) {
    return { error: "store_unavailable", messages: [] };
  }

  const chats = (
    typeof Store.Chat.getModels === "function"
      ? Store.Chat.getModels()
      : Array.isArray(Store.Chat.models)
        ? Store.Chat.models
        : Object.values(Store.Chat._models || {})
  ).slice(0, maxChats);
  const out = [];

  const msgModels = (collection) => {
    if (!collection) return [];
    if (typeof collection.getModels === "function") return collection.getModels();
    if (Array.isArray(collection.models)) return collection.models;
    if (collection._models) return Object.values(collection._models);
    return [];
  };

  for (const chat of chats) {
    const contactName = chat.formattedTitle || chat.name || chat.contact?.formattedName || "unknown";
    const rawId = chat.id?._serialized || chat.id?.user || String(chat.id || contactName);
    const msgs = msgModels(chat.msgs).slice(-perChatLimit);

    for (const msg of msgs) {
      const fromMe = !!(
        msg.isSentByMe
        || msg.fromMe
        || msg.id?.fromMe
        || msg.id?.from_me
        || msg.id?._serialized?.startsWith("true_")
        || msg.senderObj?.isMe
        || msg.__x_isSentByMe
        || msg.__x_id?.fromMe
      );
      if (fromMe) continue;
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


def history_load_rounds() -> int:
    try:
        return max(1, int(os.getenv("WHATSAPP_HISTORY_LOAD_ROUNDS", "50")))
    except ValueError:
        return 50


def history_scroll_rounds() -> int:
    try:
        return max(0, int(os.getenv("WHATSAPP_HISTORY_SCROLL_ROUNDS", "30")))
    except ValueError:
        return 30


def history_max_chats() -> int:
    """0 = import all chats visible in Store."""
    try:
        return max(0, int(os.getenv("WHATSAPP_HISTORY_MAX_CHATS", "0")))
    except ValueError:
        return 0


def history_chat_list_scroll_rounds() -> int:
    try:
        return max(5, int(os.getenv("WHATSAPP_HISTORY_CHAT_LIST_SCROLL_ROUNDS", "60")))
    except ValueError:
        return 60


def history_per_chat_timeout_sec() -> int:
    try:
        return max(10, int(os.getenv("WHATSAPP_HISTORY_PER_CHAT_TIMEOUT_SEC", "45")))
    except ValueError:
        return 45


_PRIVATE_CONTACT_RE = re.compile(
    r"(老婆|老公|妈妈|爸爸|宝宝|家人|老妈|老爸|母亲|父亲|儿子|女儿|奶奶|爷爷)",
    re.I,
)

_LIKELY_OUR_SENT_TEXT_RE = re.compile(
    r"(please also visit our website|www\.asia-power\.com|"
    r"please send me a photo|send me a photo|send a photo|"
    r"then we will check the correct one for you|"
    r"okay, noted|ok, noted|"
    r"this will help us find|this will help us match|"
    r"could you please confirm|please confirm|"
    r"brand:\s*|model:\s*|year:\s*|parts needed:\s*|destination country:\s*)",
    re.I,
)


def is_likely_private_contact(name: str) -> bool:
    n = (name or "").strip()
    if not n or n.lower() in ("unknown", "you"):
        return False
    if _PRIVATE_CONTACT_RE.search(n):
        return True
    return False


def compute_data_coverage(meta: dict[str, Any]) -> tuple[str, str]:
    """Return (partial|full|unknown, limitation_reason)."""
    err = meta.get("error")
    if err == "login_timeout":
        return (
            "unknown",
            "WhatsApp Web 未登录或 QR 超时；browser profile 无可读会话，无法读取新历史。",
        )
    err_str = str(err or "")
    if "browser has been closed" in err_str or "正在现有的浏览器会话中打开" in err_str:
        return (
            "unknown",
            "browser profile 被其他 Chrome/WhatsApp Web 窗口占用；请关闭后重试。"
            " 此时 DB 中的 conversations 可能仅为 parsed/raw 旧归档（常见 18 会话/29 消息）。",
        )
    if err == "store_unavailable":
        return (
            "unknown",
            "window.Store 不可用（未注入或未登录）；只能读到 parsed/raw 归档，非浏览器实时历史。",
        )
    loaded = int(meta.get("loaded_chats") or 0)
    processed = int(meta.get("processed_chats") or 0)
    msgs = int(meta.get("messages_imported") or 0)
    if loaded == 0:
        return ("unknown", err or "未从 Store 加载任何会话列表。")
    if processed == 0 or msgs == 0:
        return (
            "partial",
            "Store 报告 "
            f"{loaded} 会话，但无法打开聊天面板或提取消息（DOM 行数 {meta.get('dom_chat_rows', 0)}）。"
            "需 Playwright 点击 + 左侧列表滚动。",
        )
    reasons: list[str] = []
    failed = int(meta.get("failed_chats") or 0)
    if failed > 0:
        reasons.append(f"{failed} 个会话打开失败")
    dom_rows = int(meta.get("dom_chat_rows_after_scroll") or 0)
    if dom_rows and loaded > dom_rows:
        reasons.append(
            f"左侧聊天列表 DOM 仅渲染约 {dom_rows} 行，Store 内存有 {loaded} 个 chat"
            "（已通过 Store.openChatAt + 标题搜索绕过）"
        )
    if not meta.get("store_has_load_earlier"):
        reasons.append(
            "Store.loadEarlierMsgs 不可用；更早消息仅靠会话面板向上滚动加载"
        )
    avg = float(meta.get("avg_msgs_per_chat") or 0)
    if avg < 8:
        reasons.append(
            f"平均每会话仅 {avg:.1f} 条消息（可能 WhatsApp Web 未 hydrate 更早历史）"
        )
    cap = int((meta.get("limits") or {}).get("per_chat_limit") or 500)
    reasons.append(
        f"硬上限 WHATSAPP_HISTORY_PER_CHAT={cap}；官方 .txt 导出仍是唯一保证全量方案"
    )
    if processed >= loaded * 0.95 and msgs >= processed * 5 and not failed:
        return (
            "partial",
            "已处理 Store 中几乎全部可见会话，但仍受 WhatsApp Web 内存/DOM 限制，非财务级全量。"
            + (" " + "; ".join(reasons) if reasons else ""),
        )
    return ("partial", "; ".join(reasons))


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


def allow_sidebar_preview_fallback() -> bool:
    return os.getenv("WHATSAPP_ALLOW_SIDEBAR_FALLBACK", "").strip().lower() in {"1", "true", "yes"}


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
        self.last_import_meta: dict[str, Any] = {}

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

    def _scroll_chat_list(self, page, max_rounds: int | None = None) -> int:
        """Scroll left chat list to hydrate more rows in DOM (virtualized list)."""
        rounds = max_rounds or history_chat_list_scroll_rounds()
        pane = page.locator("#pane-side")
        if pane.count() == 0:
            return page.locator('[data-testid="cell-frame-container"]').count()
        prev = -1
        stable = 0
        for _ in range(rounds):
            count = page.locator('[data-testid="cell-frame-container"]').count()
            if count == prev:
                stable += 1
                if stable >= 4:
                    break
            else:
                stable = 0
            prev = count
            try:
                pane.evaluate("el => { el.scrollTop = el.scrollHeight; }")
            except Exception:
                break
            page.wait_for_timeout(350)
        return max(prev, 0)

    def _open_chat_by_whatsapp_search(self, page, query: str) -> tuple[bool, str]:
        """Use sidebar search — works for phone numbers when title scroll fails."""
        target = (query or "").strip()
        if not target:
            return False, ""
        try:
            search_box = page.locator(
                'div[contenteditable="true"][data-tab="3"], '
                "#side div[role='textbox'], "
                '[data-testid="chat-list-search"] div[contenteditable="true"]',
            ).first
            if search_box.count() == 0:
                btn = page.locator('button[aria-label*="Search"], span[data-icon="search"]').first
                if btn.count() > 0:
                    btn.click(timeout=5000)
                    page.wait_for_timeout(400)
                    search_box = page.locator("#side div[contenteditable='true']").first
            if search_box.count() == 0:
                return False, ""
            search_box.click(timeout=5000)
            page.keyboard.press("Control+A")
            page.keyboard.press("Backspace")
            search_box.fill(target, timeout=5000)
            page.wait_for_timeout(900)
            row = page.locator('[data-testid="cell-frame-container"]').first
            if row.count() == 0:
                return False, ""
            title_el = row.locator("span[title]").first
            opened_name = (title_el.get_attribute("title") or "").strip()
            if not opened_name:
                return False, ""
            row.click(timeout=5000)
            page.wait_for_timeout(900)
            return True, opened_name
        except Exception:
            return False, ""

    def _open_chat_by_title(self, page, title: str) -> bool:
        """Find chat row by span[title] and click — works across virtualized sidebar."""
        target = (title or "").strip()
        if not target or target == "unknown":
            return False
        pane = page.locator("#pane-side")
        if pane.count() > 0:
            try:
                pane.evaluate("el => { el.scrollTop = 0; }")
                page.wait_for_timeout(250)
            except Exception:
                pass
        max_rounds = history_chat_list_scroll_rounds()
        for _ in range(max_rounds):
            rows = page.locator('[data-testid="cell-frame-container"]')
            n = rows.count()
            for i in range(n):
                try:
                    row = rows.nth(i)
                    title_el = row.locator("span[title]").first
                    if title_el.count() == 0:
                        continue
                    row_title = (title_el.get_attribute("title") or "").strip()
                    if row_title == target:
                        row.scroll_into_view_if_needed(timeout=5000)
                        row.click(timeout=5000)
                        page.wait_for_timeout(900)
                        return True
                except Exception:
                    continue
            if pane.count() > 0:
                try:
                    pane.evaluate("el => { el.scrollTop += 900; }")
                except Exception:
                    break
                page.wait_for_timeout(280)
        return False

    def _open_chat_for_store_index(self, page, chat_index: int) -> tuple[bool, str, str]:
        """Open chat via Store API then title click fallback. Returns (ok, name, raw_id)."""
        name = ""
        raw_id = ""
        try:
            res = page.evaluate(_OPEN_CHAT_STORE_JS, chat_index)
            if isinstance(res, dict) and not res.get("error"):
                name = (res.get("name") or "").strip()
                raw_id = (res.get("raw_id") or name).strip()
                if int(res.get("panel_msgs") or 0) > 0:
                    return True, name, raw_id
        except Exception:
            pass
        try:
            store = page.evaluate(_GET_STORE_CHATS_JS)
            if isinstance(store, dict):
                chats = store.get("chats") or []
                if chat_index < len(chats):
                    entry = chats[chat_index]
                    name = (entry.get("name") or "").strip()
                    raw_id = (entry.get("id") or name).strip()
        except Exception:
            pass
        if name and self._open_chat_by_title(page, name):
            return True, name, raw_id
        return False, name, raw_id

    def _open_chat_by_index(self, page, chat_index: int) -> str | None:
        """Legacy wrapper — prefer _open_chat_for_store_index."""
        ok, name, _ = self._open_chat_for_store_index(page, chat_index)
        return name if ok else None

    def fetch_history_batches(
        self,
        on_batch: Any | None = None,
        on_progress: Any | None = None,
    ) -> list[list[dict[str, Any]]]:
        """Per-chat history import with openChat + loadEarlierMsgs + scroll (read-only)."""
        assert_write_blocked("history_import_readonly")
        batches: list[list[dict[str, Any]]] = []
        self.last_import_meta = {
            "loaded_chats": 0,
            "processed_chats": 0,
            "messages_imported": 0,
            "skipped_private": 0,
            "failed_chats": 0,
            "dom_chat_rows": 0,
            "dom_chat_rows_after_scroll": 0,
            "data_coverage": "unknown",
            "limitation_reason": "",
            "store_has_load_earlier": False,
            "limits": {
                "per_chat_limit": history_per_chat_limit(),
                "load_rounds": history_load_rounds(),
                "scroll_rounds": history_scroll_rounds(),
                "chat_list_scroll_rounds": history_chat_list_scroll_rounds(),
                "batch_size": history_batch_size(),
                "per_chat_timeout_sec": history_per_chat_timeout_sec(),
                "note": (
                    "WhatsApp Web 只能读取已 hydrate 到 Store/DOM 的消息，非服务器端全量。"
                    "左侧 chat list 需滚动；每 chat 需 open + 向上滚动。"
                ),
            },
            "chat_stats": [],
        }
        try:
            page = self._launch(headless=headless_mode())
            page.goto(WHATSAPP_WEB_URL, wait_until="domcontentloaded", timeout=60_000)
            if not self._wait_for_login(page, timeout_sec=connect_timeout_sec()):
                self.last_import_meta["error"] = "login_timeout"
                cov, reason = compute_data_coverage(self.last_import_meta)
                self.last_import_meta["data_coverage"] = cov
                self.last_import_meta["limitation_reason"] = reason
                return batches
            self._logged_in = True

            per_chat = history_per_chat_limit()
            load_rounds = history_load_rounds()
            scroll_rounds = history_scroll_rounds()
            batch_size = history_batch_size()

            self.last_import_meta["dom_chat_rows"] = page.locator(
                '[data-testid="cell-frame-container"]',
            ).count()
            self.last_import_meta["dom_chat_rows_after_scroll"] = self._scroll_chat_list(page)

            store_payload = page.evaluate(_GET_STORE_CHATS_JS)
            if not isinstance(store_payload, dict) or store_payload.get("error"):
                dom_list = page.evaluate(_DOM_LIST_CHATS_JS)
                if isinstance(dom_list, dict) and dom_list.get("total", 0) > 0:
                    store_chats = [
                        {"index": i, "name": n, "id": n, "is_group": False}
                        for i, n in enumerate(dom_list.get("contacts") or [])
                    ]
                    self.last_import_meta["import_mode"] = "dom_only"
                else:
                    self.last_import_meta["error"] = (store_payload or {}).get(
                        "error", "store_unavailable",
                    )
                    cov, reason = compute_data_coverage(self.last_import_meta)
                    self.last_import_meta["data_coverage"] = cov
                    self.last_import_meta["limitation_reason"] = reason
                    return batches
            else:
                store_chats = list(store_payload.get("chats") or [])
                self.last_import_meta["import_mode"] = "store_api"
                info = page.evaluate(_GET_CHAT_COUNT_JS)
                if isinstance(info, dict):
                    self.last_import_meta["store_info"] = info
                    self.last_import_meta["store_has_load_earlier"] = bool(
                        info.get("has_conversation_msgs"),
                    )

            loaded = len(store_chats)
            self.last_import_meta["loaded_chats"] = loaded
            self.last_import_meta["total_chats_in_store"] = loaded
            max_chats = history_max_chats() or loaded
            import_count = min(loaded, max_chats)

            batch_buf: list[dict[str, Any]] = []
            chat_stats: list[dict[str, Any]] = []
            messages_imported = 0
            processed = 0
            skipped_private = 0
            failed_chats = 0

            for pos, entry in enumerate(store_chats[:import_count]):
                chat_index = int(entry.get("index", pos))
                contact_name = (entry.get("name") or "unknown").strip()
                raw_id = (entry.get("id") or contact_name).strip()

                if is_likely_private_contact(contact_name):
                    skipped_private += 1
                    continue

                if self.last_import_meta.get("import_mode") == "dom_only":
                    opened = self._open_chat_by_title(page, contact_name)
                else:
                    opened, opened_name, opened_id = self._open_chat_for_store_index(
                        page, chat_index,
                    )
                    if opened_name:
                        contact_name = opened_name
                    if opened_id:
                        raw_id = opened_id

                if not opened:
                    failed_chats += 1
                    chat_stats.append({
                        "chat_index": chat_index,
                        "contact_name": contact_name,
                        "error": "open_failed",
                    })
                    continue

                if self.last_import_meta.get("import_mode") == "dom_only":
                    result = page.evaluate(_DOM_SCRAPE_CHAT_JS, [per_chat, scroll_rounds])
                else:
                    result = page.evaluate(
                        _IMPORT_SINGLE_CHAT_JS,
                        [chat_index, per_chat, load_rounds, scroll_rounds],
                    )

                if not isinstance(result, dict) or (
                    result.get("error") and result.get("error") not in ("chat_not_found",)
                ):
                    failed_chats += 1
                    continue

                stats = dict(result.get("stats") or {})
                stats["chat_index"] = chat_index
                stats["contact_name"] = contact_name
                chat_stats.append(stats)
                msgs = list(result.get("messages") or [])
                for m in msgs:
                    m.setdefault("contact_name", contact_name)
                    m.setdefault("chat_id_raw", raw_id)
                if msgs:
                    batch_buf.extend(msgs)
                    messages_imported += len(msgs)
                    processed += 1

                self.last_import_meta["processed_chats"] = processed
                self.last_import_meta["messages_imported"] = messages_imported
                self.last_import_meta["skipped_private"] = skipped_private
                self.last_import_meta["failed_chats"] = failed_chats

                if on_progress and pos % 10 == 0:
                    try:
                        on_progress(pos + 1, import_count, stats)
                    except Exception:
                        pass
                if len(batch_buf) >= batch_size:
                    batches.append(batch_buf)
                    if on_batch:
                        on_batch(batch_buf)
                    batch_buf = []

            if batch_buf:
                batches.append(batch_buf)
                if on_batch:
                    on_batch(batch_buf)

            self.last_import_meta["chat_stats"] = chat_stats
            self.last_import_meta["chats_processed"] = processed
            self.last_import_meta["messages_extracted"] = messages_imported
            self.last_import_meta["contacts_with_messages"] = processed
            self.last_import_meta["avg_msgs_per_chat"] = round(
                messages_imported / max(processed, 1), 1,
            )
            avg_store = (
                sum(s.get("msgs_in_store", 0) for s in chat_stats) / max(len(chat_stats), 1)
            )
            self.last_import_meta["avg_msgs_in_store_per_chat"] = round(avg_store, 1)
            cov, reason = compute_data_coverage(self.last_import_meta)
            self.last_import_meta["data_coverage"] = cov
            self.last_import_meta["limitation_reason"] = reason
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
                    return self._wait_for_store(page)
            except Exception:
                pass
            time.sleep(2)
        return False

    def _wait_for_store(self, page) -> bool:
        try:
            result = page.evaluate(_INJECT_STORE_JS)
            if isinstance(result, dict) and result.get("ok"):
                return True
        except Exception:
            pass
        try:
            page.wait_for_function(
                """() => {
                  const c = window.Store?.Chat;
                  if (!c) return false;
                  const n = typeof c.getModels === 'function'
                    ? c.getModels().length
                    : Array.isArray(c.models) ? c.models.length
                    : c._models ? Object.keys(c._models).length : 0;
                  return n > 0;
                }""",
                timeout=STORE_WAIT_MS,
            )
            return True
        except Exception:
            pass
        try:
            dom = page.evaluate(_DOM_LIST_CHATS_JS)
            return isinstance(dom, dict) and int(dom.get("total") or 0) > 0
        except Exception:
            return False

    def _read_messages(self, page) -> list[dict[str, Any]]:
        max_chats = poll_max_chats()
        per_chat = poll_recent_limit()
        try:
            result = page.evaluate(_EXTRACT_MESSAGES_JS, max_chats, per_chat)
            if isinstance(result, dict) and not result.get("error"):
                return list(result["messages"])
        except Exception:
            pass
        if not allow_sidebar_preview_fallback():
            return []
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
            if str(rec.get("direction") or "").lower() == "outgoing":
                continue
            body = (rec.get("message") or "").strip()
            if not body:
                continue
            if _LIKELY_OUR_SENT_TEXT_RE.search(body):
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

    def get_store_chats(self, page) -> list[dict[str, Any]]:
        try:
            result = page.evaluate(_GET_STORE_CHATS_JS)
        except Exception:
            return []
        if not isinstance(result, dict) or result.get("error"):
            return []
        return list(result.get("chats") or [])

    def find_store_chats_by_query(self, page, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        from customer_gateway.whatsapp_contact_resolver import rank_store_chats

        return rank_store_chats(self.get_store_chats(page), query, limit=limit)

    def resolve_and_open_chat(self, page, contact_query: str) -> dict[str, Any]:
        """Exact title → alias/phone map → local records → Store → sidebar search."""
        from customer_gateway.whatsapp_contact_resolver import (
            contact_title_variants,
            resolve_query_targets,
            search_local_contact_names,
        )

        query = (contact_query or "").strip()
        if not query:
            return {"ok": False, "error": "missing_contact_name", "candidates": []}

        targets = resolve_query_targets(query)
        tried: list[str] = []

        def try_titles(titles: list[str], *, match_mode: str, **extra: Any) -> dict[str, Any] | None:
            for title in titles:
                for variant in contact_title_variants(title):
                    if variant in tried:
                        continue
                    tried.append(variant)
                    if self._open_chat_by_title(page, variant):
                        return {
                            "ok": True,
                            "contact_name": variant,
                            "match_mode": match_mode,
                            **extra,
                        }
            return None

        hit = try_titles(
            [query, *list(targets.get("whatsapp_titles") or [])],
            match_mode="exact_title",
        )
        if hit:
            return hit

        local_hits = search_local_contact_names(query, limit=8)
        for row in local_hits:
            hit = try_titles(
                [str(row.get("name") or "")],
                match_mode="local_records",
                local_score=row.get("score"),
                alias_name=row.get("alias_name") or "",
            )
            if hit:
                return hit

        store_hits = self.find_store_chats_by_query(page, query, limit=8)
        for row in store_hits:
            idx = row.get("index")
            name = str(row.get("name") or "").strip()
            if idx is None:
                continue
            opened, opened_name, _raw_id = self._open_chat_for_store_index(page, int(idx))
            if opened:
                return {
                    "ok": True,
                    "contact_name": opened_name or name,
                    "match_mode": "store_search",
                    "store_score": row.get("score"),
                    "chat_index": idx,
                }
            if name:
                hit = try_titles([name], match_mode="store_title", store_score=row.get("score"))
                if hit:
                    return hit

        for search_q in targets.get("search_strings") or []:
            opened, opened_name = self._open_chat_by_whatsapp_search(page, search_q)
            if opened:
                return {
                    "ok": True,
                    "contact_name": opened_name,
                    "match_mode": "sidebar_search",
                    "search_query": search_q,
                }

        return {
            "ok": False,
            "error": "chat_not_found",
            "contact_query": query,
            "resolved_targets": targets,
            "candidates": store_hits or local_hits,
            "tried_titles": tried[:30],
        }

    def send_low_risk_text(self, *, contact_name: str, text: str) -> dict[str, Any]:
        """Send an approved low-risk text to an existing WhatsApp chat."""
        assert_low_risk_auto_send_allowed("send_low_risk_text")
        contact = (contact_name or "").strip()
        body = (text or "").strip()
        if not contact:
            return {"ok": False, "error": "missing_contact_name"}
        if not body:
            return {"ok": False, "error": "missing_text"}

        try:
            page = self._launch(headless=headless_mode())
            page.goto(WHATSAPP_WEB_URL, wait_until="domcontentloaded", timeout=60_000)
            if not self._wait_for_login(page, timeout_sec=45):
                return {"ok": False, "error": "login_timeout"}
            self._logged_in = True

            resolved = self.resolve_and_open_chat(page, contact)
            if not resolved.get("ok"):
                return {
                    "ok": False,
                    "error": resolved.get("error", "chat_not_found"),
                    "contact_name": contact,
                    "candidates": resolved.get("candidates") or [],
                    "tried_titles": resolved.get("tried_titles") or [],
                }
            opened_name = str(resolved.get("contact_name") or contact)

            box = page.locator(
                "footer div[contenteditable='true'][role='textbox'], "
                "footer div[contenteditable='true']",
            ).last
            if box.count() == 0:
                return {"ok": False, "error": "message_box_not_found", "contact_name": opened_name}

            box.click(timeout=10_000)
            box.fill(body, timeout=10_000)
            page.keyboard.press("Enter")
            page.wait_for_timeout(1200)
            return {
                "ok": True,
                "contact_name": opened_name,
                "match_mode": resolved.get("match_mode"),
                "chars": len(body),
                "mode": "low_risk_auto_send",
            }
        except BrowserAdapterError:
            raise
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:300], "contact_name": contact}
        finally:
            self.close()

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
