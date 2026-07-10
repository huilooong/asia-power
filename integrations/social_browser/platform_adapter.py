"""Playwright browser adapters for social platforms (fallback when API tokens absent)."""

from __future__ import annotations

import os
import re
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any

from customer_gateway.social_session import browser_data_dir, mark_connected, mark_disconnected


def _release_pw_context(pw, context) -> None:
    from integrations.social_browser.session_manager import release_context

    release_context(pw, context)


class SocialBrowserError(Exception):
    pass


def _headless() -> bool:
    return os.getenv("APSALES_SOCIAL_BROWSER_HEADLESS", "1").strip() != "0"


# Mobile UA helps Instagram show the login form instead of a homepage modal.
_INSTAGRAM_MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)


def _launch_context(platform: str):
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401 — availability check
    except ImportError as exc:
        raise SocialBrowserError("playwright not installed — pip install playwright && python -m playwright install chromium") from exc

    from integrations.social_browser.session_manager import (
        clear_stale_lock,
        get_active_session,
        _acquire_lock,
        _launch_with_profile_recovery,
        _terminate_profile_browsers,
    )

    active = get_active_session()
    if active and active.platform == platform:
        return active.playwright, active.context

    clear_stale_lock()
    _acquire_lock(platform)
    _terminate_profile_browsers(platform, force=False)
    pw, context, _page = _launch_with_profile_recovery(platform)
    return pw, context


def _first_page(context):
    if context.pages:
        return context.pages[0]
    return context.new_page()


PLATFORM_URLS = {
    "facebook": "https://www.facebook.com/",
    "instagram": "https://www.instagram.com/accounts/login/",
    "x": "https://x.com/home",
}

# Homepage can show a modal without the login form; keep direct login as fallback.
_INSTAGRAM_LOGIN_URLS = (
    "https://www.instagram.com/accounts/login/",
    "https://www.instagram.com/accounts/login/?source=auth_switcher",
)

_X_LOGIN_URLS = (
    "https://x.com/login",
    "https://twitter.com/login",
    "https://x.com/i/flow/login",
)


def _dismiss_instagram_overlays(page) -> None:
    """Close cookie/consent banners that block the login form."""
    selectors = [
        'button:has-text("Allow all cookies")',
        'button:has-text("Allow essential and optional cookies")',
        'button:has-text("Decline optional cookies")',
        'button:has-text("Accept")',
        'button:has-text("Only allow essential cookies")',
        '[role="button"]:has-text("Not Now")',
        '[role="button"]:has-text("以后再说")',
    ]
    for sel in selectors:
        try:
            btn = page.locator(sel).first
            if btn.count() and btn.is_visible(timeout=800):
                btn.click(timeout=2000)
                time.sleep(0.5)
        except Exception:
            continue


def _prepare_instagram_login(page) -> None:
    """Navigate to IG login form; try Facebook SSO when available."""
    for url in _INSTAGRAM_LOGIN_URLS:
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(1.5)
        _dismiss_instagram_overlays(page)
        if page.locator('input[name="username"], input[aria-label="Phone number, username, or email"]').count():
            break
    else:
        page.goto("https://www.instagram.com/", wait_until="domcontentloaded", timeout=120_000)
        _dismiss_instagram_overlays(page)
        for sel in (
            'a[href*="/accounts/login"]',
            'button:has-text("Log in")',
            'button:has-text("Log In")',
            '[role="button"]:has-text("Log in")',
        ):
            try:
                link = page.locator(sel).first
                if link.count() and link.is_visible(timeout=1000):
                    link.click(timeout=3000)
                    time.sleep(1)
                    break
            except Exception:
                continue

    # If CEO already logged into Facebook in another session, offer Meta SSO.
    for sel in (
        'button:has-text("Log in with Facebook")',
        'button:has-text("Continue with Facebook")',
        '[role="button"]:has-text("Facebook")',
        'div[role="button"]:has-text("Facebook")',
    ):
        try:
            fb_btn = page.locator(sel).first
            if fb_btn.count() and fb_btn.is_visible(timeout=1000):
                print("[instagram] 检测到「用 Facebook 登录」— 若已登录 FB 可点该按钮")
                break
        except Exception:
            continue


