"""Transcribe Telegram voice/audio messages via OpenAI Whisper.

Telegram voice notes arrive as OGG/Opus (.oga); ``audio`` uploads may be any
common format. Whisper accepts ogg/oga directly, so no ffmpeg step is needed.
"""

from __future__ import annotations

import io
import json
import os
import urllib.request
from typing import Any

from openai import OpenAI

from tools import message_tool

TELEGRAM_API = "https://api.telegram.org"
TRANSCRIBE_MODEL = os.getenv("COO_VOICE_MODEL", "whisper-1")


def _get_file_path(token: str, file_id: str) -> str:
    url = f"{TELEGRAM_API}/bot{token}/getFile?file_id={file_id}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError(f"getFile failed: {data}")
    return data["result"]["file_path"]


def _download(token: str, file_path: str) -> bytes:
    url = f"{TELEGRAM_API}/file/bot{token}/{file_path}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        return resp.read()


def transcribe_voice_message(message: dict[str, Any]) -> str | None:
    """Download a Telegram voice/audio message and return its transcription.

    Returns None when the message carries no voice/audio payload. Raises on
    download or transcription failure so the caller can surface a friendly error.
    """
    media = message.get("voice") or message.get("audio")
    if not media:
        return None
    file_id = media.get("file_id")
    if not file_id:
        return None

    token = message_tool.coo_telegram_token()
    if not token:
        raise RuntimeError("COO_TELEGRAM_BOT_TOKEN not set")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    file_path = _get_file_path(token, file_id)
    audio_bytes = _download(token, file_path)

    # Give the in-memory file a name with an extension Whisper recognizes.
    fname = file_path.rsplit("/", 1)[-1] or "voice.oga"
    if "." not in fname:
        fname += ".oga"
    buf = io.BytesIO(audio_bytes)
    buf.name = fname

    client = OpenAI(api_key=api_key, timeout=120.0, max_retries=1)
    result = client.audio.transcriptions.create(model=TRANSCRIBE_MODEL, file=buf)
    return (getattr(result, "text", "") or "").strip()
