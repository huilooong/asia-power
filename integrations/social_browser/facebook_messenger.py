"""Facebook Messenger — one-to-one friend DMs (CEO-approved, rate-limited)."""

from __future__ import annotations

import json
import os
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from integrations.social_browser.platform_adapter import (
    SocialBrowserError,
    _attach_images_facebook,
    _cleanup_temp_files,
    _download_images,
    _dismiss_facebook_overlays,
    verify_login,
)
from customer_gateway.outreach_copy import (
    build_dm_messages,
    copy_version_label,
    enforce_link_delays,
    link_gap_seconds,
    max_links_per_conversation,
)

ROOT = Path(__file__).resolve().parent.parent.parent
POLICY_FILE = ROOT / "config" / "apsales_social_engagement_policy.yaml"
DM_LOG_FILE = ROOT / "memory" / "customer_gateway" / "fb_friend_dm_log.jsonl"
DM_STATE_FILE = ROOT / "memory" / "customer_gateway" / "fb_friend_dm_state.json"

FRIENDS_LIST_URLS = (
    "https://www.facebook.com/friends/list",
    "https://www.facebook.com/friends",
)
MESSENGER_URL = "https://www.facebook.com/messages/"

# Legacy fallback — prefer config/apsales_outreach_copy.yaml dm_human_v2
GREETING_VARIANTS = (
    "Hi {name} — hope you're well!",
    "Hello {name}, hope all is well!",
)

BLOCK_PATTERNS = re.compile(
    r"can't message|cannot message|action blocked|temporarily blocked|"
    r"security check|confirm it's you|confirm it is you|captcha|"
    r"unusual activity|try again later|message request|"
    r"无法发送|暂时无法|安全检查|验证码|操作受限",
    re.I,
)


def _now_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_dm_policy() -> dict[str, Any]:
    policy = _load_yaml(POLICY_FILE)
    fb = (policy.get("platforms") or {}).get("facebook") or {}
    friend_dm = policy.get("friend_dm") or {}
    unlimited = 9999

    def _cap(val: Any, default: int = unlimited) -> int:
        if val is None:
            return default
        try:
            n = int(val)
            return default if n >= unlimited else n
        except (TypeError, ValueError):
            return default

    return {
        "max_per_run": _cap(friend_dm.get("max_per_run") or fb.get("max_dms_per_run"), 5),
        "max_per_day": _cap(friend_dm.get("max_per_day") or fb.get("max_dms_per_day")),
        "delay_min": float(friend_dm.get("delay_seconds_min") or 30),
        "delay_max": float(friend_dm.get("delay_seconds_max") or 90),
        "enabled": friend_dm.get("enabled", True),
        "platform_block_only": str(policy.get("stop_condition") or "") == "platform_block_only",
    }


def _human_delay(min_s: float = 1.0, max_s: float = 2.5) -> None:
    time.sleep(random.uniform(min_s, max_s))


def _between_send_delay(policy: dict[str, Any]) -> None:
    lo = max(30.0, float(policy.get("delay_min", 30)))
    hi = max(lo, float(policy.get("delay_max", 90)))
    time.sleep(random.uniform(lo, hi))


def _record_dm_block(message: str = "") -> None:
    try:
        from customer_gateway.fb_platform_limits import record_platform_block

        record_platform_block("dm", message)
    except Exception:
        pass


def _dm_paused() -> bool:
    try:
        from customer_gateway.fb_platform_limits import is_action_paused

        paused, _ = is_action_paused("dm")
        return paused
    except Exception:
        return False


def _append_log(record: dict[str, Any]) -> None:
    DM_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DM_LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def _load_log_records() -> list[dict[str, Any]]:
    if not DM_LOG_FILE.is_file():
        return []
    records: list[dict[str, Any]] = []
    for line in DM_LOG_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            if isinstance(row, dict):
                records.append(row)
        except json.JSONDecodeError:
            continue
    return records


