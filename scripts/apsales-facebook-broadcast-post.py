#!/usr/bin/env python3
"""Post ONE image-rich promotion to Facebook timeline (safe broadcast).

Does NOT mass-message friends — that violates Facebook ToS and risks account ban.
Use this for a single timeline post; optional group share is manual only.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass

GROUP_SHARE_TEMPLATE = """\
【可选 · 手动发群】CEO 若管理 1–2 个 FB 群组，可复制以下内容手动粘贴（勿用脚本群发）：

---
{ caption }

👉 { listing_url }
📧 sales@asia-power.com
---
"""


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · Facebook 时间线发一条图文推广（安全广播）")
    p.add_argument(
        "--scheme",
        choices=["A", "B", "C", "D", "E"],
        default="A",
        help="Promotion scheme (default A = half-cuts hero)",
    )
    p.add_argument("--json", action="store_true", help="JSON output")
    p.add_argument("--show-group-template", action="store_true", help="Print manual group share text")
    p.add_argument("--dry-run", action="store_true", help="Show assets only, do not post")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.social_post_assets import resolve_post_assets
    from customer_gateway.social_session import api_ready, session_status
    from integrations.social_browser.platform_adapter import post_facebook_browser, verify_login

    assets = resolve_post_assets({"scheme_id": args.scheme}, "facebook")
    caption = assets["caption"]
    images = assets["image_urls"]
    listing_url = assets["listing_url"]

    if args.show_group_template:
        print(GROUP_SHARE_TEMPLATE.format(caption=caption.strip(), listing_url=listing_url))
        return 0

    if args.dry_run:
        payload = {
            "scheme": args.scheme,
            "caption_preview": caption[:200],
            "images": images,
            "listing_url": listing_url,
            "logged_in_browser": verify_login("facebook"),
            "api_ready": api_ready("facebook"),
            "session": session_status("facebook"),
            "note": "不会群发私信 — 仅发一条时间线帖",
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else (
            f"方案 {args.scheme} · {len(images)} 张图 · {listing_url}\n"
            f"登录: {'✅' if payload['logged_in_browser'] or payload['api_ready'] else '❌'}"
        ))
        return 0

    st = session_status("facebook")
    if not st.get("logged_in"):
        print("❌ Facebook 未登录 — 请先运行 apsales-social-login.py --platform facebook")
        return 1

    # Personal timeline (gooddlong) — browser session; Page API is a different target.
    from customer_gateway.zijing_activity_stream import track_step

    with track_step("timeline_post", f"时间线推广帖 scheme={args.scheme}", platform="facebook"):
        result = post_facebook_browser(
            message=caption,
            link=listing_url,
            image_urls=images,
        )

    result["scheme_id"] = args.scheme
    result["listing_url"] = listing_url
    result["safe_broadcast"] = True
    result["skipped_mass_dm"] = (
        "未向全部好友群发私信 — Facebook 禁止且易封号；已改为时间线单帖"
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("ok"):
            print(f"✅ 已发时间线推广帖 · 方案 {args.scheme}")
            print(f"   链接: {result.get('post_url') or '—'}")
            print(f"   配图: {result.get('images_attached', len(images))} 张")
        else:
            print(f"❌ 发帖失败: {result.get('error') or 'unknown'}")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
