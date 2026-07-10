"""Social platform session state (Facebook / Instagram / X).

One-time login via scripts/apsales-social-login.py saves Playwright persistent
context under memory/customer_gateway/social_sessions/{platform}/.
"""

from __future__ import annotations

import json
import os
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SESSIONS_ROOT = ROOT / "memory" / "customer_gateway" / "social_sessions"

PLATFORMS = ("facebook", "instagram", "x")
SESSION_FILENAME = "session_state.json"
BROWSER_DATA_DIR = "browser_data"

PLATFORM_LABELS = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "x": "X",
}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def sessions_root() -> Path:
    env = os.getenv("APSALES_SOCIAL_SESSIONS_DIR", "").strip()
    if env:
        return Path(env).expanduser()
    return DEFAULT_SESSIONS_ROOT


def session_dir(platform: str) -> Path:
    key = _normalize_platform(platform)
    return sessions_root() / key


def browser_data_dir(platform: str) -> Path:
    return session_dir(platform) / BROWSER_DATA_DIR


def session_state_path(platform: str) -> Path:
    return session_dir(platform) / SESSION_FILENAME


def _normalize_platform(platform: str) -> str:
    key = (platform or "").strip().lower()
    if key in ("twitter", "x"):
        return "x"
    if key not in PLATFORMS:
        raise ValueError(f"Unknown platform: {platform}")
    return key


def default_session(platform: str) -> dict[str, Any]:
    return {
        "platform": _normalize_platform(platform),
        "connected": False,
        "method": "",  # browser | api
        "logged_in_at": None,
        "last_verified_at": None,
        "account_label": "",
        "notes": "",
        "created_at": _now(),
    }


def ensure_session_dir(platform: str) -> Path:
    directory = session_dir(platform)
    directory.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(directory, stat.S_IRWXU)  # 700
    except OSError:
        pass
    return directory


def _secure_file(path: Path) -> None:
    try:
        if path.is_file():
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 600
    except OSError:
        pass


def load_session(platform: str) -> dict[str, Any]:
    ensure_session_dir(platform)
    path = session_state_path(platform)
    if not path.is_file():
        return default_session(platform)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default_session(platform)
    merged = default_session(platform)
    if isinstance(data, dict):
        merged.update(data)
    return merged


def save_session(platform: str, state: dict[str, Any]) -> None:
    ensure_session_dir(platform)
    state = dict(state)
    state["platform"] = _normalize_platform(platform)
    state["updated_at"] = _now()
    path = session_state_path(platform)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    _secure_file(path)


def mark_connected(
    platform: str,
    *,
    method: str = "browser",
    account_label: str = "",
    notes: str = "",
) -> dict[str, Any]:
    state = load_session(platform)
    state["connected"] = True
    state["method"] = method
    state["logged_in_at"] = state.get("logged_in_at") or _now()
    state["last_verified_at"] = _now()
    if account_label:
        state["account_label"] = account_label
    if notes:
        state["notes"] = notes
    save_session(platform, state)
    return state


def mark_disconnected(platform: str, *, reason: str = "") -> dict[str, Any]:
    state = load_session(platform)
    state["connected"] = False
    state["last_verified_at"] = _now()
    if reason:
        state["notes"] = reason
    save_session(platform, state)
    return state


def has_browser_data(platform: str) -> bool:
    data_dir = browser_data_dir(platform)
    if not data_dir.is_dir():
        return False
    return any(data_dir.iterdir())


def api_ready(platform: str) -> bool:
    """True when official API tokens are configured."""
    key = _normalize_platform(platform)
    if key == "facebook":
        return bool(
            os.getenv("META_PAGE_ACCESS_TOKEN", "").strip()
            and os.getenv("META_PAGE_ID", "").strip()
        )
    if key == "instagram":
        return bool(
            os.getenv("META_PAGE_ACCESS_TOKEN", "").strip()
            and os.getenv("META_IG_USER_ID", "").strip()
        )
    if key == "x":
        return bool(os.getenv("X_API_BEARER_TOKEN", "").strip())
    return False


def is_logged_in(platform: str) -> bool:
    """Session valid if API tokens exist OR browser session marked connected."""
    if api_ready(platform):
        return True
    state = load_session(platform)
    if not state.get("connected"):
        return False
    return has_browser_data(platform)


def session_status(platform: str) -> dict[str, Any]:
    key = _normalize_platform(platform)
    logged_in = is_logged_in(key)
    state = load_session(key)
    method = "api" if api_ready(key) else (state.get("method") or "browser")
    return {
        "platform": key,
        "label": PLATFORM_LABELS.get(key, key),
        "logged_in": logged_in,
        "status": "ready" if logged_in else "needs_login",
        "status_label": "✅ 已登录" if logged_in else "❌ 需子敬登录一次",
        "method": method if logged_in else "",
        "account_label": state.get("account_label") or "",
        "logged_in_at": state.get("logged_in_at"),
        "last_verified_at": state.get("last_verified_at"),
        "has_browser_data": has_browser_data(key),
        "api_configured": api_ready(key),
    }


def get_all_session_status() -> dict[str, Any]:
    platforms = {p: session_status(p) for p in PLATFORMS}
    any_ready = any(p["logged_in"] for p in platforms.values())
    return {
        "updated_at": _now(),
        "any_ready": any_ready,
        "platforms": platforms,
    }


def export_session_bundle(platform: str, dest: Path) -> Path:
    """Pack browser session for upload to production (local login flow)."""
    import shutil
    import tempfile

    key = _normalize_platform(platform)
    src = session_dir(key)
    if not src.is_dir():
        raise FileNotFoundError(f"No session directory for {key}")
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix == ".tar.gz" or str(dest).endswith(".tar.gz"):
        import tarfile
        with tarfile.open(dest, "w:gz") as tar:
            tar.add(src, arcname=key)
        return dest
    if dest.is_dir():
        shutil.copytree(src, dest / key, dirs_exist_ok=True)
        return dest
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    import tarfile
    with tarfile.open(tmp_path, "w:gz") as tar:
        tar.add(src, arcname=key)
    shutil.move(str(tmp_path), dest)
    return dest