def _prepare_x_login(page) -> None:
    """Navigate to X login form; homepage often skips the username field."""
    for url in _X_LOGIN_URLS:
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(1.5)
        if page.locator(
            'input[autocomplete="username"], input[name="text"], '
            'input[data-testid="ocfEnterTextTextInput"]'
        ).count():
            break


def open_login_page(platform: str, *, wait_seconds: int = 300) -> dict[str, Any]:
    """Open headed browser for one-time manual login."""
    existing = verify_login(platform)
    if existing:
        mark_connected(platform, method="browser", account_label="")
        return {"platform": platform, "logged_in": True, "already_logged_in": True}

    os.environ["APSALES_SOCIAL_BROWSER_HEADLESS"] = "0"
    pw, context = _launch_context(platform)
    page = _first_page(context)
    if platform == "instagram":
        _prepare_instagram_login(page)
        print(
            "\n[instagram] 已打开登录页（手机版界面）。"
            "\n  · 推荐：改用 Meta API（无需浏览器）→ scripts/apsales-meta-ig-setup.py"
            "\n  · 备用：账号密码登录，或点「用 Facebook 登录」"
        )
    elif platform == "x":
        _prepare_x_login(page)
        print(
            "\n[x] 已打开登录页。"
            "\n  · 输入公司 X 账号密码"
            "\n  · 如有 2FA 在手机上确认"
        )
    else:
        page.goto(PLATFORM_URLS[platform], wait_until="domcontentloaded", timeout=120_000)
    print(f"\n[{platform}] 请在浏览器中完成登录（含 2FA）。登录成功后按 Enter…")
    try:
        input()
    except EOFError:
        time.sleep(wait_seconds)
    logged_in = verify_login(platform, page=page, context=context, close=False)
    if logged_in:
        mark_connected(platform, method="browser", account_label=_detect_account_label(platform, page))
    else:
        mark_disconnected(platform, reason="login_not_detected")
    _release_pw_context(pw, context)
    return {"platform": platform, "logged_in": logged_in}


def _detect_account_label(platform: str, page) -> str:
    try:
        if platform == "facebook":
            el = page.locator('[aria-label="Your profile"], [aria-label="Account"]').first
            if el.count():
                return (el.get_attribute("aria-label") or "")[:80]
        if platform == "x":
            el = page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').first
            if el.count():
                return el.inner_text(timeout=3000)[:80]
    except Exception:
        pass
    return ""


def _instagram_has_session_cookie(context) -> bool:
    try:
        for cookie in context.cookies():
            if cookie.get("name") == "sessionid" and cookie.get("value"):
                return True
    except Exception:
        pass
    return False


def _x_has_auth_cookie(context) -> bool:
    try:
        for cookie in context.cookies():
            if cookie.get("name") == "auth_token" and cookie.get("value"):
                return True
    except Exception:
        pass
    return False


def _x_on_login_page(page) -> bool:
    try:
        return page.locator(
            'a:has-text("Continue with phone"), a:has-text("Continue with Apple"), '
            'a:has-text("使用手机号继续"), a:has-text("使用 Apple 继续"), '
            'span:has-text("登录"), span:has-text("Sign in"), '
            'input[autocomplete="username"], input[name="text"], '
            'input[data-testid="ocfEnterTextTextInput"]'
        ).count() > 0
    except Exception:
        return False


