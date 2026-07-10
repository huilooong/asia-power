"""Facebook friend-request helpers (accept only — no mass DM)."""

from __future__ import annotations

import os
import random
import time
from typing import Any

from integrations.social_browser.platform_adapter import (
    SocialBrowserError,
    _dismiss_facebook_overlays,
    verify_login,
)

REQUESTS_URLS = (
    "https://www.facebook.com/friends/requests",
    "https://www.facebook.com/friends/center/requests/",
)

ACCEPT_SELECTORS = (
    '[aria-label="Confirm"][role="button"]',
    '[aria-label="Confirm"]',
    '[aria-label="确认"][role="button"]',
    '[aria-label="确认"]',
    'div[role="button"]:has-text("Confirm")',
    'div[role="button"]:has-text("确认")',
    'span:has-text("Confirm")',
    'span:has-text("确认")',
)


def _human_delay(min_s: float = 1.2, max_s: float = 2.8) -> None:
    time.sleep(random.uniform(min_s, max_s))


def _max_per_run() -> int:
    try:
        return max(1, min(20, int(os.getenv("APSALES_FB_ACCEPT_MAX", "20"))))
    except ValueError:
        return 20


def _find_accept_buttons(page):
    seen = set()
    buttons = []
    for sel in ACCEPT_SELECTORS:
        try:
            for btn in page.locator(sel).all():
                try:
                    if not btn.is_visible(timeout=500):
                        continue
                    key = btn.evaluate(
                        "el => el.outerHTML.slice(0, 120)"
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    buttons.append(btn)
                except Exception:
                    continue
        except Exception:
            continue
    return buttons


def accept_friend_requests(
    *,
    max_accept: int | None = None,
    page=None,
    context=None,
) -> dict[str, Any]:
    """Accept visible pending friend requests with human-paced clicks."""
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return accept_friend_requests(
                max_accept=max_accept,
                page=sess.page,
                context=sess.context,
            )

    limit = max_accept if max_accept is not None else _max_per_run()
    limit = max(1, min(20, limit))

    accepted = 0
    errors: list[str] = []

    try:
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=120_000)
        time.sleep(2)
        _dismiss_facebook_overlays(page)
        if not verify_login("facebook", page=page, context=context, close=False):
            return {
                "ok": False,
                "accepted": 0,
                "error": "not_logged_in",
                "message": "Facebook 未登录 — 请运行 apsales-social-login.py --platform facebook",
            }

        loaded = False
        for url in REQUESTS_URLS:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=120_000)
                time.sleep(2)
                _dismiss_facebook_overlays(page)
                loaded = True
                break
            except Exception as exc:
                errors.append(str(exc)[:120])
                continue

        if not loaded:
            return {"ok": False, "accepted": 0, "error": "requests_page_unreachable"}

        while accepted < limit:
            buttons = _find_accept_buttons(page)
            if not buttons:
                break
            btn = buttons[0]
            try:
                btn.scroll_into_view_if_needed(timeout=5000)
                _human_delay(0.8, 1.6)
                btn.click(timeout=10_000)
                accepted += 1
                _human_delay(1.5, 3.0)
            except Exception as exc:
                err = str(exc).lower()
                if "rate" in err or "limit" in err or "blocked" in err:
                    try:
                        from customer_gateway.fb_platform_limits import record_platform_block

                        record_platform_block("follow", err)
                    except Exception:
                        pass
                    return {
                        "ok": False,
                        "accepted": accepted,
                        "error": "rate_limited",
                        "message": "Facebook 限流 — 已停止，请稍后再试",
                    }
                errors.append(str(exc)[:120])
                break

            if accepted >= limit:
                break
            time.sleep(0.5)

        return {
            "ok": True,
            "accepted": accepted,
            "max_per_run": limit,
            "remaining_hint": "可能还有未处理请求 — 下次 cron 继续",
            "errors": errors[:3],
            "page_url": page.url,
        }
    except SocialBrowserError as exc:
        return {"ok": False, "accepted": accepted, "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "accepted": accepted, "error": str(exc)[:200]}