def get_messaged_friend_ids(*, include_failed: bool = False) -> set[str]:
    latest: dict[str, str] = {}
    for row in _load_log_records():
        fid = str(row.get("friend_id") or row.get("slug") or "").strip().lower()
        if not fid:
            continue
        latest[fid] = str(row.get("status") or "").lower()
    ids: set[str] = set()
    for fid, status in latest.items():
        if status == "sent":
            ids.add(fid)
        elif include_failed and status in ("sent", "failed", "blocked"):
            ids.add(fid)
    return ids


def count_sent_today() -> int:
    today = _today()
    count = 0
    for row in _load_log_records():
        if str(row.get("status") or "").lower() != "sent":
            continue
        sent_at = str(row.get("sent_at") or "")
        if sent_at.startswith(today):
            count += 1
    return count


def build_message(name: str, *, variant: int | None = None) -> str:
    """Single-message preview (legacy). Live sends use build_dm_messages + send_dm_staggered."""
    msgs = build_dm_messages(name=name)
    if msgs:
        return "\n---\n".join(m.get("text", "") for m in msgs if m.get("text"))
    first = (name or "friend").strip().split()[0] if name else "friend"
    first = first[:40] or "friend"
    idx = variant if variant is not None else 0
    return GREETING_VARIANTS[idx % len(GREETING_VARIANTS)].format(name=first)


def build_staggered_dm(name: str = "") -> list[dict[str, Any]]:
    """Human v2 DM flow with 120s gaps between link drops."""
    return enforce_link_delays(build_dm_messages(name=name))


def get_dm_stats() -> dict[str, Any]:
    policy = load_dm_policy()
    sent_today = count_sent_today()
    total_sent = sum(1 for r in _load_log_records() if str(r.get("status")).lower() == "sent")
    if policy.get("platform_block_only"):
        remaining = 9999
    else:
        remaining = max(0, policy["max_per_day"] - sent_today)
    return {
        "sent_today": sent_today,
        "remaining_today": remaining,
        "max_per_day": policy["max_per_day"],
        "max_per_run": policy["max_per_run"],
        "total_sent": total_sent,
        "log_file": str(DM_LOG_FILE.relative_to(ROOT)),
        "platform_block_only": policy.get("platform_block_only", False),
    }