def verify_login(platform: str, *, page=None, context=None, close: bool = True) -> bool:
    owns = page is None
    pw = None
    if owns:
        pw, context = _launch_context(platform)
        page = _first_page(context)
        if platform == "instagram":
            _prepare_instagram_login(page)
        else:
            page.goto(PLATFORM_URLS[platform], wait_until="domcontentloaded", timeout=120_000)
        time.sleep(2)

    logged_in = False
    try:
        if platform == "facebook":
            logged_in = page.locator(
                '[aria-label="Create a post"], [aria-label="Home"], '
                '[aria-label="创建帖子"], [aria-label="主页"], '
                '[aria-label="What\'s on your mind?"], [aria-label="Account"]'
            ).count() > 0
            if not logged_in:
                on_login_form = page.locator(
                    'input[name="email"], input[name="pass"], '
                    'input[aria-label="Email address or mobile number"], '
                    'button:has-text("Log in"), button:has-text("登录")'
                ).count() > 0
                logged_in = not on_login_form and page.locator(
                    '[data-pagelet="FeedUnit"], [role="feed"], [aria-label="Stories"]'
                ).count() > 0
        elif platform == "instagram":
            if context and _instagram_has_session_cookie(context):
                logged_in = True
            else:
                logged_in = page.locator(
                    '[aria-label="New post"], [aria-label="新帖子"], '
                    'svg[aria-label="New post"], svg[aria-label="新帖子"]'
                ).count() > 0
                if not logged_in:
                    on_login_form = page.locator(
                        'input[name="username"], input[aria-label="Phone number, username, or email"]'
                    ).count() > 0
                    logged_in = not on_login_form and page.locator(
                        'button:has-text("Log in"), a:has-text("Log in"), button:has-text("Log In")'
                    ).count() == 0 and _instagram_has_session_cookie(context)
        elif platform == "x":
            logged_in = page.locator(
                '[data-testid="SideNav_NewTweet_Button"], [data-testid="primaryColumn"], '
                '[data-testid="SideNav_AccountSwitcher_Button"], '
                '[aria-label="Post"], [aria-label="发帖"], [aria-label="发推"]'
            ).count() > 0
            if not logged_in and context and _x_has_auth_cookie(context):
                logged_in = not _x_on_login_page(page)
    except Exception:
        logged_in = False

    if owns and close:
        _release_pw_context(pw, context)
    return logged_in


def _dismiss_x_overlays(page) -> None:
    for sel in (
        'button:has-text("Accept all cookies")',
        'button:has-text("Refuse non-essential cookies")',
        'button:has-text("Got it")',
    ):
        try:
            btn = page.locator(sel).first
            if btn.count() and btn.is_visible(timeout=800):
                btn.click(timeout=2000)
                time.sleep(0.5)
        except Exception:
            continue


def _compose_text(message: str, link: str = "") -> str:
    message = (message or "").strip()
    link = (link or "").strip()
    if link and link not in message:
        return f"{message}\n\n{link}".strip()
    return message


def _image_suffix(url: str) -> str:
    lower = (url or "").lower()
    if ".webp" in lower:
        return ".webp"
    if ".png" in lower:
        return ".png"
    if ".gif" in lower:
        return ".gif"
    return ".jpg"


