"""Single Playwright browser session manager — prevents profile lock fights."""

from __future__ import annotations

import json
import os
import subprocess
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from customer_gateway.social_session import browser_data_dir, sessions_root


class SocialBrowserSessionBusy(Exception):
    """Another process holds the Facebook/IG/X browser profile."""

    def __init__(self, message: str, *, lock_info: dict[str, Any] | None = None):
        super().__init__(message)
        self.lock_info = lock_info or {}


STALE_LOCK_SECONDS = 30 * 60


def _lock_path() -> Path:
    root = sessions_root()
    root.mkdir(parents=True, exist_ok=True)
    return root / ".browser.lock"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _headless() -> bool:
    return os.getenv("APSALES_SOCIAL_BROWSER_HEADLESS", "1").strip() != "0"


def _is_pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _read_lock() -> dict[str, Any] | None:
    path = _lock_path()
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, OSError):
        return None


def _lock_age_seconds(lock: dict[str, Any]) -> float:
    ts = lock.get("timestamp") or lock.get("acquired_at")
    if isinstance(ts, (int, float)):
        return max(0.0, time.time() - float(ts))
    if isinstance(ts, str):
        for fmt in ("%Y-%m-%d %H:%M:%S UTC", "%Y-%m-%dT%H:%M:%S"):
            try:
                dt = datetime.strptime(ts.replace("+0000", "").strip(), fmt)
                dt = dt.replace(tzinfo=timezone.utc)
                return max(0.0, time.time() - dt.timestamp())
            except ValueError:
                continue
    return STALE_LOCK_SECONDS + 1


def is_lock_stale(lock: dict[str, Any] | None = None) -> bool:
    lock = lock or _read_lock()
    if not lock:
        return False
    pid = int(lock.get("pid") or 0)
    if pid and not _is_pid_alive(pid):
        return True
    return _lock_age_seconds(lock) > STALE_LOCK_SECONDS


def clear_stale_lock(*, force: bool = False) -> bool:
    """Remove lock file if stale/dead PID. Returns True if cleared."""
    lock = _read_lock()
    if not lock:
        return False
    if force or is_lock_stale(lock):
        try:
            _lock_path().unlink(missing_ok=True)
        except OSError:
            return False
        return True
    return False


_lock_token: str | None = None


def _write_lock(platform: str) -> None:
    global _lock_token
    _lock_token = uuid.uuid4().hex[:16]
    payload = {
        "pid": os.getpid(),
        "platform": platform,
        "timestamp": time.time(),
        "acquired_at": _now_iso(),
        "hostname": os.uname().nodename,
        "token": _lock_token,
    }
    path = _lock_path()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _release_lock_file() -> None:
    global _lock_token
    lock = _read_lock()
    if not lock:
        _lock_token = None
        return
    token = lock.get("token")
    if _lock_token and token == _lock_token:
        try:
            _lock_path().unlink(missing_ok=True)
        except OSError:
            pass
    elif int(lock.get("pid") or 0) == os.getpid():
        try:
            _lock_path().unlink(missing_ok=True)
        except OSError:
            pass
    _lock_token = None


def _acquire_lock(platform: str) -> None:
    if _lock_token:
        return
    clear_stale_lock()
    existing = _read_lock()
    if existing and int(existing.get("pid") or 0) != os.getpid():
        if not is_lock_stale(existing):
            raise SocialBrowserSessionBusy(
                "浏览器会话被占用 — 子敬会自动排队/清锁，您无需手动关 Chrome",
                lock_info=existing,
            )
        clear_stale_lock(force=True)

    _write_lock(platform)


def _profile_dir(platform: str) -> Path:
    return browser_data_dir(platform)