def _save_state(state: dict[str, Any]) -> None:
    DM_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    DM_STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _update_state(**kwargs: Any) -> None:
    state: dict[str, Any] = {}
    if DM_STATE_FILE.is_file():
        try:
            raw = json.loads(DM_STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                state = raw
        except (json.JSONDecodeError, OSError):
            pass
    state.update(kwargs)
    state["updated_at"] = _now_str()
    _save_state(state)


def _detect_block_or_captcha(page) -> str | None:
    try:
        body = page.inner_text("body", timeout=5000)[:8000]
    except Exception:
        body = ""
    if BLOCK_PATTERNS.search(body):
        return "blocked_or_captcha"
    try:
        if page.locator('iframe[src*="captcha"], [id*="captcha"], img[alt*="captcha"]').count():
            return "captcha_detected"
    except Exception:
        pass
    return None


def _extract_friends_from_page(page, *, limit: int = 200) -> list[dict[str, str]]:
    script = f"""
    () => {{
      const friends = [];
      const seen = new Set();
      const anchors = document.querySelectorAll('a[href*="facebook.com"]');
      for (const a of anchors) {{
        let href = a.href || '';
        if (!href) continue;
        href = href.split('?')[0].split('#')[0];
        const name = (a.innerText || a.getAttribute('aria-label') || '').trim();
        if (!name || name.length < 2 || name.length > 80) continue;
        if (/^(message|messages|add friend|confirm|delete|mutual|see all|see more)$/i.test(name)) continue;
        if (/共同好友|的头像|mutual friend/i.test(name)) continue;
        if (href.includes('/friends') || href.includes('/groups/') || href.includes('/watch')) continue;
        if (href.includes('/photo') || href.includes('/videos/') || href.includes('/reel')) continue;
        if (href.includes('/messages')) continue;
        let friendId = '';
        let slug = '';
        const idMatch = href.match(/profile\\.php\\?id=(\\d+)/);
        if (idMatch) {{
          friendId = idMatch[1];
          slug = friendId;
        }} else {{
          const slugMatch = href.match(/facebook\\.com\\/([^/?]+)/);
          if (!slugMatch) continue;
          slug = slugMatch[1].toLowerCase();
          if (['www', 'profile.php', 'people', 'pages', 'marketplace', 'gaming', 'help', 'privacy'].includes(slug)) continue;
          friendId = slug;
        }}
        const key = slug.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        friends.push({{ name, url: href, slug: key, friend_id: friendId }});
        if (friends.length >= {limit}) break;
      }}
      return friends;
    }}
    """
    try:
        raw = page.evaluate(script)
        return [f for f in (raw or []) if isinstance(f, dict) and f.get("friend_id")]
    except Exception:
        return []


def list_friends(*, limit: int = 200, page=None, context=None) -> dict[str, Any]:
    """Return friend list from logged-in Facebook session."""
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return list_friends(limit=limit, page=sess.page, context=sess.context)

    friends: list[dict[str, str]] = []
    try:
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=120_000)
        _human_delay(2.0, 3.0)
        _dismiss_facebook_overlays(page)
        if not verify_login("facebook", page=page, context=context, close=False):
            return {"ok": False, "error": "not_logged_in", "friends": []}

        loaded = False
        for url in FRIENDS_LIST_URLS:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=120_000)
                _human_delay(2.0, 3.5)
                _dismiss_facebook_overlays(page)
                loaded = True
                break
            except Exception:
                continue
        if not loaded:
            return {"ok": False, "error": "friends_page_unreachable", "friends": []}

        block = _detect_block_or_captcha(page)
        if block:
            return {"ok": False, "error": block, "friends": []}

        for _ in range(8):
            batch = _extract_friends_from_page(page, limit=limit)
            for f in batch:
                fid = str(f.get("friend_id") or "").lower()
                if fid and not any(x.get("friend_id") == fid for x in friends):
                    friends.append(f)
            if len(friends) >= limit:
                break
            page.mouse.wheel(0, 1200)
            _human_delay(1.2, 2.0)

        friends = friends[:limit]
        return {"ok": True, "friends": friends, "count": len(friends)}
    except SocialBrowserError as exc:
        return {"ok": False, "error": str(exc), "friends": []}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "friends": []}


def _find_compose_box(page):
    selectors = (
        '[aria-label="Message"][contenteditable="true"]',
        '[aria-label="Thread composer message input"]',
        '[aria-label="消息"][contenteditable="true"]',
        '[data-testid="mwcomposer"] div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'p[contenteditable="true"]',
    )
    for sel in selectors:
        loc = page.locator(sel).last
        try:
            if loc.count() and loc.is_visible(timeout=2000):
                return loc
        except Exception:
            continue
    return None


