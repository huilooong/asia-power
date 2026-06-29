"""WhatsApp Business App linked-device read-only web connector."""

from __future__ import annotations

import os
from typing import Any

from audit.logger import log_error, log_event
from customer_gateway.whatsapp_business_session import (
    CONNECTOR_MODE,
    format_mock_qr_block,
    is_connected,
    load_session,
    mark_connected,
    qr_connect_instructions,
    session_dir,
    session_exists,
    start_connect,
)
from customer_gateway.whatsapp_connector import SEND_ENABLED
from customer_gateway.whatsapp_live_adapter import (
    AdapterResolution,
    BrowserAdapterError,
    get_adapter_name,
    requested_adapter_mode,
    resolve_adapter_resolution,
)
from customer_gateway.whatsapp_live_readonly import inbox_dir
from customer_gateway.whatsapp_safety import SafetyError, assert_write_blocked


def connector_mode() -> str:
    return os.getenv("WHATSAPP_CONNECTOR_MODE", CONNECTOR_MODE).strip() or CONNECTOR_MODE


def live_adapter_mode() -> str:
    return os.getenv("WHATSAPP_LIVE_ADAPTER", "").strip().lower() or "mock"


def send_enabled_effective() -> bool:
    return SEND_ENABLED


def mark_read_enabled_effective() -> bool:
    env = os.getenv("WHATSAPP_MARK_READ_ENABLED", "false").strip().lower()
    if env in ("1", "true", "yes"):
        log_event("whatsapp_mark_read_env_blocked", env=env, effective=False)
    return False


def enforce_write_blocked(operation: str) -> None:
    try:
        assert_write_blocked(operation)
    except SafetyError:
        log_error(f"WhatsApp Business write blocked: {operation}", context="business_web_connector")
        log_event("whatsapp_business_write_blocked", operation=operation)
        raise


