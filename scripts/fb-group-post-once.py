#!/usr/bin/env python3
"""One-off Facebook group post with local image — CEO-directed manual broadcast."""

from __future__ import annotations

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

POST_TEXT = """Looking for used engines, half-cuts or auto parts from China? 🔧

We are AsiaPower — verified used parts exporter.
Browse our catalog 👉 www.asia-power.com
WhatsApp: +86 166 3880 1930

Same-day quotes. Real stock photos before shipment."""

IMAGE_PATH = ROOT / "assets" / "images" / "supply-halfcut.jpg"

GROUPS = [
    "https://www.facebook.com/groups/autopartsghana",
    "https://www.facebook.com/groups/nigeriaautospareparts",
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
            return {"ok": False, "group_url": url, "error": "login_wall_on_group"}

        ok = _post_group_composer_text(page, text, image_paths=[image_path])
        if not ok:
            return {"ok": False, "group_url": url, "error": "post_failed", "page_url": page.url}
        return {"ok": True, "group_url": url, "post_url": page.url, "posted_at": _now_utc()}
    except Exception as exc:
        return {"ok": False, "group_url": url, "error": str(exc)[:300]}


def main() -> int:
    if not IMAGE_PATH.is_file():
        print(json.dumps({"ok": False, "error": f"image_missing: {IMAGE_PATH}"}))
        return 1

    from integrations.social_browser.platform_adapter import _dismiss_facebook_overlays, verify_login
    from integrations.social_browser.session_manager import acquire_browser

    results: list[dict] = []
    with acquire_browser("facebook") as sess:
        page = sess.page
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=120_000)
        time.sleep(3)
        _dismiss_facebook_overlays(page)
        logged_in = verify_login("facebook", page=page, close=False)
        if not logged_in:
            payload = {"ok": False, "error": "not_logged_in", "results": [], "finished_at": _now_utc()}
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 1
        for i, group_url in enumerate(GROUPS):
            if i > 0:
                time.sleep(5)
            results.append(post_to_group(page, group_url, POST_TEXT, IMAGE_PATH, logged_in=logged_in))

    payload = {"ok": all(r.get("ok") for r in results), "results": results, "finished_at": _now_utc()}
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