def _open_messenger_via_search(page, friend: dict[str, str]) -> bool:
    """New message → search friend name → open thread."""
    name = (friend.get("name") or "").strip()
    if not name or len(name) < 2:
        return False
    search_name = name.split("共同好友")[-1].replace("的头像", "").strip()
    if len(search_name) < 2:
        search_name = name

    try:
        page.goto("https://www.facebook.com/messages/new", wait_until="domcontentloaded", timeout=90_000)
        _human_delay(2.0, 3.0)
        _dismiss_facebook_overlays(page)
    except Exception:
        return False

    search_selectors = (
        'input[aria-label="Search for people and groups"]',
        'input[placeholder*="Search"]',
        'input[aria-label*="Search"]',
        'input[type="search"]',
        '[role="combobox"] input',
        'div[contenteditable="true"][role="combobox"]',
    )
    search_box = None
    for sel in search_selectors:
        loc = page.locator(sel).first
        try:
            if loc.count() and loc.is_visible(timeout=2000):
                search_box = loc
                break
        except Exception:
            continue
    if search_box is None:
        return False

    try:
        search_box.click(timeout=5000)
        _human_delay(0.4, 0.8)
        search_box.fill(search_name[:60])
        _human_delay(1.5, 2.5)
    except Exception:
        try:
            page.keyboard.type(search_name[:60], delay=50)
            _human_delay(1.5, 2.5)
        except Exception:
            return False

    slug = (friend.get("slug") or friend.get("friend_id") or "").lower()
    result_selectors = (
        f'a[href*="{slug}"]',
        f'div[role="option"]:has-text("{search_name.split()[0]}")',
        f'div[role="listbox"] div[role="option"]',
        'ul li div[role="button"]',
    )
    for sel in result_selectors:
        try:
            opt = page.locator(sel).first
            if opt.count() and opt.is_visible(timeout=3000):
                opt.click(timeout=8000)
                _human_delay(2.0, 3.0)
                compose = _find_compose_box(page)
                if compose:
                    return True
        except Exception:
            continue
    return False


def _open_messenger_thread(page, friend: dict[str, str]) -> bool:
    slug = friend.get("slug") or friend.get("friend_id") or ""
    profile_url = friend.get("url") or f"https://www.facebook.com/{slug}"

    if _open_messenger_via_search(page, friend):
        return True

    for url in (
        f"https://www.facebook.com/messages/t/{slug}",
        profile_url,
    ):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=90_000)
            _human_delay(2.0, 3.5)
            _dismiss_facebook_overlays(page)
        except Exception:
            continue

        block = _detect_block_or_captcha(page)
        if block:
            raise SocialBrowserError(block)

        if "/messages" not in page.url and "messages/t" not in page.url:
            for sel in (
                '[aria-label="Message"][role="button"]',
                '[aria-label="Message"]',
                '[aria-label="发消息"][role="button"]',
                '[aria-label="发消息"]',
                'div[role="button"]:has-text("Message")',
                'span:has-text("Message")',
            ):
                btn = page.locator(sel).first
                try:
                    if btn.count() and btn.is_visible(timeout=2000):
                        btn.click(timeout=10_000)
                        _human_delay(2.5, 4.0)
                        break
                except Exception:
                    continue

        compose = _find_compose_box(page)
        if compose:
            return True

    return False


def _click_send(page) -> bool:
    for sel in (
        '[aria-label="Send"][role="button"]',
        '[aria-label="Send"]',
        '[aria-label="Press enter to send"]',
        '[aria-label="发送"][role="button"]',
        '[aria-label="发送"]',
        'div[aria-label="Send"]',
    ):
        btn = page.locator(sel).first
        try:
            if btn.count() and btn.is_visible(timeout=2000):
                btn.click(timeout=8000)
                _human_delay(1.5, 2.5)
                return True
        except Exception:
            continue
    page.keyboard.press("Enter")
    _human_delay(1.5, 2.5)
    return True


def _send_in_compose(page, text: str, *, image_paths: list | None = None) -> bool:
    compose = _find_compose_box(page)
    if compose is None:
        return False
    compose.click(timeout=8000)
    _human_delay(0.5, 1.0)

    local_paths = list(image_paths or [])
    if local_paths:
        attached = _attach_images_facebook(page, local_paths)
        if not attached:
            return False
        _human_delay(1.0, 2.0)
        compose = _find_compose_box(page) or compose
        compose.click(timeout=8000)
        _human_delay(0.3, 0.6)

    compose.fill(text)
    _human_delay(0.8, 1.5)
    return _click_send(page)


