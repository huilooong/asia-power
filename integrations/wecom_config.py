"""WeCom (企业微信) configuration from environment — no secrets in code."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class WeComConfig:
    corp_id: str
    agent_id: str
    secret: str
    token: str
    encoding_aes_key: str
    callback_host: str
    callback_port: int
    callback_path: str
    allowed_chat_ids: frozenset[str]
    allowed_user_ids: frozenset[str]
    require_at_mention: bool
    enabled: bool


def _parse_csv(raw: str | None) -> frozenset[str]:
    if not raw:
        return frozenset()
    return frozenset(part.strip() for part in raw.split(",") if part.strip())


def load_wecom_config() -> WeComConfig:
    """Load 子敬 WeCom agent settings from env."""
    corp_id = (os.getenv("WECOM_CORP_ID") or "").strip()
    agent_id = (os.getenv("WECOM_AGENT_ID") or "").strip()
    secret = (os.getenv("WECOM_AGENT_SECRET") or "").strip()
    token = (os.getenv("WECOM_CALLBACK_TOKEN") or "").strip()
    aes_key = (os.getenv("WECOM_ENCODING_AES_KEY") or "").strip()
    port_raw = (os.getenv("WECOM_CALLBACK_PORT") or "8790").strip()
    try:
        port = int(port_raw)
    except ValueError:
        port = 8790

    required = [corp_id, agent_id, secret, token, aes_key]
    enabled = all(required)

    return WeComConfig(
        corp_id=corp_id,
        agent_id=agent_id,
        secret=secret,
        token=token,
        encoding_aes_key=aes_key,
        callback_host=(os.getenv("WECOM_CALLBACK_HOST") or "127.0.0.1").strip(),
        callback_port=port,
        callback_path=(os.getenv("WECOM_CALLBACK_PATH") or "/wecom/callback").strip(),
        allowed_chat_ids=_parse_csv(os.getenv("WECOM_ALLOWED_CHAT_IDS")),
        allowed_user_ids=_parse_csv(os.getenv("WECOM_ALLOWED_USER_IDS")),
        require_at_mention=(os.getenv("WECOM_REQUIRE_AT_MENTION") or "1").strip() not in (
            "0", "false", "False", "no",
        ),
        enabled=enabled,
    )


def public_callback_url(cfg: WeComConfig) -> str:
    """URL CEO pastes into WeCom admin (must be public HTTPS in production)."""
    base = (os.getenv("WECOM_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if not base:
        return f"http://{cfg.callback_host}:{cfg.callback_port}{cfg.callback_path}"
    return f"{base}{cfg.callback_path}"
