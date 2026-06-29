"""Local WhatsApp Business App linked-device session state."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import customer_gateway.gateway_readonly as gw

CONNECTOR_MODE = "business_web_readonly"
SESSION_FILENAME = "session_state.json"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def session_dir() -> Path:
    env = os.getenv("WHATSAPP_SESSION_DIR", "").strip()
    if env:
        return Path(env).expanduser()
    return gw.GATEWAY_ROOT / "whatsapp_session"


def session_path() -> Path:
    return session_dir() / SESSION_FILENAME


def poll_state_path() -> Path:
    return session_dir() / "poll_state.json"


def default_session() -> dict[str, Any]:
    return {
        "connector_mode": CONNECTOR_MODE,
        "connected": False,
        "adapter": "mock",
        "qr_pending": True,
        "linked_device": False,
        "created_at": _now(),
        "last_sync": None,
        "last_poll": None,
        "messages_polled": 0,
        "send_enabled": False,
        "mark_read_enabled": False,
        "read_only": True,
    }


def ensure_session_dir() -> Path:
    directory = session_dir()
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def load_session() -> dict[str, Any]:
    ensure_session_dir()
    path = session_path()
    if not path.is_file():
        return default_session()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default_session()
    merged = default_session()
    merged.update(data)
    merged["send_enabled"] = False
    merged["mark_read_enabled"] = False
    merged["read_only"] = True
    return merged


def save_session(state: dict[str, Any]) -> None:
    ensure_session_dir()
    state = dict(state)
    state["send_enabled"] = False
    state["mark_read_enabled"] = False
    state["read_only"] = True
    state["updated_at"] = _now()
    session_path().write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def session_exists() -> bool:
    return session_path().is_file()


def is_connected() -> bool:
    return bool(load_session().get("connected"))


def load_poll_state() -> dict[str, Any]:
    ensure_session_dir()
    path = poll_state_path()
    if not path.is_file():
        return {"polled_ids": [], "last_poll": None}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"polled_ids": [], "last_poll": None}


def save_poll_state(state: dict[str, Any]) -> None:
    ensure_session_dir()
    poll_state_path().write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def start_connect(*, adapter: str = "auto") -> dict[str, Any]:
    """Initialize session and return QR / linked-device instructions."""
    state = load_session()
    state["qr_pending"] = True
    state["connected"] = False
    state["adapter"] = adapter
    state["connect_started_at"] = _now()
    save_session(state)
    return state


def mark_connected(*, adapter: str, linked_device: bool = True) -> dict[str, Any]:
    state = load_session()
    state["connected"] = True
    state["qr_pending"] = False
    state["linked_device"] = linked_device
    state["adapter"] = adapter
    state["connected_at"] = _now()
    save_session(state)
    return state


def update_sync_time() -> None:
    state = load_session()
    state["last_sync"] = _now()
    save_session(state)


def update_poll_stats(new_count: int) -> None:
    state = load_session()
    state["last_poll"] = _now()
    state["messages_polled"] = int(state.get("messages_polled", 0)) + new_count
    save_session(state)


def qr_connect_instructions() -> str:
    return (
        "WhatsApp Business App 关联设备连接（只读）\n"
        "=" * 36 + "\n\n"
        "1. 在本机启动连接器：\n"
        "   python main.py \"/whatsapp business connect\"\n\n"
        "2. 打开 CEO 手机 WhatsApp Business App\n\n"
        "3. 进入：设置 → 关联设备 → 关联设备\n\n"
        "4. 扫描连接器显示的 QR 码（Linked Devices / WhatsApp Web）\n\n"
        "5. 连接成功后执行：\n"
        "   python main.py \"/whatsapp business status\"\n"
        "   python main.py \"/whatsapp business poll --readonly\"\n"
        "   python main.py \"/whatsapp listen --readonly\"\n\n"
        "安全：只读监听，禁止发送/回复/删除/归档/mark-read。\n"
        "本阶段不使用 WhatsApp Cloud API，不迁移号码。"
    )


def format_mock_qr_block() -> str:
    return (
        "[模拟 QR — 本地无浏览器自动化时使用 Mock 适配器]\n"
        "┌─────────────────────────────┐\n"
        "│  MOCK-QR-APLIVE-002-READONLY │\n"
        "│  Scan via Linked Devices     │\n"
        "└─────────────────────────────┘\n"
        "Mock 模式：无需真实扫码即可 poll 样本消息。"
    )