def send_dm_staggered(
    page,
    friend: dict[str, str],
    messages_with_delays: list[dict[str, Any]],
) -> dict[str, Any]:
    """Send multi-message DM — 120s min between messages that contain links."""
    name = friend.get("name") or "friend"
    friend_id = str(friend.get("friend_id") or friend.get("slug") or "")
    messages = enforce_link_delays(list(messages_with_delays or []))
    if not messages:
        return {"ok": False, "status": "failed", "error": "empty_messages", "friend_id": friend_id, "name": name}

    link_sent = 0
    max_links = max_links_per_conversation()
    sent_messages: list[dict[str, Any]] = []
    temp_files: list = []

    try:
        block = _detect_block_or_captcha(page)
        if block:
            return {"ok": False, "status": "blocked", "error": block, "friend_id": friend_id, "name": name}

        if not _open_messenger_thread(page, friend):
            return {"ok": False, "status": "failed", "error": "compose_not_found", "friend_id": friend_id, "name": name}

        for i, msg in enumerate(messages):
            if msg.get("optional") and link_sent >= max_links:
                continue
            text = str(msg.get("text") or "").strip()
            if not text:
                continue
            has_link = bool(msg.get("has_link"))
            if has_link and link_sent >= max_links:
                continue
            if i > 0:
                delay = int(msg.get("delay_after") or 0)
                if has_link and delay < link_gap_seconds():
                    delay = link_gap_seconds()
                if delay > 0:
                    time.sleep(delay)
            if has_link:
                link_sent += 1

            image_urls = msg.get("image_urls") or []
            local_paths = _download_images(image_urls, max_images=1) if image_urls else []
            temp_files.extend(local_paths)

            block = _detect_block_or_captcha(page)
            if block:
                return {
                    "ok": len(sent_messages) > 0,
                    "status": "blocked",
                    "error": block,
                    "friend_id": friend_id,
                    "name": name,
                    "messages_sent": len(sent_messages),
                }

            sent = _send_in_compose(page, text, image_paths=local_paths or None)
            if not sent:
                return {
                    "ok": len(sent_messages) > 0,
                    "status": "failed",
                    "error": "send_failed",
                    "friend_id": friend_id,
                    "name": name,
                    "messages_sent": len(sent_messages),
                }
            sent_messages.append({"text": text[:120], "has_link": has_link, "images": len(local_paths)})

        return {
            "ok": True,
            "status": "sent",
            "friend_id": friend_id,
            "name": name,
            "thread_url": page.url,
            "messages_sent": len(sent_messages),
            "message_steps": sent_messages,
        }
    except SocialBrowserError as exc:
        return {"ok": False, "status": "blocked", "error": str(exc), "friend_id": friend_id, "name": name}
    except Exception as exc:
        err = str(exc).lower()
        if any(k in err for k in ("rate", "limit", "blocked", "captcha")):
            return {"ok": False, "status": "blocked", "error": str(exc)[:200], "friend_id": friend_id, "name": name}
        return {"ok": False, "status": "failed", "error": str(exc)[:200], "friend_id": friend_id, "name": name}
    finally:
        _cleanup_temp_files(temp_files)


def send_message_to_friend(page, friend: dict[str, str], message_text: str) -> dict[str, Any]:
    """Send one DM to a friend using an open browser page."""
    name = friend.get("name") or "friend"
    friend_id = str(friend.get("friend_id") or friend.get("slug") or "")
    try:
        block = _detect_block_or_captcha(page)
        if block:
            return {"ok": False, "status": "blocked", "error": block, "friend_id": friend_id, "name": name}

        if not _open_messenger_thread(page, friend):
            return {"ok": False, "status": "failed", "error": "compose_not_found", "friend_id": friend_id, "name": name}

        block = _detect_block_or_captcha(page)
        if block:
            return {"ok": False, "status": "blocked", "error": block, "friend_id": friend_id, "name": name}

        sent = _send_in_compose(page, message_text)
        if not sent:
            return {"ok": False, "status": "failed", "error": "send_failed", "friend_id": friend_id, "name": name}

        return {
            "ok": True,
            "status": "sent",
            "friend_id": friend_id,
            "name": name,
            "thread_url": page.url,
        }
    except SocialBrowserError as exc:
        return {"ok": False, "status": "blocked", "error": str(exc), "friend_id": friend_id, "name": name}
    except Exception as exc:
        err = str(exc).lower()
        if any(k in err for k in ("rate", "limit", "blocked", "captcha")):
            return {"ok": False, "status": "blocked", "error": str(exc)[:200], "friend_id": friend_id, "name": name}
        return {"ok": False, "status": "failed", "error": str(exc)[:200], "friend_id": friend_id, "name": name}