def _find_profile_chrome_pids(platform: str) -> list[int]:
    """PIDs of Chrome/Chromium using this platform's persistent profile."""
    profile = str(_profile_dir(platform).resolve())
    pids: set[int] = set()
    try:
        out = subprocess.run(
            ["ps", "-ax", "-o", "pid=,command="],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        for line in (out.stdout or "").splitlines():
            line = line.strip()
            if not line or profile not in line:
                continue
            if "user-data-dir" not in line and "user_data_dir" not in line:
                continue
            try:
                pid = int(line.split(None, 1)[0])
                if pid != os.getpid():
                    pids.add(pid)
            except (ValueError, IndexError):
                continue
    except (OSError, subprocess.TimeoutExpired):
        pass
    return sorted(pids)


def _terminate_profile_browsers(platform: str, *, force: bool = False) -> list[int]:
    """Stop Chrome processes holding the Playwright profile (CEO should not do this manually)."""
    killed: list[int] = []
    for pid in _find_profile_chrome_pids(platform):
        if not force:
            lock = _read_lock()
            lock_pid = int((lock or {}).get("pid") or 0)
            if lock_pid and lock_pid == pid and not is_lock_stale(lock):
                continue
        try:
            os.kill(pid, 9 if force else 15)
            killed.append(pid)
        except OSError:
            continue
    if killed:
        time.sleep(1.5)
    return killed


def _launch_with_profile_recovery(platform: str) -> tuple[Any, Any, Any]:
    """Launch browser; auto-clear zombie Chrome holding the same profile."""
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            return _create_browser(platform)
        except Exception as exc:
            last_exc = exc
            msg = str(exc).lower()
            profile_busy = any(
                k in msg
                for k in (
                    "existing browser session",
                    "target page, context or browser has been closed",
                    "正在现有的浏览器会话",
                    "user data directory is already in use",
                    "singletonlock",
                )
            )
            if not profile_busy and attempt == 0:
                _terminate_profile_browsers(platform, force=False)
                continue
            if profile_busy or attempt < 2:
                clear_stale_lock(force=True)
                _terminate_profile_browsers(platform, force=True)
                time.sleep(2.0)
                continue
            break
    assert last_exc is not None
    raise SocialBrowserSessionBusy(
        "无法启动 Facebook 浏览器 — 子敬已尝试自动清锁/关僵尸 Chrome，请稍后再试",
        lock_info={"error": str(last_exc)[:200]},
    ) from last_exc


def _create_browser(platform: str) -> tuple[Any, Any, Any]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        from integrations.social_browser.platform_adapter import SocialBrowserError

        raise SocialBrowserError(
            "playwright not installed — pip install playwright && python -m playwright install chromium"
        ) from exc

    _INSTAGRAM_MOBILE_UA = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
        "Mobile/15E148 Safari/604.1"
    )

    data_dir = browser_data_dir(platform)
    data_dir.mkdir(parents=True, exist_ok=True)
    pw = sync_playwright().start()
    launch_kwargs: dict[str, Any] = {
        "user_data_dir": str(data_dir),
        "headless": _headless(),
        "args": ["--disable-blink-features=AutomationControlled"],
        "locale": "en-US",
    }
    if platform == "instagram":
        launch_kwargs.update(
            user_agent=_INSTAGRAM_MOBILE_UA,
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
        )
    else:
        launch_kwargs["viewport"] = {"width": 1280, "height": 900}
    context = pw.chromium.launch_persistent_context(**launch_kwargs)
    page = context.pages[0] if context.pages else context.new_page()
    return pw, context, page


@dataclass
class BrowserSession:
    platform: str
    playwright: Any
    context: Any
    page: Any

    def close(self) -> None:
        try:
            self.context.close()
        except Exception:
            pass
        try:
            self.playwright.stop()
        except Exception:
            pass


_active: BrowserSession | None = None
_lock_depth: int = 0


def get_active_session() -> BrowserSession | None:
    return _active


@contextmanager
def acquire_browser(platform: str) -> Iterator[BrowserSession]:
    """Acquire file lock + one headed/headless browser for sequential FB/IG/X work."""
    global _active, _lock_depth

    platform = (platform or "").strip().lower()
    if platform == "twitter":
        platform = "x"

    if _active is not None:
        if _active.platform != platform:
            raise SocialBrowserSessionBusy(
                f"已有 { _active.platform } 浏览器在运行，不能同时开 {platform}"
            )
        _lock_depth += 1
        try:
            yield _active
        finally:
            _lock_depth -= 1
        return

    clear_stale_lock()
    _acquire_lock(platform)
    _terminate_profile_browsers(platform, force=True)
    pw, context, page = _launch_with_profile_recovery(platform)
    _active = BrowserSession(platform=platform, playwright=pw, context=context, page=page)
    _lock_depth = 1
    try:
        yield _active
    finally:
        _lock_depth -= 1
        if _lock_depth <= 0:
            _active.close()
            _active = None
            _release_lock_file()


def release_browser() -> None:
    """Force-close active session (normally use acquire_browser context manager)."""
    global _active, _lock_depth
    if _active:
        _active.close()
        _active = None
    _lock_depth = 0
    _release_lock_file()


def release_context(pw: Any, context: Any) -> None:
    """Close browser opened via _launch_context (standalone, not acquire_browser)."""
    active = get_active_session()
    if active and active.context is context:
        return
    try:
        context.close()
    except Exception:
        pass
    try:
        pw.stop()
    except Exception:
        pass
    _release_lock_file()


def lock_status() -> dict[str, Any]:
    lock = _read_lock()
    return {
        "locked": bool(lock),
        "stale": is_lock_stale(lock) if lock else False,
        "lock": lock,
        "active_session": _active.platform if _active else None,
        "pid": os.getpid(),
    }
