#!/usr/bin/env python3
"""Batch Facebook group posts — skips successful groups, stops after 3 consecutive failures."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass

DEFAULT_TEXT = """Used engines & half-cuts from China.
www.asia-power.com
WhatsApp: +86 186 0377 3077"""

IMAGE_PATH = ROOT / "assets" / "images" / "supply-halfcut.jpg"

DEFAULT_GROUPS = [
    "https://www.facebook.com/groups/1536239923345035",
    "https://www.facebook.com/groups/610831566450570",
    "https://www.facebook.com/groups/1595649984094656",
    "https://www.facebook.com/groups/278747944383991",
    "https://www.facebook.com/groups/1188187554634186",
]


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def post_to_group(page, group_url: str, text: str, image_path: Path, *, logged_in: bool) -> dict:
    from integrations.social_browser.facebook_groups import _post_group_composer_text
    from integrations.social_browser.platform_adapter import _dismiss_facebook_overlays

    url = group_url.rstrip("/")
    if not logged_in:
        return {"ok": False, "group_url": url, "error": "not_logged_in"}
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        _dismiss_facebook_overlays(page)

        body = ""
        try:
            body = page.inner_text("body", timeout=5000)[:4000].lower()
        except Exception:
            pass
        if ("log in" in body or "登录" in body) and "write something" not in body and "写点什么" not in body:
            return {"ok": False, "group_url": url, "error": "login_wall_on_group", "page_url": page.url}
        if "content isn't available" in body or "内容暂时无法显示" in body:
            return {"ok": False, "group_url": url, "error": "group_unavailable", "page_url": page.url}

        ok = _post_group_composer_text(page, text, image_paths=[image_path])
        if not ok:
            return {"ok": False, "group_url": url, "error": "post_failed", "page_url": page.url}
        return {"ok": True, "group_url": url, "post_url": page.url, "posted_at": _now_utc()}
    except Exception as exc:
        return {"ok": False, "group_url": url, "error": str(exc)[:300]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--groups", nargs="*", default=DEFAULT_GROUPS)
    parser.add_argument("--text", default=DEFAULT_TEXT)
    parser.add_argument("--max-fail-streak", type=int, default=3)
    parser.add_argument("--gap", type=int, default=8, help="Seconds between posts")
    args = parser.parse_args()

    if not IMAGE_PATH.is_file():
        print(json.dumps({"ok": False, "error": f"image_missing: {IMAGE_PATH}"}))
        return 1

    from integrations.social_browser.platform_adapter import _dismiss_facebook_overlays, verify_login
    from integrations.social_browser.session_manager import acquire_browser

    results: list[dict] = []
    fail_streak = 0
    stopped_early = False

    with acquire_browser("facebook") as sess:
        page = sess.page
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        _dismiss_facebook_overlays(page)
        logged_in = verify_login("facebook", page=page, close=False)
        if not logged_in:
            payload = {
                "ok": False,
                "error": "not_logged_in",
                "results": [],
                "finished_at": _now_utc(),
            }
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 1

        for i, group_url in enumerate(args.groups):
            if fail_streak >= args.max_fail_streak:
                stopped_early = True
                break
            if i > 0:
                time.sleep(args.gap)
            result = post_to_group(page, group_url, args.text, IMAGE_PATH, logged_in=logged_in)
            results.append(result)
            if result.get("ok"):
                fail_streak = 0
            else:
                fail_streak += 1

    payload = {
        "ok": all(r.get("ok") for r in results) if results else False,
        "results": results,
        "stopped_early": stopped_early,
        "fail_streak_at_stop": fail_streak if stopped_early else 0,
        "finished_at": _now_utc(),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