class WhatsAppBusinessWebConnector:
    """Linked-device / WhatsApp Web style read-only connector."""

    def __init__(self, *, adapter_mode: str = "auto") -> None:
        self.adapter_mode = adapter_mode
        self._resolution: AdapterResolution = resolve_adapter_resolution(adapter_mode)
        self._adapter = self._resolution.adapter

    @property
    def adapter(self):
        return self._adapter

    @property
    def resolution(self) -> AdapterResolution:
        return self._resolution

    def connect(self) -> dict[str, Any]:
        enforce_write_blocked("connect_readonly")
        start_connect(adapter=get_adapter_name(self._adapter))
        result = self._adapter.connect()
        if result.get("ok") and not result.get("mock_session"):
            mark_connected(
                adapter=get_adapter_name(self._adapter),
                linked_device=bool(result.get("logged_in")),
            )
        adapter_name = get_adapter_name(self._adapter)
        lines = [qr_connect_instructions(), ""]
        if adapter_name == "mock":
            lines.append(format_mock_qr_block())
            lines.append("")
        elif adapter_name == "browser":
            lines.extend([
                "浏览器适配器：Chromium 将打开 https://web.whatsapp.com",
                "如未登录，请扫描页面 QR 码：",
                "  WhatsApp Business → Linked Devices → Link a Device",
                "",
                result.get("message", ""),
                "",
            ])
        lines.extend([
            f"requested_adapter: {self._resolution.requested_adapter}",
            f"active_adapter: {self._resolution.active_adapter}",
            f"fallback_reason: {self._resolution.fallback_reason or 'none'}",
            f"会话目录: {session_dir()}",
            f"连接结果: {'成功' if result.get('ok') else '失败'}",
            f"logged_in: {result.get('logged_in', False)}",
            f"mock_session: {result.get('mock_session', False)}",
        ])
        if not result.get("ok"):
            if result.get("error"):
                lines.append(f"错误: {result['error']}")
            if result.get("hint"):
                lines.append(f"提示: {result['hint']}")
        return {
            "ok": bool(result.get("ok")),
            "session": load_session(),
            "adapter_result": result,
            "message": "\n".join(line for line in lines if line is not None),
        }

    def status(self) -> dict[str, Any]:
        session = load_session()
        adapter_status = self._adapter.status()
        is_mock = self._resolution.active_adapter == "mock"
        logged_in = False
        mock_session = is_mock
        if is_mock:
            logged_in = False
        else:
            logged_in = bool(adapter_status.get("logged_in"))
            if not logged_in and self._resolution.active_adapter == "browser":
                logged_in = bool(is_connected() and session.get("adapter") == "browser")

        return {
            "connector_mode": connector_mode(),
            "requested_adapter": self._resolution.requested_adapter,
            "active_adapter": self._resolution.active_adapter,
            "fallback_reason": self._resolution.fallback_reason,
            "session_exists": session_exists(),
            "connected": (not is_mock) and (logged_in or is_connected()),
            "logged_in": logged_in,
            "mock_session": mock_session,
            "adapter": self._resolution.active_adapter,
            "adapter_available": self._adapter.is_available(),
            "last_sync": session.get("last_sync"),
            "last_poll": session.get("last_poll"),
            "last_poll_time": session.get("last_poll"),
            "read_only": True,
            "readonly": True,
            "send_enabled": send_enabled_effective(),
            "mark_read_enabled": mark_read_enabled_effective(),
            "inbox_path": str(inbox_dir()),
            "session_dir": str(session_dir()),
            "adapter_status": adapter_status,
        }

    def format_status(self) -> str:
        info = self.status()
        fallback = info.get("fallback_reason") or "none"
        lines = [
            "WhatsApp Business App 连接器状态（只读）",
            "=" * 36,
            f"连接器模式: {info['connector_mode']}",
            f"requested_adapter: {info['requested_adapter']}",
            f"active_adapter: {info['active_adapter']}",
            f"fallback_reason: {fallback}",
            f"session_dir: {info['session_dir']}",
            f"logged_in: {'true' if info['logged_in'] else 'false'}",
            f"mock_session: {'true' if info.get('mock_session') else 'false'}",
            f"会话存在: {'是' if info['session_exists'] else '否'}",
            "readonly: true",
            "send_enabled: false",
            "mark_read_enabled: false",
            f"收件箱 WHATSAPP_LIVE_INBOX: {info['inbox_path']}",
            f"last_poll_time: {info.get('last_poll_time') or '从未'}",
            f"上次同步: {info.get('last_sync') or '从未'}",
            "",
            "命令:",
            "  /whatsapp business connect",
            "  /whatsapp business poll --readonly",
            "  /whatsapp listen --readonly",
            "",
            "安全: 禁止 send/reply/type/click_send/delete/archive/mark-read",
        ]
        return "\n".join(lines)

    def send_message(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("send_message")

    def reply_message(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("reply_message")

    def type_message(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("type_message")

    def click_send(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("click_send")

    def delete_message(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("delete_message")

    def mark_read(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("mark_read")

    def archive_chat(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("archive_chat")

    def modify_message(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("modify_message")

    def star_message(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("star_message")

    def call_contact(self, *_args: Any, **_kwargs: Any) -> None:
        enforce_write_blocked("call_contact")


def _format_adapter_error(exc: BrowserAdapterError) -> str:
    requested = live_adapter_mode() or requested_adapter_mode("auto")
    return (
        "WhatsApp Business App 连接器状态（只读）\n"
        "=" * 36 + "\n"
        f"requested_adapter: {requested}\n"
        "active_adapter: none\n"
        f"fallback_reason: {exc}\n"
        "logged_in: false\n"
        "mock_session: false\n"
        "readonly: true\n"
        "send_enabled: false\n"
        "\n"
        "Browser adapter 初始化失败 — 未降级到 mock。\n"
        "请安装 Playwright 后重试:\n"
        "  pip install playwright\n"
        "  python -m playwright install chromium"
    )


def business_connect() -> str:
    try:
        conn = WhatsAppBusinessWebConnector()
        result = conn.connect()
        return result.get("message", "连接失败")
    except BrowserAdapterError as exc:
        return _format_adapter_error(exc) + f"\n\n异常: {exc}"


def business_status() -> str:
    try:
        return WhatsAppBusinessWebConnector().format_status()
    except BrowserAdapterError as exc:
        return _format_adapter_error(exc)
