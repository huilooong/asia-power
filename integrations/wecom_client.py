"""WeCom API client — access_token cache and outbound messages."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from integrations.wecom_config import WeComConfig, load_wecom_config

_TOKEN_CACHE: dict[str, Any] = {"token": "", "expires_at": 0.0}


def _get_access_token(cfg: WeComConfig | None = None) -> str:
    cfg = cfg or load_wecom_config()
    if not cfg.enabled:
        raise RuntimeError("WeCom is not configured (missing WECOM_* env vars)")

    now = time.time()
    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > now + 60:
        return _TOKEN_CACHE["token"]

    params = urllib.parse.urlencode({"corpid": cfg.corp_id, "corpsecret": cfg.secret})
    url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?{params}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    if body.get("errcode", -1) != 0:
        raise RuntimeError(f"WeCom gettoken failed: {body}")

    token = body["access_token"]
    expires_in = int(body.get("expires_in", 7200))
    _TOKEN_CACHE["token"] = token
    _TOKEN_CACHE["expires_at"] = now + expires_in
    return token


def send_text_to_user(user_id: str, content: str, *, cfg: WeComConfig | None = None) -> dict[str, Any]:
    """Send application message to one member (userid)."""
    cfg = cfg or load_wecom_config()
    token = _get_access_token(cfg)
    url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={token}"
    payload = {
        "touser": user_id,
        "msgtype": "text",
        "agentid": int(cfg.agent_id),
        "text": {"content": content[:2048]},
        "safe": 0,
    }
    return _post_json(url, payload)


def send_text_to_group(chat_id: str, content: str, *, cfg: WeComConfig | None = None) -> dict[str, Any]:
    """Send text to an internal group via appchat API."""
    cfg = cfg or load_wecom_config()
    token = _get_access_token(cfg)
    url = f"https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token={token}"
    payload = {
        "chatid": chat_id,
        "msgtype": "text",
        "text": {"content": content[:2048]},
        "safe": 0,
    }
    return _post_json(url, payload)


def download_media(media_id: str, *, cfg: WeComConfig | None = None) -> bytes:
    """Download temporary media (image) by MediaId — valid ~3 days on WeCom."""
    cfg = cfg or load_wecom_config()
    token = _get_access_token(cfg)
    params = urllib.parse.urlencode({"access_token": token, "media_id": media_id})
    url = f"https://qyapi.weixin.qq.com/cgi-bin/media/get?{params}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            content_type = (resp.headers.get("Content-Type") or "").lower()
            body = resp.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"WeCom media/get HTTP {exc.code}: {raw}") from exc

    if "application/json" in content_type or (body[:1] == b"{" and b"errcode" in body[:200]):
        try:
            err = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"WeCom media/get invalid JSON: {body[:200]!r}") from exc
        raise RuntimeError(f"WeCom media/get failed: {err}")

    if not body:
        raise RuntimeError("WeCom media/get returned empty body")
    return body


def verify_credentials(cfg: WeComConfig | None = None) -> dict[str, Any]:
    """Fetch access_token once — confirms corp_id + secret."""
    cfg = cfg or load_wecom_config()
    token = _get_access_token(cfg)
    return {"ok": True, "access_token_prefix": token[:8] + "…", "agent_id": cfg.agent_id}


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"WeCom HTTP {exc.code}: {raw}") from exc

    if body.get("errcode", -1) != 0:
        raise RuntimeError(f"WeCom API error: {body}")
    return body