def get_eligible_friends(*, limit: int = 200, page=None, context=None) -> dict[str, Any]:
    """Friends not yet messaged, respecting daily cap unless probe mode."""
    policy = load_dm_policy()
    sent_today = count_sent_today()
    if policy.get("platform_block_only"):
        remaining_today = 9999
    else:
        remaining_today = max(0, policy["max_per_day"] - sent_today)
    if _dm_paused():
        return {
            "ok": False,
            "error": "platform_block_dm",
            "eligible": [],
            "already_messaged": len(get_messaged_friend_ids()),
            "sent_today": sent_today,
            "remaining_today": 0,
        }
    already = get_messaged_friend_ids()

    listed = list_friends(limit=limit, page=page, context=context)
    if not listed.get("ok"):
        return {
            "ok": False,
            "error": listed.get("error"),
            "eligible": [],
            "already_messaged": len(already),
            "sent_today": sent_today,
            "remaining_today": remaining_today,
        }

    eligible = []
    for f in listed.get("friends") or []:
        fid = str(f.get("friend_id") or f.get("slug") or "").lower()
        if fid and fid not in already:
            eligible.append(f)

    return {
        "ok": True,
        "eligible": eligible,
        "eligible_count": len(eligible),
        "total_friends": listed.get("count", 0),
        "already_messaged": len(already),
        "sent_today": sent_today,
        "remaining_today": remaining_today,
        "max_per_run": policy["max_per_run"],
        "max_per_day": policy["max_per_day"],
    }