def _download_images(image_urls: list[str], *, max_images: int = 4) -> list[Path]:
    paths: list[Path] = []
    for url in image_urls[:max_images]:
        url = (url or "").strip()
        if not url:
            continue
        try:
            fd, raw_path = tempfile.mkstemp(suffix=_image_suffix(url))
            os.close(fd)
            path = Path(raw_path)
            req = urllib.request.Request(url, headers={"User-Agent": "AsiaPower-SocialAutopilot/1.0"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                path.write_bytes(resp.read())
            if path.stat().st_size > 0:
                paths.append(path)
            else:
                path.unlink(missing_ok=True)
        except Exception:
            continue
    return paths


def _cleanup_temp_files(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass


def _dismiss_facebook_overlays(page) -> None:
    for sel in (
        'button:has-text("Allow all cookies")',
        'button:has-text("Decline optional cookies")',
        'button:has-text("Accept All")',
        '[aria-label="Close"]',
        '[aria-label="关闭"]',
    ):
        try:
            btn = page.locator(sel).first
            if btn.count() and btn.is_visible(timeout=800):
                btn.click(timeout=2000)
                time.sleep(0.5)
        except Exception:
            continue


def _open_facebook_composer(page) -> bool:
    composer_selectors = (
        '[aria-label="Create a post"]',
        '[aria-label="创建帖子"]',
        '[role="button"]:has-text("What\'s on your mind")',
        '[role="button"]:has-text("你在想什么")',
        'div[role="button"]:has-text("What\'s on your mind")',
        'span:has-text("What\'s on your mind")',
        '[placeholder*="What\'s on your mind"]',
        '[aria-label="Write something..."]',
        '[aria-label="写点什么..."]',
    )
    for url in (
        "https://www.facebook.com/",
        "https://www.facebook.com/me",
        "https://www.facebook.com/profile.php",
    ):
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(2)
        _dismiss_facebook_overlays(page)
        for sel in composer_selectors:
            composer = page.locator(sel).first
            try:
                if composer.count() and composer.is_visible(timeout=1500):
                    composer.click(timeout=10_000)
                    time.sleep(1)
                    return True
            except Exception:
                continue
    return False
    text = (message or "").strip()
    if link and link not in text:
        text = f"{text}\n\n{link}".strip()
    return text


def _attach_images_facebook(page, local_paths: list[Path]) -> bool:
    if not local_paths:
        return False
    files = [str(p) for p in local_paths]
    photo_selectors = [
        '[aria-label="Photo/video"]',
        '[aria-label="照片/视频"]',
        '[aria-label="Add photos"]',
        '[aria-label="添加照片"]',
        '[aria-label="Add to your post"]',
    ]
    for sel in photo_selectors:
        btn = page.locator(sel).first
        if not btn.count():
            continue
        try:
            with page.expect_file_chooser(timeout=8000) as fc_info:
                btn.click(timeout=8000)
            fc_info.value.set_files(files)
            time.sleep(max(2, len(files)))
            return True
        except Exception:
            continue
    for sel in ('input[type="file"][accept*="image"]', 'input[type="file"]'):
        file_input = page.locator(sel).first
        if file_input.count():
            try:
                file_input.set_input_files(files)
                time.sleep(max(2, len(files)))
                return True
            except Exception:
                continue
    return False


def _attach_images_x(page, local_paths: list[Path]) -> bool:
    if not local_paths:
        return False
    files = [str(p) for p in local_paths[:4]]
    media_selectors = [
        '[data-testid="attachMedia"]',
        '[aria-label="Add photos or video"]',
        '[aria-label="Media"]',
    ]
    for sel in media_selectors:
        btn = page.locator(sel).first
        if not btn.count():
            continue
        try:
            with page.expect_file_chooser(timeout=8000) as fc_info:
                btn.click(timeout=8000)
            fc_info.value.set_files(files)
            time.sleep(max(2, len(files)))
            return True
        except Exception:
            continue
    file_input = page.locator('input[type="file"]').first
    if file_input.count():
        try:
            file_input.set_input_files(files)
            time.sleep(max(2, len(files)))
            return True
        except Exception:
            pass
    return False


def post_facebook_browser(
    *,
    message: str,
    link: str = "",
    image_urls: list[str] | None = None,
    page=None,
    context=None,
) -> dict[str, Any]:
    if page is None:
        from integrations.social_browser.session_manager import acquire_browser

        with acquire_browser("facebook") as sess:
            return post_facebook_browser(
                message=message,
                link=link,
                image_urls=image_urls,
                page=sess.page,
                context=sess.context,
            )

    images = image_urls or []
    local_paths = _download_images(images, max_images=4)
    try:
        if not _open_facebook_composer(page):
            return {"ok": False, "platform": "facebook", "error": "composer_not_found"}
        if local_paths:
            attached = _attach_images_facebook(page, local_paths)
            if not attached:
                return {"ok": False, "platform": "facebook", "error": "image_attach_failed"}
            time.sleep(1)
        text = _compose_text(message, link)
        editable = page.locator(
            '[role="textbox"][contenteditable="true"], '
            '[data-lexical-editor="true"], div[contenteditable="true"]'
        ).last
        if editable.count():
            editable.click(timeout=5000)
        page.keyboard.type(text[:63206])
        page.locator(
            '[aria-label="Post"], [aria-label="发布"], [aria-label="分享"], '
            '[role="button"]:has-text("Post"), [role="button"]:has-text("发布"), '
            '[role="button"]:has-text("分享"), [role="button"]:has-text("发帖")'
        ).last.click(timeout=15_000)
        time.sleep(4)
        post_url = page.url
        return {
            "ok": True,
            "platform": "facebook",
            "post_url": post_url,
            "method": "browser",
            "images_attached": len(local_paths),
        }
    finally:
        _cleanup_temp_files(local_paths)


def post_x_browser(*, text: str, image_urls: list[str] | None = None) -> dict[str, Any]:
    images = image_urls or []
    local_paths = _download_images(images, max_images=4)
    pw, context = _launch_context("x")
    page = _first_page(context)
    try:
        if not verify_login("x", page=page, context=context, close=False):
            raise SocialBrowserError("X session not logged in — run apsales-social-login.py --platform x")
        page.goto("https://x.com/compose/post", wait_until="domcontentloaded", timeout=120_000)
        time.sleep(2)
        _dismiss_x_overlays(page)
        if local_paths:
            attached = _attach_images_x(page, local_paths)
            if not attached:
                return {"ok": False, "platform": "x", "error": "image_attach_failed"}
            time.sleep(1)
        box = page.locator(
            '[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea_0"] div[contenteditable="true"], '
            '[role="textbox"][data-testid="tweetTextarea_0"]'
        ).first
        box.focus(timeout=15_000)
        page.keyboard.type(text[:280])
        time.sleep(1)
        posted = False
        for sel in (
            '[data-testid="tweetButton"]:not([disabled])',
            '[data-testid="tweetButtonInline"]:not([disabled])',
            '[data-testid="tweetButton"]',
            '[data-testid="tweetButtonInline"]',
            '[role="button"]:has-text("Post")',
            '[role="button"]:has-text("发帖")',
        ):
            btn = page.locator(sel).first
            if not btn.count():
                continue
            try:
                btn.click(timeout=5000, force=True)
                posted = True
                break
            except Exception:
                continue
        if not posted:
            page.keyboard.press("Meta+Enter")
        time.sleep(4)
        tweet_link = page.locator('a[href*="/status/"]').first
        post_url = ""
        if tweet_link.count():
            href = tweet_link.get_attribute("href") or ""
            post_url = href if href.startswith("http") else f"https://x.com{href}"
        return {
            "ok": True,
            "platform": "x",
            "post_url": post_url,
            "method": "browser",
            "images_attached": len(local_paths),
        }
    finally:
        _cleanup_temp_files(local_paths)
        _release_pw_context(pw, context)


def post_instagram_browser(*, caption: str, image_url: str) -> dict[str, Any]:
    raise SocialBrowserError(
        "Instagram browser posting is unreliable — use Meta Graph API (META_IG_USER_ID + META_PAGE_ACCESS_TOKEN)"
    )


def scan_post_comments_browser(platform: str, post_url: str) -> list[dict[str, Any]]:
    """Best-effort comment scrape for reply inbox."""
    pw, context = _launch_context(platform)
    page = _first_page(context)
    found: list[dict[str, Any]] = []
    try:
        page.goto(post_url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        if platform == "facebook":
            items = page.locator('[aria-label*="Comment"], div[role="article"]').all()
            for item in items[:20]:
                try:
                    text = item.inner_text(timeout=2000)[:500]
                    if len(text) < 8:
                        continue
                    found.append({
                        "platform": "facebook",
                        "customer_handle": "fb_user",
                        "snippet": text.split("\n")[0][:200],
                        "post_url": post_url,
                    })
                except Exception:
                    continue
        elif platform == "x":
            items = page.locator('[data-testid="tweet"]').all()
            for item in items[1:15]:
                try:
                    text = item.inner_text(timeout=2000)
                    handle = ""
                    m = re.search(r"@\w+", text)
                    if m:
                        handle = m.group(0)
                    found.append({
                        "platform": "x",
                        "customer_handle": handle or "x_user",
                        "snippet": text[:200],
                        "post_url": post_url,
                    })
                except Exception:
                    continue
    finally:
        _release_pw_context(pw, context)
    return found


def post_facebook_group_browser(
    *,
    group_url: str,
    message: str,
    link: str = "",
    image_urls: list[str] | None = None,
) -> dict[str, Any]:
    """Post to a Facebook group (requires membership)."""
    if not group_url:
        return {"ok": False, "error": "missing_group_url"}
    images = image_urls or []
    local_paths = _download_images(images, max_images=4)
    pw, context = _launch_context("facebook")
    page = _first_page(context)
    try:
        page.goto(group_url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        composer = page.locator(
            '[aria-label="Write something..."], [aria-label="写点什么..."], '
            '[role="button"]:has-text("Write something"), [role="button"]:has-text("写点什么")'
        ).first
        if not composer.count():
            composer = page.locator(
                '[aria-label="Create a post"], [aria-label="创建帖子"], '
                '[role="button"]:has-text("Create post"), [role="button"]:has-text("创建公开帖")'
            ).first
        composer.click(timeout=15_000)
        time.sleep(1)
        if local_paths:
            attached = _attach_images_facebook(page, local_paths)
            if not attached:
                return {"ok": False, "platform": "facebook", "error": "image_attach_failed"}
            time.sleep(1)
        text = _compose_text(message, link)
        page.keyboard.type(text[:63206])
        page.locator(
            '[aria-label="Post"], [aria-label="发布"], '
            '[role="button"]:has-text("Post"), [role="button"]:has-text("发布")'
        ).last.click(timeout=15_000)
        time.sleep(4)
        return {
            "ok": True,
            "platform": "facebook",
            "post_url": page.url,
            "method": "browser_group",
            "images_attached": len(local_paths),
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc), "platform": "facebook"}
    finally:
        _cleanup_temp_files(local_paths)
        _release_pw_context(pw, context)


def _search_x_page(page, query: str) -> None:
    from urllib.parse import quote
    url = f"https://x.com/search?q={quote(query)}&f=live"
    page.goto(url, wait_until="domcontentloaded", timeout=120_000)
    time.sleep(3)


def _search_facebook_page(page, query: str) -> None:
    from urllib.parse import quote
    url = f"https://www.facebook.com/search/posts?q={quote(query)}"
    page.goto(url, wait_until="domcontentloaded", timeout=120_000)
    time.sleep(3)


def engage_comment_browser(platform: str, *, search_query: str = "", text: str = "", post_url: str = "") -> dict[str, Any]:
    """Find a relevant post via search (or direct URL) and leave a helpful comment."""
    key = (platform or "").strip().lower()
    if key not in ("facebook", "x", "twitter"):
        return {"ok": False, "error": f"unsupported platform {platform}"}
    if key == "twitter":
        key = "x"
    if not text.strip():
        return {"ok": False, "error": "empty_comment"}

    pw, context = _launch_context(key)
    page = _first_page(context)
    try:
        if post_url:
            page.goto(post_url, wait_until="domcontentloaded", timeout=120_000)
        elif search_query:
            if key == "x":
                _search_x_page(page, search_query)
            else:
                _search_facebook_page(page, search_query)
        else:
            return {"ok": False, "error": "need search_query or post_url"}
        time.sleep(2)

        if key == "x":
            tweet = page.locator('[data-testid="tweet"]').first
            if not tweet.count():
                return {"ok": False, "error": "no_posts_found"}
            reply_btn = tweet.locator('[data-testid="reply"]').first
            reply_btn.click(timeout=10_000)
            time.sleep(1)
            box = page.locator('[data-testid="tweetTextarea_0"]').first
            box.click(timeout=10_000)
            page.keyboard.type(text[:280])
            page.locator('[data-testid="tweetButton"]').first.click(timeout=10_000)
            time.sleep(3)
            return {"ok": True, "platform": "x", "method": "browser_comment", "target_url": page.url}
        else:
            post = page.locator('[role="article"]').first
            if not post.count():
                return {"ok": False, "error": "no_posts_found"}
            comment_box = page.locator(
                '[aria-label="Write a comment"], [aria-label="写评论"], '
                '[placeholder*="comment"], [placeholder*="评论"]'
            ).first
            if not comment_box.count():
                post.click(timeout=5000)
                time.sleep(1)
                comment_box = page.locator(
                    '[aria-label="Write a comment"], [aria-label="写评论"]'
                ).first
            comment_box.click(timeout=10_000)
            page.keyboard.type(text[:8000])
            page.locator(
                '[aria-label="Post"], [aria-label="发布"], '
                '[role="button"]:has-text("Comment"), [role="button"]:has-text("评论")'
            ).last.click(timeout=10_000)
            time.sleep(2)
            return {"ok": True, "platform": "facebook", "method": "browser_comment", "target_url": page.url}
    except Exception as exc:
        err = str(exc).lower()
        if "rate" in err or "limit" in err or "blocked" in err:
            return {"ok": False, "error": "rate_limited"}
        return {"ok": False, "error": str(exc)}
    finally:
        _release_pw_context(pw, context)


def engage_follow_browser(platform: str, *, search_query: str = "", handle: str = "") -> dict[str, Any]:
    """Follow an account discovered via search or direct handle (@user on X)."""
    key = (platform or "").strip().lower()
    if key in ("twitter",):
        key = "x"
    if key != "x":
        return {"ok": False, "error": "follow_via_browser_only_on_x_for_now"}
    pw, context = _launch_context("x")
    page = _first_page(context)
    try:
        if handle:
            h = handle if handle.startswith("@") else f"@{handle}"
            url = f"https://x.com/{h.lstrip('@')}"
            page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        elif search_query:
            _search_x_page(page, search_query)
            time.sleep(2)
            profile = page.locator('[data-testid="User-Name"] a[href*="/"]').first
            if not profile.count():
                return {"ok": False, "error": "no_account_found"}
            profile.click(timeout=10_000)
            time.sleep(2)
        else:
            return {"ok": False, "error": "need search_query or handle"}

        follow_btn = page.locator(
            '[data-testid*="follow"]:not([data-testid*="unfollow"]), '
            '[role="button"]:has-text("Follow")'
        ).first
        if not follow_btn.count():
            return {"ok": False, "error": "already_following_or_no_button"}
        follow_btn.click(timeout=10_000)
        time.sleep(2)
        return {"ok": True, "platform": "x", "method": "browser_follow", "target_url": page.url}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        _release_pw_context(pw, context)


def engage_reply_browser(platform: str, *, post_url: str, text: str) -> dict[str, Any]:
    """Reply on an existing thread (not cold DM)."""
    if not post_url:
        return {"ok": False, "error": "missing_post_url"}
    return engage_comment_browser(platform, post_url=post_url, text=text)


def post_via_browser(platform: str, *, message: str, link: str = "", image_urls: list[str] | None = None) -> dict[str, Any]:
    key = (platform or "").strip().lower()
    images = image_urls or []
    if key == "facebook":
        return post_facebook_browser(message=message, link=link, image_urls=images)
    if key == "instagram":
        return post_instagram_browser(caption=message, image_url=images[0] if images else "")
    if key in ("x", "twitter"):
        body = _compose_text(message, link)
        return post_x_browser(text=body[:280], image_urls=images)
    raise SocialBrowserError(f"Unsupported platform: {platform}")
