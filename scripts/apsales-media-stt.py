#!/usr/bin/env python3
"""Speech-to-text adapter for WhatsApp voice notes.

Providers (env APSALES_STT_PROVIDER):
  - unset / none  → status=disabled (CEO has not selected a vendor)
  - openai        → OpenAI audio transcription (gpt-4o-mini-transcribe or whisper-1)
  - google        → Google Cloud Speech-to-Text (Chirp / default)
  - assemblyai    → AssemblyAI Universal

Credentials via env only — never hardcode keys.
Stdout JSON only; never prints audio bytes.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


def _provider() -> str:
    return str(os.environ.get("APSALES_STT_PROVIDER") or "none").strip().lower()


def _openai_transcribe(path: Path) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("APSALES_OPENAI_API_KEY")
    if not api_key:
        return {"status": "failed", "error": "missing_OPENAI_API_KEY"}
    try:
        import urllib.request
    except ImportError:
        return {"status": "failed", "error": "urllib_missing"}

    model = os.environ.get("APSALES_STT_OPENAI_MODEL") or "gpt-4o-mini-transcribe"
    boundary = "----apsalesSTTBoundary7d93"
    file_bytes = path.read_bytes()
    filename = path.name or "voice.ogg"
    body = b""
    for name, value in (("model", model), ("response_format", "json")):
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    body += f"--{boundary}\r\n".encode()
    body += (
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode()
    body += file_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"status": "failed", "error": type(exc).__name__, "detail": str(exc)[:200]}

    text = str(payload.get("text") or "").strip()
    if not text:
        return {"status": "failed", "error": "empty_transcript", "provider": "openai"}
    return {
        "status": "success",
        "provider": "openai",
        "model": model,
        "text": text[:2000],
        "confidence": 0.85,
        "language": payload.get("language"),
    }


def _google_api_key() -> str:
    return (
        os.environ.get("GOOGLE_SPEECH_API_KEY")
        or os.environ.get("APSALES_GOOGLE_SPEECH_API_KEY")
        or os.environ.get("GOOGLE_CLOUD_API_KEY")
        or os.environ.get("APSALES_GOOGLE_CLOUD_API_KEY")
        # Same GCP key used for Vision / Places after Speech API is enabled.
        or os.environ.get("GOOGLE_CLOUD_VISION_API_KEY")
        or os.environ.get("APSALES_GOOGLE_VISION_API_KEY")
        or os.environ.get("GOOGLE_PLACES_API_KEY")
        or ""
    )


def _google_audio_config(path: Path) -> tuple[dict[str, Any], str]:
    """Return (RecognitionConfig fields, mime_hint) for WhatsApp-ish formats."""
    suffix = path.suffix.lower()
    lang = os.environ.get("APSALES_STT_LANGUAGE") or "en-US"
    base: dict[str, Any] = {
        "languageCode": lang,
        "enableAutomaticPunctuation": True,
    }
    # Optional only — alternativeLanguageCodes can return empty results on Opus notes.
    alts_raw = (os.environ.get("APSALES_STT_ALT_LANGS") or "").strip()
    if alts_raw:
        alts = [x.strip() for x in alts_raw.split(",") if x.strip()]
        if alts:
            base["alternativeLanguageCodes"] = alts[:3]

    model = (os.environ.get("APSALES_STT_GOOGLE_MODEL") or "").strip()
    if suffix in {".ogg", ".opus", ".oga"} or not suffix:
        # WhatsApp voice notes are almost always OGG/Opus @ 48k.
        # sampleRateHertz is required for OGG_OPUS or Google returns 400.
        # Prefer 16k first for short clips (better accuracy on Opus in practice).
        base["encoding"] = "OGG_OPUS"
        base["sampleRateHertz"] = int(os.environ.get("APSALES_STT_SAMPLE_RATE") or "16000")
        base["model"] = model or "default"
        return base, "audio/ogg"
    if suffix == ".wav":
        base["encoding"] = "LINEAR16"
        base["sampleRateHertz"] = int(os.environ.get("APSALES_STT_SAMPLE_RATE") or "16000")
        base["model"] = model or "latest_long"
        return base, "audio/wav"
    if suffix == ".flac":
        base["encoding"] = "FLAC"
        base["model"] = model or "latest_long"
        return base, "audio/flac"
    if suffix == ".mp3":
        base["encoding"] = "MP3"
        base["model"] = model or "latest_long"
        return base, "audio/mpeg"
    if suffix in {".webm"}:
        base["encoding"] = "WEBM_OPUS"
        base["sampleRateHertz"] = int(os.environ.get("APSALES_STT_SAMPLE_RATE") or "48000")
        base["model"] = model or "default"
        return base, "audio/webm"
    if suffix in {".m4a", ".mp4", ".aac"}:
        base["encoding"] = "MP3"
        base["model"] = model or "latest_long"
        return base, "audio/mp4"
    base["encoding"] = "OGG_OPUS"
    base["sampleRateHertz"] = 48000
    base["model"] = model or "default"
    return base, "audio/ogg"


def _google_transcribe(path: Path) -> dict[str, Any]:
    api_key = _google_api_key()
    if not api_key:
        return {"status": "failed", "error": "missing_GOOGLE_SPEECH_API_KEY"}

    import base64
    import urllib.request

    config, mime = _google_audio_config(path)
    raw = path.read_bytes()
    # Sync recognize soft-limit ~60s / ~10MB; refuse huge files early.
    if len(raw) > 10 * 1024 * 1024:
        return {"status": "failed", "error": "audio_too_large", "provider": "google"}

    content = base64.b64encode(raw).decode("ascii")
    body = json.dumps({"config": config, "audio": {"content": content}}).encode("utf-8")
    url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_key}"
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        detail = str(exc)[:200]
        # Retry alternate Opus rate if first rate is rejected/empty path.
        if config.get("encoding") == "OGG_OPUS":
            try:
                retry_cfg = dict(config)
                retry_cfg["sampleRateHertz"] = 48000 if config.get("sampleRateHertz") == 16000 else 16000
                retry_body = json.dumps({"config": retry_cfg, "audio": {"content": content}}).encode("utf-8")
                retry_req = urllib.request.Request(
                    url,
                    data=retry_body,
                    method="POST",
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(retry_req, timeout=60) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                    config = retry_cfg
            except Exception as retry_exc:
                return {
                    "status": "failed",
                    "error": type(exc).__name__,
                    "detail": detail,
                    "retry_error": type(retry_exc).__name__,
                }
        else:
            return {"status": "failed", "error": type(exc).__name__, "detail": detail}

    results = payload.get("results") or []
    if not results and config.get("encoding") == "OGG_OPUS":
        try:
            retry_cfg = dict(config)
            retry_cfg["sampleRateHertz"] = 48000 if config.get("sampleRateHertz") == 16000 else 16000
            # Drop alt langs on retry — they can zero-out Opus transcripts.
            retry_cfg.pop("alternativeLanguageCodes", None)
            retry_body = json.dumps({"config": retry_cfg, "audio": {"content": content}}).encode("utf-8")
            retry_req = urllib.request.Request(
                url,
                data=retry_body,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(retry_req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                config = retry_cfg
                results = payload.get("results") or []
        except Exception:
            pass
    if not results:
        return {"status": "failed", "error": "empty_transcript", "provider": "google"}
    parts: list[str] = []
    confs: list[float] = []
    for row in results:
        alt = (row.get("alternatives") or [{}])[0]
        t = str(alt.get("transcript") or "").strip()
        if t:
            parts.append(t)
        if alt.get("confidence") is not None:
            confs.append(float(alt.get("confidence") or 0.0))
    text = " ".join(parts).strip()
    conf = (sum(confs) / len(confs)) if confs else 0.8
    if not text:
        return {"status": "failed", "error": "empty_transcript", "provider": "google"}
    return {
        "status": "success",
        "provider": "google",
        "text": text[:2000],
        "confidence": conf if conf > 0 else 0.8,
        "mime_hint": mime,
        "encoding": config.get("encoding"),
    }


def _assemblyai_transcribe(path: Path) -> dict[str, Any]:
    api_key = os.environ.get("ASSEMBLYAI_API_KEY") or os.environ.get("APSALES_ASSEMBLYAI_API_KEY")
    if not api_key:
        return {"status": "failed", "error": "missing_ASSEMBLYAI_API_KEY"}
    import time
    import urllib.request

    upload_req = urllib.request.Request(
        "https://api.assemblyai.com/v2/upload",
        data=path.read_bytes(),
        method="POST",
        headers={"authorization": api_key, "content-type": "application/octet-stream"},
    )
    try:
        with urllib.request.urlopen(upload_req, timeout=60) as resp:
            upload_url = json.loads(resp.read().decode("utf-8")).get("upload_url")
    except Exception as exc:
        return {"status": "failed", "error": type(exc).__name__, "detail": str(exc)[:200]}
    if not upload_url:
        return {"status": "failed", "error": "upload_failed", "provider": "assemblyai"}

    create_body = json.dumps({"audio_url": upload_url, "language_detection": True}).encode()
    create_req = urllib.request.Request(
        "https://api.assemblyai.com/v2/transcript",
        data=create_body,
        method="POST",
        headers={"authorization": api_key, "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(create_req, timeout=60) as resp:
            tid = json.loads(resp.read().decode("utf-8")).get("id")
    except Exception as exc:
        return {"status": "failed", "error": type(exc).__name__, "detail": str(exc)[:200]}
    if not tid:
        return {"status": "failed", "error": "transcript_create_failed"}

    for _ in range(40):
        time.sleep(1.5)
        poll_req = urllib.request.Request(
            f"https://api.assemblyai.com/v2/transcript/{tid}",
            headers={"authorization": api_key},
        )
        try:
            with urllib.request.urlopen(poll_req, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            return {"status": "failed", "error": type(exc).__name__, "detail": str(exc)[:200]}
        status = payload.get("status")
        if status == "completed":
            text = str(payload.get("text") or "").strip()
            if not text:
                return {"status": "failed", "error": "empty_transcript", "provider": "assemblyai"}
            return {
                "status": "success",
                "provider": "assemblyai",
                "text": text[:2000],
                "confidence": float(payload.get("confidence") or 0.8),
                "language": payload.get("language_code"),
            }
        if status == "error":
            return {"status": "failed", "error": "assemblyai_error", "detail": str(payload.get("error"))[:200]}
    return {"status": "failed", "error": "timeout", "provider": "assemblyai"}


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        path = Path(str(payload.get("path") or "")).expanduser()
        if not path.is_file():
            print(json.dumps({"status": "failed", "error": "audio_not_found"}))
            return 0
        provider = _provider()
        if provider in {"", "none", "off", "disabled"}:
            print(
                json.dumps(
                    {
                        "status": "disabled",
                        "error": "stt_provider_unset",
                        "hint": "Set APSALES_STT_PROVIDER=openai|google|assemblyai after CEO vendor decision",
                    }
                )
            )
            return 0
        if provider in {"openai", "whisper"}:
            result = _openai_transcribe(path)
        elif provider in {"google", "gcp", "speech"}:
            result = _google_transcribe(path)
        elif provider in {"assemblyai", "assembly"}:
            result = _assemblyai_transcribe(path)
        else:
            result = {"status": "failed", "error": f"unknown_provider:{provider}"}
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": type(exc).__name__, "detail": str(exc)[:200]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