def send_friend_dms(
    *,
    max_send: int | None = None,
    dry_run: bool = False,
    page=None,
    context=None,
) -> dict[str, Any]:
    """Send up to max_send DMs to eligible friends (one browser session)."""
    policy = load_dm_policy()
    if not policy.get("enabled", True):
        return {"ok": False, "error": "friend_dm_disabled", "sent": 0}

    run_limit = max_send if max_send is not None else policy["max_per_run"]
    if not policy.get("platform_block_only"):
        run_limit = max(1, min(run_limit, policy["max_per_run"]))
    else:
        run_limit = max(1, run_limit)

    sent_today = count_sent_today()
    if _dm_paused():
        return {
            "ok": False,
            "error": "platform_block_dm",
            "sent": 0,
            "sent_today": sent_today,
            "blocked": True,
        }
    if policy.get("platform_block_only"):
        remaining_today = 9999
    else:
        remaining_today = max(0, policy["max_per_day"] - sent_today)
        if remaining_today <= 0:
            return {
                "ok": False,
                "error": "daily_cap_reached",
                "sent": 0,
                "sent_today": sent_today,
                "remaining_today": 0,
                "message": f"今日已达上限 {policy['max_per_day']} 条",
            }

    actual_limit = min(run_limit, remaining_today) if not policy.get("platform_block_only") else run_limit

    if page is None and not dry_run:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return send_friend_dms(
                max_send=max_send,
                dry_run=dry_run,
                page=sess.page,
                context=sess.context,
            )

    eligible_info = get_eligible_friends(limit=300, page=page, context=context)
    if not eligible_info.get("ok"):
        return {"ok": False, "error": eligible_info.get("error"), "sent": 0}

    eligible = eligible_info.get("eligible") or []
    to_send = eligible[:actual_limit]

    if dry_run:
        sample_msgs = build_staggered_dm(to_send[0]["name"]) if to_send else build_staggered_dm("Friend")
        sample_msg = sample_msgs[0].get("text", "") if sample_msgs else build_message("Friend")
        return {
            "ok": True,
            "dry_run": True,
            "would_send": len(to_send),
            "eligible_count": eligible_info.get("eligible_count", 0),
            "already_messaged": eligible_info.get("already_messaged", 0),
            "sent_today": sent_today,
            "remaining_today": remaining_today,
            "max_per_run": policy["max_per_run"],
            "max_per_day": policy["max_per_day"],
            "friends_preview": [
                {"friend_id": f.get("friend_id"), "name": f.get("name")} for f in to_send[:10]
            ],
            "message_preview": sample_msg,
            "message_sequence": sample_msgs,
            "copy_version": copy_version_label("dm"),
            "link_gap_seconds": link_gap_seconds(),
        }

    if not to_send:
        return {
            "ok": True,
            "sent": 0,
            "failed": 0,
            "message": "没有待发送的好友（可能已全部发过）",
            "eligible_count": 0,
        }

    sent = 0
    failed = 0
    blocked = False
    results: list[dict[str, Any]] = []
    last_message = ""

    try:
        page.goto(MESSENGER_URL, wait_until="domcontentloaded", timeout=120_000)
        _human_delay(2.0, 3.0)
        _dismiss_facebook_overlays(page)
        if not verify_login("facebook", page=page, context=context, close=False):
            page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=120_000)
            _human_delay(2.0, 3.0)
            if not verify_login("facebook", page=page, context=context, close=False):
                return {"ok": False, "error": "not_logged_in", "sent": 0}

        block = _detect_block_or_captcha(page)
        if block:
            _record_dm_block(block)
            return {"ok": False, "error": block, "sent": 0, "blocked": True}

        for i, friend in enumerate(to_send):
            dm_sequence = build_staggered_dm(friend.get("name") or "friend")
            last_message = dm_sequence[0].get("text", "") if dm_sequence else build_message(friend.get("name") or "friend")
            result = send_dm_staggered(page, friend, dm_sequence)

            log_row = {
                "friend_id": result.get("friend_id") or friend.get("friend_id"),
                "name": result.get("name") or friend.get("name"),
                "sent_at": _now_str(),
                "status": result.get("status") or ("sent" if result.get("ok") else "failed"),
                "error": result.get("error"),
                "thread_url": result.get("thread_url"),
                "message_preview": last_message[:120],
                "messages_sent": result.get("messages_sent", 1),
                "copy_version": copy_version_label("dm"),
            }
            _append_log(log_row)
            results.append(log_row)

            if result.get("ok"):
                sent += 1
            else:
                failed += 1
                if result.get("status") == "blocked" or result.get("error") in (
                    "blocked_or_captcha",
                    "captcha_detected",
                ):
                    blocked = True
                    _record_dm_block(str(result.get("error") or "blocked"))
                    break

            if i < len(to_send) - 1 and not blocked:
                _between_send_delay(policy)

        _update_state(
            last_run_at=_now_str(),
            last_sent=sent,
            last_failed=failed,
            sent_today=count_sent_today(),
            blocked=blocked,
        )

        return {
            "ok": not blocked or sent > 0,
            "sent": sent,
            "failed": failed,
            "blocked": blocked,
            "results": results,
            "message_used": last_message,
            "sent_today": count_sent_today(),
            "remaining_today": max(0, policy["max_per_day"] - count_sent_today()),
            "eligible_remaining": max(0, eligible_info.get("eligible_count", 0) - sent),
        }
    except SocialBrowserError as exc:
        _record_dm_block(str(exc))
        return {"ok": False, "error": str(exc), "sent": sent, "failed": failed, "blocked": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "sent": sent, "failed": failed}
